// OFFLINE preparation only. No connection, credential lookup, apply or mode change.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=name=>readFileSync(new URL('../../sql/'+name,import.meta.url),'utf8').replace(/\r\n/g,'\n');
const files=['alliance-deletion-journal-store-candidate.sql','alliance-journal-admission-candidate.sql','alliance-journal-recovery-inventory-candidate.sql'];
export const journalExtensionManifest=()=>files.map(name=>({name,sha256:createHash('sha256').update(read(name)).digest('hex')}));
// Source-generated, synthetic PostgreSQL catalogue, never learned from a provider.
const shapes=()=>JSON.parse(readFileSync(new URL('./journal-managed-shapes.json',import.meta.url),'utf8'));
const acl=(value,defaults)=>`(SELECT coalesce(jsonb_agg(jsonb_build_array(CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable) ORDER BY a.grantee=0,pg_get_userbyid(a.grantee),pg_get_userbyid(a.grantor),a.privilege_type),'[]') FROM aclexplode(coalesce(${value},${defaults})) a)`;
export const JOURNAL_MANAGED_CATALOGUE_SQL=`SELECT jsonb_build_object(
 'schemaOwner',(SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname='alliance_journal'),
 'schemaAcl',(SELECT ${acl('n.nspacl',"acldefault('n',n.nspowner)")} FROM pg_namespace n WHERE nspname='alliance_journal'),
 'tables',(SELECT coalesce(jsonb_agg(jsonb_build_object(
  'name',c.relname,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'forcedRls',c.relforcerowsecurity,
  'acl',${acl('c.relacl',"acldefault('r',c.relowner)")},
  'columns',(SELECT jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid),${acl('a.attacl','NULL::aclitem[]')}) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
  -- PG18 adds named NOT NULL catalogue rows; attnotnull above checks the same
  -- requirement on both supported majors without learning a provider exception.
  'constraints',(SELECT jsonb_agg(jsonb_build_array(k.conname,k.contype,pg_get_constraintdef(k.oid,true),k.convalidated) ORDER BY k.conname) FROM pg_constraint k WHERE k.conrelid=c.oid AND k.contype<>'n'),
  'indexes',(SELECT jsonb_agg(pg_get_indexdef(i.indexrelid) ORDER BY pg_get_indexdef(i.indexrelid)) FROM pg_index i WHERE i.indrelid=c.oid),
  'policies',(SELECT jsonb_agg(jsonb_build_array(p.polname,p.polcmd,p.polpermissive,(SELECT jsonb_agg(pg_get_userbyid(x) ORDER BY pg_get_userbyid(x)) FROM unnest(p.polroles) x),pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid)) ORDER BY p.polname) FROM pg_policy p WHERE p.polrelid=c.oid)
 ) ORDER BY c.relname),'[]') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='alliance_journal' AND c.relkind NOT IN('i','I')),
 'functions',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),'result',pg_get_function_result(p.oid),'owner',pg_get_userbyid(p.proowner),'language',l.lanname,'definer',p.prosecdef,'volatility',p.provolatile,'config',p.proconfig,'acl',${acl('p.proacl',"acldefault('f',p.proowner)")},'bodySha256',encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')) ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)),'[]') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang WHERE n.nspname='alliance_journal'))`;
