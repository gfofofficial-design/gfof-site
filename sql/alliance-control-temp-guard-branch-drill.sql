-- UNAPPLIED BRANCH-ONLY, ROLLBACK-ONLY acceptance candidate, October 20.
-- Run only after independently verifying a disposable Control Pilot branch ID
-- differs from the parent. Do not run against the parent/production project.
-- Fresh branches may create the four NOLOGIN test roles inside this rollback.
-- No passwords, LOGIN, PUBLIC database revocations, template1 changes or runtime
-- acceptance-policy relaxation. This file intentionally has no COMMIT.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='750ms';
DO $preflight$
DECLARE role_count integer;
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' OR current_database()<>'postgres'
 OR current_setting('server_version_num')::integer/10000 NOT IN(17,18)
 OR to_regnamespace('alliance_control_temp_guard_trial') IS NOT NULL
 OR to_regnamespace('alliance_control_trial_definer') IS NOT NULL
 OR EXISTS(SELECT 1 FROM pg_event_trigger WHERE evtname='alliance_control_temp_guard_trial')
 THEN RAISE EXCEPTION 'Control temp guard branch preflight refused'; END IF;
 SELECT count(*) INTO role_count FROM pg_roles WHERE rolname IN('alliance_control_owner','alliance_control_reader','alliance_control_operator','alliance_control_anchor_writer');
 IF role_count=0 THEN
  CREATE ROLE alliance_control_owner NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION;
  CREATE ROLE alliance_control_reader NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION;
  CREATE ROLE alliance_control_operator NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION;
  CREATE ROLE alliance_control_anchor_writer NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION;
 ELSIF role_count<>4 THEN RAISE EXCEPTION 'Partial control role inventory refused'; END IF;
 SELECT count(*) INTO role_count FROM pg_roles
 WHERE rolname IN('alliance_control_owner','alliance_control_reader','alliance_control_operator','alliance_control_anchor_writer')
 AND NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole
 AND NOT rolcreatedb AND NOT rolreplication AND NOT rolinherit;
 IF role_count<>4 OR EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename IN
 ('alliance_control_owner','alliance_control_reader','alliance_control_operator','alliance_control_anchor_writer'))
 OR EXISTS(SELECT 1 FROM pg_class WHERE relpersistence='t' AND relowner IN
 (SELECT oid FROM pg_roles WHERE rolname IN('alliance_control_owner','alliance_control_reader','alliance_control_operator','alliance_control_anchor_writer')))
 THEN RAISE EXCEPTION 'Locked drained control roles required'; END IF;
 IF (SELECT count(*) FROM pg_auth_members m WHERE
  (m.roleid IN(SELECT oid FROM pg_roles WHERE rolname IN('alliance_control_owner','alliance_control_reader','alliance_control_operator','alliance_control_anchor_writer'))
   OR m.member IN(SELECT oid FROM pg_roles WHERE rolname IN('alliance_control_owner','alliance_control_reader','alliance_control_operator','alliance_control_anchor_writer'))))<>4
 OR EXISTS(SELECT 1 FROM pg_auth_members m WHERE
  (m.roleid IN(SELECT oid FROM pg_roles WHERE rolname IN('alliance_control_owner','alliance_control_reader','alliance_control_operator','alliance_control_anchor_writer'))
   OR m.member IN(SELECT oid FROM pg_roles WHERE rolname IN('alliance_control_owner','alliance_control_reader','alliance_control_operator','alliance_control_anchor_writer')))
  AND (pg_get_userbyid(m.member)<>'postgres' OR pg_get_userbyid(m.grantor)<>'supabase_admin' OR NOT m.admin_option OR m.inherit_option OR m.set_option))
 THEN RAISE EXCEPTION 'Exact original creator memberships required'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles r WHERE r.rolname IN
 ('alliance_control_owner','alliance_control_reader','alliance_control_operator','alliance_control_anchor_writer')
 AND NOT has_database_privilege(r.oid,current_database(),'TEMPORARY'))
 THEN RAISE EXCEPTION 'This drill requires the unchanged effective PUBLIC TEMP case'; END IF;
END $preflight$;
CREATE SCHEMA alliance_control_temp_guard_trial AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA alliance_control_temp_guard_trial FROM PUBLIC,anon,authenticated,service_role,
 alliance_control_owner,alliance_control_reader,alliance_control_operator,alliance_control_anchor_writer;
CREATE FUNCTION alliance_control_temp_guard_trial.block_temp_objects()
RETURNS event_trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $guard$
DECLARE command record;
BEGIN
 IF current_user NOT IN('alliance_control_owner','alliance_control_reader','alliance_control_operator','alliance_control_anchor_writer') THEN RETURN; END IF;
 FOR command IN SELECT * FROM pg_catalog.pg_event_trigger_ddl_commands() LOOP
  IF command.schema_name='pg_temp' OR command.schema_name ~ '^pg_temp_[0-9]+$' THEN
   RAISE EXCEPTION 'alliance_control_temp_objects_denied' USING ERRCODE='42501';
  END IF;
 END LOOP;
