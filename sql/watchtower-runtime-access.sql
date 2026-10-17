-- Reviewed runtime permission template. No login, password or role membership.
CREATE ROLE watchtower_intake NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
CREATE ROLE watchtower_worker NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
GRANT USAGE ON SCHEMA watchtower_private TO watchtower_intake, watchtower_worker;

-- Intake needs row locks to reconcile repeated receipts. Grant only a harmless
-- update column; this trigger forbids changing the immutable receipt identity.
CREATE FUNCTION watchtower_private.guard_candidate_identity() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,watchtower_private AS $$
BEGIN
 IF NEW.signature IS DISTINCT FROM OLD.signature OR NEW.slot IS DISTINCT FROM OLD.slot OR NEW.matched_accounts IS DISTINCT FROM OLD.matched_accounts THEN
  RAISE EXCEPTION 'Candidate identity is immutable';
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION watchtower_private.guard_candidate_identity() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER watchtower_candidate_identity BEFORE UPDATE ON watchtower_private.watchtower_candidates
 FOR EACH ROW EXECUTE FUNCTION watchtower_private.guard_candidate_identity();

GRANT SELECT ON watchtower_private.watchtower_candidates TO watchtower_intake,watchtower_worker;
GRANT INSERT(signature,slot,matched_accounts) ON watchtower_private.watchtower_candidates TO watchtower_intake;
GRANT UPDATE(signature) ON watchtower_private.watchtower_candidates TO watchtower_intake;
GRANT UPDATE(state,attempts,lease_version,lease_until,corroboration,corroborated_at) ON watchtower_private.watchtower_candidates TO watchtower_worker;
GRANT EXECUTE ON FUNCTION watchtower_private.enqueue_watchtower_candidates(jsonb) TO watchtower_intake;
GRANT EXECUTE ON FUNCTION watchtower_private.claim_watchtower_candidate() TO watchtower_worker;
GRANT EXECUTE ON FUNCTION watchtower_private.finish_watchtower_candidate(text,bigint,jsonb) TO watchtower_worker;

CREATE POLICY watchtower_candidate_read ON watchtower_private.watchtower_candidates FOR SELECT
 TO watchtower_intake,watchtower_worker USING (true);
CREATE POLICY watchtower_candidate_receive ON watchtower_private.watchtower_candidates FOR INSERT
 TO watchtower_intake WITH CHECK (
 matched_accounts <@ '["Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV","AiRhuw9iFyXiZYv2hqanBK12dckebF4vNMoAzj9Nj9nY","BW6ZUUT5NXxSGMKNAzoMYbqrXy5Dm1ev1ekEgYSXJWX8","EPdpg7AYEzcwudN7TRdEkCGHQeHRrFhoK2yiYxDdGLnv"]'::jsonb
 );
CREATE POLICY watchtower_candidate_lock ON watchtower_private.watchtower_candidates FOR UPDATE
 TO watchtower_intake USING (true) WITH CHECK (true);
CREATE POLICY watchtower_candidate_work ON watchtower_private.watchtower_candidates FOR UPDATE
 TO watchtower_worker USING (true) WITH CHECK (true);

GRANT SELECT,INSERT ON watchtower_private.watchtower_rpc_allowance TO watchtower_worker;
GRANT UPDATE(day_utc,month_utc,day_requests,month_requests) ON watchtower_private.watchtower_rpc_allowance TO watchtower_worker;
CREATE POLICY watchtower_allowance_read ON watchtower_private.watchtower_rpc_allowance FOR SELECT
 TO watchtower_worker USING (scope='production');
CREATE POLICY watchtower_allowance_insert ON watchtower_private.watchtower_rpc_allowance FOR INSERT
 TO watchtower_worker WITH CHECK (scope='production');
CREATE POLICY watchtower_allowance_update ON watchtower_private.watchtower_rpc_allowance FOR UPDATE
 TO watchtower_worker USING (scope='production') WITH CHECK (scope='production');