const roleNames="'alliance_journal_owner','alliance_journal_executor'";
const closed=`(SELECT count(*)=1 AND bool_and(id AND NOT enabled AND project_ref IS NULL AND epoch IS NULL AND sequence=0 AND sha256=repeat('0',64)) FROM alliance_journal.control) AND NOT EXISTS(SELECT 1 FROM alliance_journal.entries)`;
export function journalManagedBoundarySql(stage='base'){
 if(!['base','extended','authority-reader'].includes(stage))throw Error('journal_managed_stage_unavailable');
 const expected=shapes(),reader=stage==='authority-reader',names=reader?roleNames+",'alliance_journal_reader'":roleNames;
 if(reader){
  expected[stage]=structuredClone(expected.extended);
  const grant=['alliance_journal_reader','alliance_journal_owner'];
  expected[stage].schemaAcl.push([...grant,'USAGE',false]);
  for(const fn of expected[stage].functions)if(['tip','records'].includes(fn.name))fn.acl.push([...grant,'EXECUTE',false]);
  const sort=rows=>rows.sort((a,b)=>a[0].localeCompare(b[0])||a[1].localeCompare(b[1])||a[2].localeCompare(b[2]));
  sort(expected[stage].schemaAcl);for(const fn of expected[stage].functions)sort(fn.acl);
 }
 if(JSON.stringify(expected.sources)!==JSON.stringify(journalExtensionManifest()))throw Error('journal_managed_source_changed');
 const entrypoints=stage==='base'?['tip','lookup','append','records']:['tip','lookup','append','records','admit','admission','recovery_inventory'];
 return `(
 (${JOURNAL_MANAGED_CATALOGUE_SQL}) IS NOT DISTINCT FROM '${JSON.stringify(expected[stage]).replaceAll("'","''")}'::jsonb
 AND (SELECT oid=10 AND rolsuper FROM pg_roles WHERE rolname='supabase_admin')
 AND (SELECT count(*)=2 AND bool_and(pg_get_userbyid(nspowner)='supabase_admin') FROM pg_namespace WHERE nspname IN('auth','storage'))
 AND (SELECT count(*)=${reader?3:2} AND bool_and(NOT rolcanlogin AND NOT rolsuper AND NOT rolinherit AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls) FROM pg_roles WHERE rolname IN(${names}))
 AND (SELECT jsonb_agg(jsonb_build_array(pg_get_userbyid(m.roleid),pg_get_userbyid(m.member),pg_get_userbyid(m.grantor),m.admin_option,m.inherit_option,m.set_option) ORDER BY pg_get_userbyid(m.roleid)) FROM pg_auth_members m WHERE m.roleid IN(SELECT oid FROM pg_roles WHERE rolname IN(${names})) OR m.member IN(SELECT oid FROM pg_roles WHERE rolname IN(${names})))='${JSON.stringify(['alliance_journal_executor','alliance_journal_owner',...(reader?['alliance_journal_reader']:[])].map(n=>[n,'postgres','supabase_admin',true,false,false]))}'::jsonb
 AND NOT pg_has_role('postgres','alliance_journal_owner','SET')
 AND NOT has_schema_privilege('postgres','alliance_journal','CREATE')
 AND (NOT has_schema_privilege('postgres','alliance_journal','USAGE') OR pg_has_role('postgres','pg_read_all_data','USAGE'))
 AND NOT EXISTS(SELECT 1 FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname='alliance_journal' AND a.grantee IN(0,(SELECT oid FROM pg_roles WHERE rolname='postgres')) AND a.privilege_type IN('USAGE','CREATE'))
 AND NOT EXISTS(SELECT 1 FROM pg_namespace n CROSS JOIN pg_roles r WHERE n.nspname IN('auth','storage') AND r.rolname IN(${names}) AND (has_schema_privilege(r.oid,n.oid,'USAGE,CREATE') OR EXISTS(SELECT 1 FROM pg_class c WHERE c.relnamespace=n.oid AND c.relkind IN('r','p','v','m','f','S') AND CASE WHEN c.relkind='S' THEN has_sequence_privilege(r.oid,c.oid,'USAGE,SELECT,UPDATE') ELSE has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES') END)))
 AND NOT EXISTS(SELECT 1 FROM pg_namespace n CROSS JOIN pg_roles r WHERE n.nspname='alliance_journal' AND r.rolname IN('anon','authenticated','service_role','alliance_journal_executor'${reader?",'alliance_journal_reader'":''}) AND (has_schema_privilege(r.oid,n.oid,'CREATE') OR has_schema_privilege(r.oid,n.oid,'USAGE') IS DISTINCT FROM (r.rolname IN('alliance_journal_executor'${reader?",'alliance_journal_reader'":''})) OR EXISTS(SELECT 1 FROM pg_class c WHERE c.relnamespace=n.oid AND c.relkind IN('r','p','v','m','f','S') AND CASE WHEN c.relkind='S' THEN has_sequence_privilege(r.oid,c.oid,'USAGE,SELECT,UPDATE') ELSE has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES') END) OR EXISTS(SELECT 1 FROM pg_proc p WHERE p.pronamespace=n.oid AND has_function_privilege(r.oid,p.oid,'EXECUTE') IS DISTINCT FROM ((r.rolname='alliance_journal_executor' AND p.proname IN(${entrypoints.map(v=>"'"+v+"'").join(',')}))${reader?" OR (r.rolname='alliance_journal_reader' AND p.proname IN('tip','records'))":''}))))
 AND NOT EXISTS(SELECT 1 FROM pg_namespace n JOIN pg_class c ON c.relnamespace=n.oid CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE n.nspname='alliance_journal' AND c.relkind='r' AND a.grantee=0)
 AND NOT EXISTS(SELECT 1 FROM pg_namespace n JOIN pg_proc p ON p.pronamespace=n.oid CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE n.nspname='alliance_journal' AND a.grantee=0 AND a.privilege_type='EXECUTE')
 )`;
}
function identity(){return `current_database()='postgres' AND current_user='postgres' AND session_user='postgres'
 AND (SELECT NOT rolsuper AND rolcreaterole FROM pg_roles WHERE rolname='postgres')
 AND current_setting('server_version_num')::integer/10000 IN(17,18)
 AND to_regnamespace('alliance_avatar') IS NULL AND to_regnamespace('alliance_account') IS NULL AND to_regnamespace('alliance_control') IS NULL
 AND to_regclass('public.alliance_member_owners') IS NULL
 AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN('r','p','v','m','f','S'))
 AND NOT EXISTS(SELECT 1 FROM auth.users) AND NOT EXISTS(SELECT 1 FROM auth.identities)
 AND NOT EXISTS(SELECT 1 FROM storage.objects) AND NOT EXISTS(SELECT 1 FROM storage.buckets)`;}
