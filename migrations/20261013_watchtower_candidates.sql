-- Private storage preparation; grants and live monitoring remain separate.
CREATE SCHEMA watchtower_private;
REVOKE ALL ON SCHEMA watchtower_private FROM PUBLIC;
CREATE TABLE watchtower_private.watchtower_candidates (
 signature text PRIMARY KEY CHECK (signature ~ '^[1-9A-HJ-NP-Za-km-z]{64,88}$'),
 slot bigint NOT NULL CHECK (slot > 0),
 matched_accounts jsonb NOT NULL CHECK (jsonb_typeof(matched_accounts)='array' AND jsonb_array_length(matched_accounts) BETWEEN 1 AND 20),
 first_received timestamptz NOT NULL DEFAULT clock_timestamp(),
 state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','leased','processed','exhausted')),
 attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
 lease_version bigint NOT NULL DEFAULT 0,
 lease_until timestamptz,
 corroboration jsonb,
 corroborated_at timestamptz,
 CHECK (state<>'processed' OR (corroboration IS NOT NULL AND corroborated_at IS NOT NULL))
);
CREATE INDEX watchtower_candidates_work ON watchtower_private.watchtower_candidates(state,lease_until,first_received);
REVOKE ALL ON watchtower_private.watchtower_candidates FROM PUBLIC;

