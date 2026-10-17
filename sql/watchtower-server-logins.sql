-- Reviewed preparation only. No passwords or LOGIN activation here.
-- Apply through recorded migration tooling only after owner approval.
BEGIN;
DO $$
BEGIN
  IF (SELECT count(*) FROM pg_roles WHERE rolname IN ('watchtower_intake','watchtower_worker')
      AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
      AND NOT rolreplication AND NOT rolbypassrls) <> 2 THEN
    RAISE EXCEPTION 'Expected restricted Watchtower capability roles';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('watchtower_intake_login','watchtower_worker_login')) THEN
    RAISE EXCEPTION 'Watchtower credential roles already exist; inspect before retry';
  END IF;
END;
$$;
CREATE ROLE watchtower_intake_login NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 2;
CREATE ROLE watchtower_worker_login NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 2;
GRANT watchtower_intake TO watchtower_intake_login WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;
GRANT watchtower_worker TO watchtower_worker_login WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;
-- No direct table/schema grants, cross-role membership, ownership or shared-account change.
-- PUBLIC privileges still apply; inspect them rather than changing global defaults here.
ALTER ROLE watchtower_intake_login SET statement_timeout = '4s';
ALTER ROLE watchtower_intake_login SET lock_timeout = '1s';
ALTER ROLE watchtower_intake_login SET idle_in_transaction_session_timeout = '5s';
ALTER ROLE watchtower_worker_login SET statement_timeout = '4s';
ALTER ROLE watchtower_worker_login SET lock_timeout = '1s';
ALTER ROLE watchtower_worker_login SET idle_in_transaction_session_timeout = '5s';
COMMIT;