export function managedJournalExtensionSql(){
 return `-- UNAPPLIED closed extension on an existing, dedicated managed journal.
BEGIN;
SET LOCAL search_path=pg_catalog;
DO $preflight$ BEGIN
 IF (${identity()}) IS DISTINCT FROM true OR (${journalManagedBoundarySql('base')}) IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'Managed journal extension preflight refused';END IF;
END $preflight$;
GRANT alliance_journal_owner TO postgres WITH INHERIT false, SET true;
SET LOCAL ROLE alliance_journal_owner;
DO $closed$ BEGIN IF (${closed}) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Empty closed journal required';END IF;END $closed$;
${read(files[1])}
${read(files[2])}
REVOKE alliance_journal_owner FROM postgres GRANTED BY postgres;
DO $verify$ BEGIN
 IF (${journalManagedBoundarySql('extended')}) IS DISTINCT FROM true
 OR (${closed}) IS DISTINCT FROM true OR EXISTS(SELECT 1 FROM alliance_journal.control WHERE admission_enabled)
 OR EXISTS(SELECT 1 FROM alliance_journal.admissions)
 THEN RAISE EXCEPTION 'Managed journal extension verification refused';END IF;
END $verify$;
COMMIT;
`;
}
export function managedJournalClosedInspectionSql(){
 return `BEGIN;
SET LOCAL search_path=pg_catalog;
DO $identity$ BEGIN
 IF (${identity()}) IS DISTINCT FROM true OR (${journalManagedBoundarySql('extended')}) IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'Managed journal inspection refused';END IF;
END $identity$;
GRANT alliance_journal_owner TO postgres WITH INHERIT false, SET true;
SET LOCAL ROLE alliance_journal_owner;
DO $closed$ BEGIN
 IF (${closed}) IS DISTINCT FROM true OR EXISTS(SELECT 1 FROM alliance_journal.control WHERE admission_enabled)
 OR EXISTS(SELECT 1 FROM alliance_journal.admissions) THEN RAISE EXCEPTION 'Empty closed journal required';END IF;
END $closed$;
SELECT jsonb_build_object('closed',true,'configured',false,'sequence',0,'entries',(SELECT count(*) FROM alliance_journal.entries),'admissions',(SELECT count(*) FROM alliance_journal.admissions)) AS closed_inventory;
RESET ROLE;
REVOKE alliance_journal_owner FROM postgres GRANTED BY postgres;
ROLLBACK;
`;
}