CREATE FUNCTION watchtower_private.enqueue_watchtower_candidates(items jsonb) RETURNS integer
LANGUAGE plpgsql SET search_path=pg_catalog,watchtower_private AS $$
DECLARE item jsonb; existing watchtower_private.watchtower_candidates%ROWTYPE; accepted integer:=0; candidate_slot bigint;
BEGIN
 IF jsonb_typeof(items) IS DISTINCT FROM 'array' OR jsonb_array_length(items)>100 THEN RAISE EXCEPTION 'Invalid candidates'; END IF;
 -- Canonical lock order avoids reversed-batch lock-order deadlocks.
 FOR item IN SELECT value FROM jsonb_array_elements(items) ORDER BY value->>'signature' LOOP
  IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR
   (SELECT array_agg(key ORDER BY key COLLATE "C") FROM jsonb_object_keys(item) AS keys(key)) IS DISTINCT FROM ARRAY['matchedAccounts','signature','slot']::text[] OR
   jsonb_typeof(item->'signature') IS DISTINCT FROM 'string' OR (item->>'signature') !~ '^[1-9A-HJ-NP-Za-km-z]{64,88}$' OR
   jsonb_typeof(item->'slot') IS DISTINCT FROM 'number' OR (item->>'slot') !~ '^[1-9][0-9]{0,15}$' OR
   jsonb_typeof(item->'matchedAccounts') IS DISTINCT FROM 'array' OR jsonb_array_length(item->'matchedAccounts') NOT BETWEEN 1 AND 20 THEN
   RAISE EXCEPTION 'Invalid candidates';
  END IF;
  candidate_slot:=(item->>'slot')::bigint;
  IF candidate_slot>9007199254740991 OR EXISTS(SELECT 1 FROM jsonb_array_elements(item->'matchedAccounts') AS accounts(value)
    WHERE jsonb_typeof(value) IS DISTINCT FROM 'string' OR (value#>>'{}') !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$') OR
   (SELECT count(DISTINCT value) FROM jsonb_array_elements(item->'matchedAccounts'))<>jsonb_array_length(item->'matchedAccounts') THEN RAISE EXCEPTION 'Invalid candidates'; END IF;
  INSERT INTO watchtower_private.watchtower_candidates(signature,slot,matched_accounts)
   VALUES(item->>'signature',candidate_slot,item->'matchedAccounts') ON CONFLICT(signature) DO NOTHING;
  SELECT * INTO STRICT existing FROM watchtower_private.watchtower_candidates WHERE signature=item->>'signature' FOR UPDATE;
  IF existing.slot<>candidate_slot OR existing.matched_accounts<>item->'matchedAccounts' THEN RAISE EXCEPTION 'Conflicting candidate'; END IF;
  accepted:=accepted+1;
 END LOOP;
 RETURN accepted;
END;
$$;
REVOKE ALL ON FUNCTION watchtower_private.enqueue_watchtower_candidates(jsonb) FROM PUBLIC;

CREATE FUNCTION watchtower_private.claim_watchtower_candidate() RETURNS SETOF watchtower_private.watchtower_candidates
LANGUAGE plpgsql SET search_path=pg_catalog,watchtower_private AS $$
BEGIN
 UPDATE watchtower_private.watchtower_candidates SET state='exhausted',lease_until=NULL
  WHERE attempts>=5 AND (state='pending' OR (state='leased' AND lease_until<=clock_timestamp()));
 RETURN QUERY WITH chosen AS (
  SELECT signature FROM watchtower_private.watchtower_candidates WHERE attempts<5 AND
   (state='pending' OR (state='leased' AND lease_until<=clock_timestamp()))
  ORDER BY first_received,signature FOR UPDATE SKIP LOCKED LIMIT 1
 ) UPDATE watchtower_private.watchtower_candidates AS c SET state='leased',attempts=c.attempts+1,
  lease_version=c.lease_version+1,lease_until=clock_timestamp()+interval '30 seconds'
 FROM chosen WHERE c.signature=chosen.signature RETURNING c.*;
END;
$$;
REVOKE ALL ON FUNCTION watchtower_private.claim_watchtower_candidate() FROM PUBLIC;

CREATE FUNCTION watchtower_private.finish_watchtower_candidate(candidate_signature text,version bigint,evidence jsonb) RETURNS boolean
LANGUAGE plpgsql SET search_path=pg_catalog,watchtower_private AS $$
DECLARE changed integer; candidate watchtower_private.watchtower_candidates%ROWTYPE;
BEGIN
 SELECT * INTO candidate FROM watchtower_private.watchtower_candidates WHERE signature=candidate_signature FOR UPDATE;
 IF NOT FOUND OR candidate.lease_version<>version OR candidate.state<>'leased' OR candidate.lease_until<=clock_timestamp() THEN RETURN false; END IF;
 IF jsonb_typeof(evidence) IS DISTINCT FROM 'object' OR
  pg_column_size(evidence)>32768 OR
  (SELECT array_agg(key ORDER BY key COLLATE "C") FROM jsonb_object_keys(evidence) AS keys(key)) IS DISTINCT FROM
   ARRAY['accountSlot','emitsFinding','finality','method','schema','signature','sourceAuthenticity','states','transactionSlot']::text[] OR
  evidence->>'method' IS DISTINCT FROM 'rpc_corroborated_candidate' OR evidence->>'signature' IS DISTINCT FROM candidate_signature OR
  evidence->'schema' IS DISTINCT FROM '1'::jsonb OR evidence->'emitsFinding' IS DISTINCT FROM 'false'::jsonb OR
  evidence->>'sourceAuthenticity' IS DISTINCT FROM 'rpc_response_not_cryptographically_verified' OR
  evidence->>'finality' IS DISTINCT FROM 'finalized_requested_from_reviewed_rpc' OR
  jsonb_typeof(evidence->'transactionSlot') IS DISTINCT FROM 'number' OR jsonb_typeof(evidence->'accountSlot') IS DISTINCT FROM 'number' OR
  (evidence->>'transactionSlot') !~ '^[1-9][0-9]{0,15}$' OR (evidence->>'accountSlot') !~ '^[1-9][0-9]{0,15}$' OR
  (evidence->>'transactionSlot')::bigint IS DISTINCT FROM candidate.slot OR
  (evidence->>'accountSlot')::bigint<candidate.slot OR (evidence->>'accountSlot')::bigint>9007199254740991 OR
  jsonb_typeof(evidence->'states') IS DISTINCT FROM 'array' OR
  (SELECT jsonb_agg(value->'account' ORDER BY ordinality) FROM jsonb_array_elements(evidence->'states') WITH ORDINALITY AS states(value,ordinality))
   IS DISTINCT FROM candidate.matched_accounts THEN RAISE EXCEPTION 'Invalid corroboration binding'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(evidence->'states') AS states(value) WHERE
  jsonb_typeof(value) IS DISTINCT FROM 'object' OR value->'slot' IS DISTINCT FROM evidence->'accountSlot' OR
  jsonb_typeof(value->'state') IS DISTINCT FROM 'string' OR value->>'state' NOT IN ('absent_at_account_slot','present_at_account_slot') OR
  (SELECT array_agg(key ORDER BY key COLLATE "C") FROM jsonb_object_keys(value) AS keys(key)) IS DISTINCT FROM
   CASE WHEN value->>'state'='absent_at_account_slot' THEN ARRAY['account','slot','state']::text[]
   ELSE ARRAY['account','dataBytes','dataSha256','executable','ownerProgram','slot','state','stateSha256']::text[] END OR
  (value->>'state'='present_at_account_slot' AND (jsonb_typeof(value->'executable') IS DISTINCT FROM 'boolean' OR
   jsonb_typeof(value->'ownerProgram') IS DISTINCT FROM 'string' OR jsonb_typeof(value->'dataSha256') IS DISTINCT FROM 'string' OR jsonb_typeof(value->'stateSha256') IS DISTINCT FROM 'string' OR
   jsonb_typeof(value->'dataBytes') IS DISTINCT FROM 'number' OR (value->>'dataBytes') !~ '^[0-9]{1,5}$' OR (value->>'dataBytes')::integer>32768 OR
   (value->>'ownerProgram') !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' OR (value->>'dataSha256') !~ '^[a-f0-9]{64}$' OR (value->>'stateSha256') !~ '^[a-f0-9]{64}$')))
  THEN RAISE EXCEPTION 'Invalid corroboration state'; END IF;
 UPDATE watchtower_private.watchtower_candidates SET state='processed',lease_until=NULL,corroboration=evidence,corroborated_at=clock_timestamp()
  WHERE signature=candidate_signature AND lease_version=version AND state='leased' AND lease_until>clock_timestamp();
 GET DIAGNOSTICS changed=ROW_COUNT;RETURN changed=1;
END;
$$;
REVOKE ALL ON FUNCTION watchtower_private.finish_watchtower_candidate(text,bigint,jsonb) FROM PUBLIC;

CREATE TABLE watchtower_private.watchtower_rpc_allowance (
 scope text PRIMARY KEY CHECK (scope IN ('preview','production')),
 day_utc date NOT NULL,
 month_utc date NOT NULL CHECK (month_utc=date_trunc('month',month_utc::timestamp)::date),
 day_requests integer NOT NULL CHECK (day_requests BETWEEN 0 AND 100000),
 month_requests integer NOT NULL CHECK (month_requests BETWEEN 0 AND 100000)
);
REVOKE ALL ON watchtower_private.watchtower_rpc_allowance FROM PUBLIC;

-- No public/member access, including explicit grants installed by platform defaults.
ALTER TABLE watchtower_private.watchtower_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchtower_private.watchtower_candidates FORCE ROW LEVEL SECURITY;
ALTER TABLE watchtower_private.watchtower_rpc_allowance ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchtower_private.watchtower_rpc_allowance FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA watchtower_private FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA watchtower_private FROM PUBLIC;
DO $access$ DECLARE member_role text; BEGIN
 FOR member_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role') LOOP
  EXECUTE format('REVOKE ALL ON SCHEMA watchtower_private FROM %I', member_role);
  EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA watchtower_private FROM %I', member_role);
  EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA watchtower_private FROM %I', member_role);
 END LOOP;
END $access$;
ALTER DEFAULT PRIVILEGES IN SCHEMA watchtower_private REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
