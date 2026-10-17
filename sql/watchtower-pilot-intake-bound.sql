-- Separate reviewed preparation: no role activation, password or new grant.
-- Apply once, with all four existing Watchtower roles locked. It changes no rows.
BEGIN;
DO $$
BEGIN
 IF (SELECT count(*) FROM pg_roles WHERE rolname IN
  ('watchtower_intake','watchtower_worker','watchtower_intake_login','watchtower_worker_login')
  AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolbypassrls)<>4 THEN
  RAISE EXCEPTION 'Expected four locked restricted Watchtower roles';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='watchtower_private.watchtower_candidates'::regclass AND relrowsecurity AND relforcerowsecurity) THEN
  RAISE EXCEPTION 'Expected private forced-RLS candidate table';
 END IF;
END;
$$;
LOCK TABLE watchtower_private.watchtower_candidates IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
 IF (SELECT count(*) FROM watchtower_private.watchtower_candidates)>100 THEN
  RAISE EXCEPTION 'Existing candidate count exceeds pilot bound';
 END IF;
END;
$$;

CREATE FUNCTION watchtower_private.guard_pilot_candidate_bound() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,watchtower_private AS $$
BEGIN
 -- Administrative restore/cleanup is separate from the intake capability.
 IF current_user='watchtower_intake' THEN
  IF current_setting('transaction_isolation')<>'read committed' THEN
   RAISE EXCEPTION 'Pilot intake requires read committed';
  END IF;
  -- One transaction-level lock serializes the count and inserts, including
  -- direct INSERT paths. No session lock survives a transaction pooler checkout.
  PERFORM pg_advisory_xact_lock(20261013,112);
  IF NOT EXISTS(SELECT 1 FROM watchtower_private.watchtower_candidates WHERE signature=NEW.signature)
   AND (SELECT count(*) FROM watchtower_private.watchtower_candidates)>=100 THEN
   RAISE EXCEPTION 'Pilot candidate storage bound reached';
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION watchtower_private.guard_pilot_candidate_bound() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER watchtower_pilot_candidate_bound BEFORE INSERT ON watchtower_private.watchtower_candidates
 FOR EACH ROW EXECUTE FUNCTION watchtower_private.guard_pilot_candidate_bound();
COMMIT;
