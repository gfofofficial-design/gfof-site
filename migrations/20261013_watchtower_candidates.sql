-- Review/isolated acceptance only. Do not apply to a live database without approval.
CREATE TABLE public.watchtower_candidates (
 signature text PRIMARY KEY CHECK (signature ~ '^[1-9A-HJ-NP-Za-km-z]{64,88}$'),
 slot bigint NOT NULL CHECK (slot > 0),
 matched_accounts jsonb NOT NULL CHECK (jsonb_typeof(matched_accounts)='array' AND jsonb_array_length(matched_accounts) BETWEEN 1 AND 20),
 first_received timestamptz NOT NULL DEFAULT clock_timestamp(),
 state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','leased','processed','exhausted')),
 attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
 lease_version bigint NOT NULL DEFAULT 0,
 lease_until timestamptz
);
CREATE INDEX watchtower_candidates_work ON public.watchtower_candidates(state,lease_until,first_received);
REVOKE ALL ON public.watchtower_candidates FROM PUBLIC;

CREATE FUNCTION public.enqueue_watchtower_candidates(items jsonb) RETURNS integer
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE item jsonb; existing public.watchtower_candidates%ROWTYPE; accepted integer:=0; candidate_slot bigint;
BEGIN
 IF jsonb_typeof(items) IS DISTINCT FROM 'array' OR jsonb_array_length(items)>100 THEN RAISE EXCEPTION 'Invalid candidates'; END IF;
 -- Canonical lock order avoids reversed-batch lock-order deadlocks.
 FOR item IN SELECT value FROM jsonb_array_elements(items) ORDER BY value->>'signature' LOOP
  IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR
   (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(item) AS keys(key)) IS DISTINCT FROM ARRAY['matchedAccounts','signature','slot']::text[] OR
   jsonb_typeof(item->'signature') IS DISTINCT FROM 'string' OR (item->>'signature') !~ '^[1-9A-HJ-NP-Za-km-z]{64,88}$' OR
   jsonb_typeof(item->'slot') IS DISTINCT FROM 'number' OR (item->>'slot') !~ '^[1-9][0-9]{0,15}$' OR
   jsonb_typeof(item->'matchedAccounts') IS DISTINCT FROM 'array' OR jsonb_array_length(item->'matchedAccounts') NOT BETWEEN 1 AND 20 THEN
   RAISE EXCEPTION 'Invalid candidates';
  END IF;
  candidate_slot:=(item->>'slot')::bigint;
  IF candidate_slot>9007199254740991 OR EXISTS(SELECT 1 FROM jsonb_array_elements(item->'matchedAccounts') AS accounts(value)
    WHERE jsonb_typeof(value) IS DISTINCT FROM 'string' OR (value#>>'{}') !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$') OR
   (SELECT count(DISTINCT value) FROM jsonb_array_elements(item->'matchedAccounts'))<>jsonb_array_length(item->'matchedAccounts') THEN RAISE EXCEPTION 'Invalid candidates'; END IF;
  INSERT INTO public.watchtower_candidates(signature,slot,matched_accounts)
   VALUES(item->>'signature',candidate_slot,item->'matchedAccounts') ON CONFLICT(signature) DO NOTHING;
  SELECT * INTO STRICT existing FROM public.watchtower_candidates WHERE signature=item->>'signature' FOR UPDATE;
  IF existing.slot<>candidate_slot OR existing.matched_accounts<>item->'matchedAccounts' THEN RAISE EXCEPTION 'Conflicting candidate'; END IF;
  accepted:=accepted+1;
 END LOOP;
 RETURN accepted;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_watchtower_candidates(jsonb) FROM PUBLIC;

CREATE FUNCTION public.claim_watchtower_candidate() RETURNS SETOF public.watchtower_candidates
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 UPDATE public.watchtower_candidates SET state='exhausted',lease_until=NULL
  WHERE attempts>=5 AND (state='pending' OR (state='leased' AND lease_until<=clock_timestamp()));
 RETURN QUERY WITH chosen AS (
  SELECT signature FROM public.watchtower_candidates WHERE attempts<5 AND
   (state='pending' OR (state='leased' AND lease_until<=clock_timestamp()))
  ORDER BY first_received,signature FOR UPDATE SKIP LOCKED LIMIT 1
 ) UPDATE public.watchtower_candidates AS c SET state='leased',attempts=c.attempts+1,
  lease_version=c.lease_version+1,lease_until=clock_timestamp()+interval '30 seconds'
 FROM chosen WHERE c.signature=chosen.signature RETURNING c.*;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_watchtower_candidate() FROM PUBLIC;

CREATE FUNCTION public.finish_watchtower_candidate(candidate_signature text,version bigint) RETURNS boolean
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE changed integer;
BEGIN
 UPDATE public.watchtower_candidates SET state='processed',lease_until=NULL
  WHERE signature=candidate_signature AND lease_version=version AND state='leased' AND lease_until>clock_timestamp();
 GET DIAGNOSTICS changed=ROW_COUNT;RETURN changed=1;
END;
$$;
REVOKE ALL ON FUNCTION public.finish_watchtower_candidate(text,bigint) FROM PUBLIC;