END $guard$;
REVOKE ALL ON FUNCTION alliance_control_temp_guard_trial.block_temp_objects() FROM PUBLIC,anon,authenticated,service_role,
 alliance_control_owner,alliance_control_reader,alliance_control_operator,alliance_control_anchor_writer;
CREATE EVENT TRIGGER alliance_control_temp_guard_trial ON ddl_command_end
 EXECUTE FUNCTION alliance_control_temp_guard_trial.block_temp_objects();
ALTER EVENT TRIGGER alliance_control_temp_guard_trial ENABLE ALWAYS;
-- Temporary SET edges are for this branch transaction only. The original
-- postgres/supabase_admin ADMIN-only edges remain; every trial edge rolls back.
GRANT alliance_control_owner,alliance_control_reader,alliance_control_operator,alliance_control_anchor_writer
 TO postgres WITH ADMIN FALSE,INHERIT FALSE,SET TRUE;

SET LOCAL ROLE alliance_control_owner;
DO $checks$
DECLARE statement text;detail text;
BEGIN
 IF NOT pg_catalog.has_database_privilege(current_user,pg_catalog.current_database(),'TEMPORARY') THEN
  RAISE EXCEPTION 'TEMP privilege was unexpectedly removed'; END IF;
 FOREACH statement IN ARRAY ARRAY[
  'CREATE TEMP TABLE gf_trial_temp_table(id integer)',
  'CREATE TEMP TABLE gf_trial_temp_as AS SELECT 1 AS id',
  'SELECT 1 AS id INTO TEMP gf_trial_temp_into',
  'CREATE TEMP VIEW gf_trial_temp_view AS SELECT 1 AS id',
  'CREATE TEMP SEQUENCE gf_trial_temp_sequence'
 ] LOOP
  BEGIN
   EXECUTE statement;
   RAISE EXCEPTION 'Expected guard refusal for %',statement;
  EXCEPTION WHEN insufficient_privilege THEN
   GET STACKED DIAGNOSTICS detail=MESSAGE_TEXT;
   IF detail<>'alliance_control_temp_objects_denied' THEN
    RAISE EXCEPTION 'Refusal did not come from the reviewed guard'; END IF;
  END;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE relnamespace=pg_catalog.pg_my_temp_schema()) THEN
  RAISE EXCEPTION 'Temporary objects survived a refused statement'; END IF;
 BEGIN
  EXECUTE 'ALTER EVENT TRIGGER alliance_control_temp_guard_trial DISABLE';
  RAISE EXCEPTION 'Restricted role disabled the guard';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM pg_catalog.set_config('session_replication_role','replica',true);
  RAISE EXCEPTION 'Restricted role changed replication mode';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $checks$;
RESET ROLE;

SET LOCAL ROLE alliance_control_reader;
DO $checks$
DECLARE statement text;detail text;
BEGIN
 IF NOT pg_catalog.has_database_privilege(current_user,pg_catalog.current_database(),'TEMPORARY') THEN
  RAISE EXCEPTION 'TEMP privilege was unexpectedly removed'; END IF;
 FOREACH statement IN ARRAY ARRAY[
  'CREATE TEMP TABLE gf_trial_temp_table(id integer)',
  'CREATE TEMP TABLE gf_trial_temp_as AS SELECT 1 AS id',
  'SELECT 1 AS id INTO TEMP gf_trial_temp_into',
  'CREATE TEMP VIEW gf_trial_temp_view AS SELECT 1 AS id',
  'CREATE TEMP SEQUENCE gf_trial_temp_sequence'
 ] LOOP
  BEGIN
   EXECUTE statement;
   RAISE EXCEPTION 'Expected guard refusal for %',statement;
  EXCEPTION WHEN insufficient_privilege THEN
   GET STACKED DIAGNOSTICS detail=MESSAGE_TEXT;
   IF detail<>'alliance_control_temp_objects_denied' THEN
    RAISE EXCEPTION 'Refusal did not come from the reviewed guard'; END IF;
  END;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE relnamespace=pg_catalog.pg_my_temp_schema()) THEN
  RAISE EXCEPTION 'Temporary objects survived a refused statement'; END IF;
 BEGIN
  EXECUTE 'ALTER EVENT TRIGGER alliance_control_temp_guard_trial DISABLE';
  RAISE EXCEPTION 'Restricted role disabled the guard';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM pg_catalog.set_config('session_replication_role','replica',true);
  RAISE EXCEPTION 'Restricted role changed replication mode';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $checks$;
RESET ROLE;

