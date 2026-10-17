-- Owner/operator read-only report for an already prepared Watchtower schema.
-- Run with an authorized catalog-reading identity, never expose as a public RPC.
-- It reads aggregate state/catalogs only; no secrets, bodies or transaction identities.
WITH checks AS (
 SELECT
  (SELECT count(*)=4 AND bool_and(NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls AND NOT rolinherit AND (rolname NOT LIKE '%_login' OR rolconnlimit=2))
   FROM pg_roles WHERE rolname IN ('watchtower_intake','watchtower_worker','watchtower_intake_login','watchtower_worker_login')) AS roles_locked,
  (SELECT count(*)=2 AND bool_and(relrowsecurity AND relforcerowsecurity)
   FROM pg_class WHERE relnamespace='watchtower_private'::regnamespace AND relkind='r'
   AND relname IN ('watchtower_candidates','watchtower_rpc_allowance')) AS forced_rls,
  (SELECT bool_and(NOT has_schema_privilege(r,'watchtower_private','USAGE'))
   FROM unnest(ARRAY['anon','authenticated','service_role']) roles(r)) AS platform_access_denied,
  (SELECT count(*)=2 AND bool_and(NOT m.admin_option AND NOT m.inherit_option AND m.set_option AND
    (cap.rolname,login.rolname) IN (('watchtower_intake','watchtower_intake_login'),('watchtower_worker','watchtower_worker_login')))
   FROM pg_auth_members m JOIN pg_roles cap ON cap.oid=m.roleid JOIN pg_roles login ON login.oid=m.member
   WHERE login.rolname IN ('watchtower_intake_login','watchtower_worker_login')) AS credential_memberships_restricted,
  (SELECT count(*)=2 FROM pg_trigger WHERE tgrelid='watchtower_private.watchtower_candidates'::regclass
   AND tgname IN ('watchtower_candidate_identity','watchtower_pilot_candidate_bound') AND tgenabled='O') AS guards_present,
  (SELECT count(*)=0 FROM pg_proc WHERE pronamespace='watchtower_private'::regnamespace AND prosecdef) AS no_definer_functions,
  (SELECT count(*)=0 FROM pg_publication_tables WHERE schemaname='watchtower_private') AS no_realtime_publication,
  NOT has_column_privilege('watchtower_intake','watchtower_private.watchtower_candidates','state','UPDATE')
   AND NOT has_function_privilege('watchtower_intake','watchtower_private.claim_watchtower_candidate()','EXECUTE')
   AND NOT has_table_privilege('watchtower_intake','watchtower_private.watchtower_rpc_allowance','SELECT') AS intake_separated,
  NOT has_function_privilege('watchtower_worker','watchtower_private.enqueue_watchtower_candidates(jsonb)','EXECUTE')
   AND NOT has_column_privilege('watchtower_worker','watchtower_private.watchtower_candidates','slot','UPDATE')
   AND NOT has_table_privilege('watchtower_worker','watchtower_private.watchtower_candidates','DELETE') AS worker_separated
), counts AS (
 SELECT count(*) AS candidates,
  count(*) FILTER (WHERE state='pending') AS pending,
  count(*) FILTER (WHERE state='leased') AS leased,
  count(*) FILTER (WHERE state='processed') AS processed,
  count(*) FILTER (WHERE state='exhausted') AS exhausted
 FROM watchtower_private.watchtower_candidates
)
SELECT jsonb_build_object(
 'schema',1,'observedAtUtc',to_char(statement_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
 'status',CASE WHEN roles_locked AND forced_rls AND platform_access_denied AND credential_memberships_restricted
  AND guards_present AND no_definer_functions AND no_realtime_publication AND intake_separated AND worker_separated
  AND candidates<=100 THEN 'storage_prepared_credentials_locked' ELSE 'review_required' END,
 'checks',to_jsonb(checks),'candidateCounts',to_jsonb(counts),
 'allowanceRows',(SELECT count(*) FROM watchtower_private.watchtower_rpc_allowance),
 'activationProven',false,
 'limitations',jsonb_build_array('Catalog checks do not validate guard source or full role/other-database access.',
  'No endpoint, TLS credential, provider delivery, billing, recovery or retention acceptance is proved.',
  'Empty receipt storage does not establish zero on-chain activity or complete monitoring coverage.')
 ) AS readiness FROM checks CROSS JOIN counts;
