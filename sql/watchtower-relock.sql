-- Reviewed operator action for the two existing dedicated Watchtower logins.
-- Execute only when closing the owner-authorized trial, after upstream pause.
-- No password, membership, privilege, candidate row or allowance counter changes.
BEGIN;
DO $guard$
BEGIN
 IF (SELECT count(*) FROM pg_roles WHERE rolname IN ('watchtower_intake_login','watchtower_worker_login'))<>2 THEN
  RAISE EXCEPTION 'Expected both dedicated Watchtower logins; inspect before relocking';
 END IF;
END $guard$;
ALTER ROLE watchtower_intake_login NOLOGIN;
ALTER ROLE watchtower_worker_login NOLOGIN;
COMMIT;

-- NOLOGIN refuses new authentication; it does not revoke existing sessions.
-- This counts visible server sessions, not all external pooler/client sessions.
WITH state AS (
 SELECT
  (SELECT count(*)=2 AND bool_and(NOT rolcanlogin) FROM pg_roles
   WHERE rolname IN ('watchtower_intake_login','watchtower_worker_login')) AS logins_locked,
  (SELECT count(*) FROM pg_stat_activity WHERE usename IN ('watchtower_intake_login','watchtower_worker_login')) AS visible_database_sessions
)
SELECT jsonb_build_object('schema',1,
 'status',CASE WHEN logins_locked AND visible_database_sessions=0 THEN 'logins_locked_no_visible_database_sessions' ELSE 'review_required' END,
 'loginsLocked',logins_locked,'visibleDatabaseSessions',visible_database_sessions,
 'upstreamPauseProven',false,'oldDeploymentCleanupProven',false,
 'limitations',jsonb_build_array('NOLOGIN does not cancel existing database or pooler sessions.',
 'Provider pause, deployment expiry/cleanup and secret custody need separate verification.',
 'No sessions are terminated and no receipt data or allowance counters are deleted.')) AS closure FROM state;