SET LOCAL ROLE alliance_control_operator;
DO $checks$
DECLARE statement text;detail text;
BEGIN
 IF NOT pg_catalog.has_database_privilege(current_user,pg_catalog.current_database(),'TEMPORARY') THEN
  RAISE EXCEPTION 'TEMP privilege was unexpectedly removed'; END IF;
 FOREACH statement IN ARRAY ARRAY[
  'CREATE TEMP TABLE gf_trial_temp_table(id integer)',
  'CREATE TEMP TABLE gf_trial_temp_as AS SELECT 1 AS id',
  'SELECT 1 AS id INTO TEMP gf_trial_temp_into',
  'CREATE TEMP VIEW gf_trial_temp_view AS SELECT 1 AS id',
  'CREATE TEMP SEQUENCE gf_trial_temp_sequence'
 ] LOOP
  BEGIN
   EXECUTE statement;
   RAISE EXCEPTION 'Expected guard refusal for %',statement;
  EXCEPTION WHEN insufficient_privilege THEN
   GET STACKED DIAGNOSTICS detail=MESSAGE_TEXT;
   IF detail<>'alliance_control_temp_objects_denied' THEN
    RAISE EXCEPTION 'Refusal did not come from the reviewed guard'; END IF;
  END;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE relnamespace=pg_catalog.pg_my_temp_schema()) THEN
  RAISE EXCEPTION 'Temporary objects survived a refused statement'; END IF;
 BEGIN
  EXECUTE 'ALTER EVENT TRIGGER alliance_control_temp_guard_trial DISABLE';
  RAISE EXCEPTION 'Restricted role disabled the guard';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM pg_catalog.set_config('session_replication_role','replica',true);
  RAISE EXCEPTION 'Restricted role changed replication mode';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $checks$;
RESET ROLE;

SET LOCAL ROLE alliance_control_anchor_writer;
DO $checks$
DECLARE statement text;detail text;
BEGIN
 IF NOT pg_catalog.has_database_privilege(current_user,pg_catalog.current_database(),'TEMPORARY') THEN
  RAISE EXCEPTION 'TEMP privilege was unexpectedly removed'; END IF;
 FOREACH statement IN ARRAY ARRAY[
  'CREATE TEMP TABLE gf_trial_temp_table(id integer)',
  'CREATE TEMP TABLE gf_trial_temp_as AS SELECT 1 AS id',
  'SELECT 1 AS id INTO TEMP gf_trial_temp_into',
  'CREATE TEMP VIEW gf_trial_temp_view AS SELECT 1 AS id',
  'CREATE TEMP SEQUENCE gf_trial_temp_sequence'
 ] LOOP
  BEGIN
   EXECUTE statement;
   RAISE EXCEPTION 'Expected guard refusal for %',statement;
  EXCEPTION WHEN insufficient_privilege THEN
   GET STACKED DIAGNOSTICS detail=MESSAGE_TEXT;
   IF detail<>'alliance_control_temp_objects_denied' THEN
    RAISE EXCEPTION 'Refusal did not come from the reviewed guard'; END IF;
  END;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE relnamespace=pg_catalog.pg_my_temp_schema()) THEN
  RAISE EXCEPTION 'Temporary objects survived a refused statement'; END IF;
 BEGIN
  EXECUTE 'ALTER EVENT TRIGGER alliance_control_temp_guard_trial DISABLE';
  RAISE EXCEPTION 'Restricted role disabled the guard';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM pg_catalog.set_config('session_replication_role','replica',true);
  RAISE EXCEPTION 'Restricted role changed replication mode';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $checks$;
RESET ROLE;

-- Confirm a SECURITY DEFINER seam owned by a restricted role still uses that
-- restricted current_user inside this SECURITY INVOKER event trigger.
CREATE SCHEMA alliance_control_trial_definer AUTHORIZATION alliance_control_owner;
SET LOCAL ROLE alliance_control_owner;
CREATE FUNCTION alliance_control_trial_definer.gf_trial_temp_definer() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $definer$
BEGIN CREATE TEMP TABLE gf_trial_definer_table(id integer); END $definer$;
GRANT EXECUTE ON FUNCTION alliance_control_trial_definer.gf_trial_temp_definer() TO postgres;
RESET ROLE;
DO $seam$
DECLARE detail text;
BEGIN
 BEGIN
  PERFORM alliance_control_trial_definer.gf_trial_temp_definer();
  RAISE EXCEPTION 'Expected definer-owner guard refusal';
 EXCEPTION WHEN insufficient_privilege THEN
  GET STACKED DIAGNOSTICS detail=MESSAGE_TEXT;
  IF detail<>'alliance_control_temp_objects_denied' THEN RAISE EXCEPTION 'Unexpected definer refusal'; END IF;
 END;
END $seam$;
-- Ordinary postgres creation remains available; managed-service health still
-- needs separate hosted acceptance rather than inference from this control case.
CREATE TEMP TABLE gf_trial_postgres_allowed(id integer);
INSERT INTO gf_trial_postgres_allowed VALUES(1);
DO $control$ BEGIN
 IF (SELECT count(*) FROM gf_trial_postgres_allowed)<>1 THEN RAISE EXCEPTION 'Unrestricted control failed'; END IF;
END $control$;
DROP TABLE gf_trial_postgres_allowed;
SELECT 'Control temp guard branch assertions reached; installation and trial changes will roll back.' AS result;
ROLLBACK;