// UNAPPLIED: one additional locked/password-free, read-only journal capability.
// Existing schema/functions/data/role authority are pinned before and after.
export function managedJournalReaderExtensionSql(){
 return `BEGIN;
SET LOCAL search_path=pg_catalog;
DO $preflight$ BEGIN
 IF (${identity()}) IS DISTINCT FROM true OR (${journalManagedBoundarySql('extended')}) IS DISTINCT FROM true
 OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname='alliance_journal_reader')
 THEN RAISE EXCEPTION 'Managed journal reader preflight refused';END IF;
END $preflight$;
CREATE ROLE alliance_journal_reader NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT alliance_journal_owner TO postgres WITH INHERIT false, SET true;
SET LOCAL ROLE alliance_journal_owner;
DO $closed$ BEGIN
 IF (${closed}) IS DISTINCT FROM true OR EXISTS(SELECT 1 FROM alliance_journal.control WHERE admission_enabled)
 OR EXISTS(SELECT 1 FROM alliance_journal.admissions) THEN RAISE EXCEPTION 'Empty closed journal required';END IF;
END $closed$;
GRANT USAGE ON SCHEMA alliance_journal TO alliance_journal_reader;
GRANT EXECUTE ON FUNCTION alliance_journal.tip(text,uuid),alliance_journal.records(text,uuid,integer,text) TO alliance_journal_reader;
RESET ROLE;
REVOKE alliance_journal_owner FROM postgres GRANTED BY postgres;
DO $verify$ BEGIN
 IF (${journalManagedBoundarySql('authority-reader')}) IS DISTINCT FROM true
 OR (${closed}) IS DISTINCT FROM true OR EXISTS(SELECT 1 FROM alliance_journal.control WHERE admission_enabled)
 OR EXISTS(SELECT 1 FROM alliance_journal.admissions)
 OR NOT EXISTS(SELECT 1 FROM pg_authid WHERE rolname='alliance_journal_reader' AND NOT rolcanlogin AND rolpassword IS NULL AND rolvaliduntil IS NULL)
 THEN RAISE EXCEPTION 'Managed journal reader verification refused';END IF;
END $verify$;
COMMIT;
`;
}
export function managedJournalReaderInspectionSql(){
 return `BEGIN READ ONLY;
SET LOCAL search_path=pg_catalog;
SELECT (${identity()}) AND (${journalManagedBoundarySql('authority-reader')})
 AND (${closed}) AND NOT EXISTS(SELECT 1 FROM alliance_journal.control WHERE admission_enabled)
 AND NOT EXISTS(SELECT 1 FROM alliance_journal.admissions)
 AND EXISTS(SELECT 1 FROM pg_authid WHERE rolname='alliance_journal_reader' AND NOT rolcanlogin AND rolpassword IS NULL AND rolvaliduntil IS NULL)
 AND NOT EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename='alliance_journal_reader') AS reader_locked_boundary;
ROLLBACK;
`;
}
