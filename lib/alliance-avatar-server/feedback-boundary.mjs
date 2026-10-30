// Fixed reviewed source fingerprints. Never learns an allowlist from a database.
import shapes from './feedback-shapes.json' with {type:'json'};
import {COMMUNITY_BOUNDARY_SQL} from './community-boundary.mjs';
const entry=new Set(['read_session','list_session','change_session','recovery_inventory']);
const quote=v=>"'"+v.replaceAll("'","''")+"'";
const functions=shapes.functions.map(f=>`EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
 WHERE n.nspname='alliance_feedback' AND p.proname=${quote(f.name)} AND oidvectortypes(p.proargtypes)=${quote(f.arguments)} AND p.prorettype=${quote(f.result)}::regtype
 AND pg_get_userbyid(p.proowner)='alliance_avatar_owner' AND p.prosecdef=${f.definer} AND l.lanname=${quote(f.language)} AND p.provolatile=${quote(f.name==='snapshot'?'s':'v')}
 AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')=${quote(f.bodySha256)} AND cardinality(p.proconfig)=${f.settings}
 AND NOT EXISTS(SELECT 1 FROM unnest(p.proconfig) x WHERE lower(x) NOT IN('search_path=','search_path=""','timezone=utc','datestyle=iso, ymd'))
 AND has_function_privilege('alliance_avatar_executor',p.oid,'EXECUTE')=${entry.has(f.name)}
 AND NOT EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantor<>p.proowner OR a.privilege_type<>'EXECUTE' OR a.is_grantable
  OR NOT(a.grantee=p.proowner${entry.has(f.name)?" OR a.grantee=(SELECT oid FROM pg_roles WHERE rolname='alliance_avatar_executor')":''})))`).join('\n AND ');
export const FEEDBACK_BOUNDARY_SQL=`SELECT (
 (SELECT community_boundary FROM (${COMMUNITY_BOUNDARY_SQL}) prior)
 AND EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='alliance_feedback' AND pg_get_userbyid(nspowner)='alliance_avatar_owner')
 AND has_schema_privilege('alliance_avatar_executor','alliance_feedback','USAGE') AND NOT has_schema_privilege('alliance_avatar_executor','alliance_feedback','CREATE')
 AND NOT EXISTS(SELECT 1 FROM pg_roles r WHERE r.rolname IN('anon','authenticated','service_role') AND has_schema_privilege(r.oid,'alliance_feedback','USAGE,CREATE'))
 AND (SELECT count(*)=4 AND bool_and(c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity AND pg_get_userbyid(c.relowner)='alliance_avatar_owner'
  AND c.relname IN('control','ideas','supports','reports')) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='alliance_feedback' AND c.relkind NOT IN('i','I'))
 AND NOT EXISTS(SELECT 1 FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='alliance_feedback' AND c.relkind='r'
  AND r.rolname IN('anon','authenticated','service_role','alliance_avatar_executor') AND (has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES')))
 AND (SELECT count(*)=5 AND bool_and(k.confdeltype='c' AND k.convalidated AND k.confrelid IN('public.alliance_profiles'::regclass,'alliance_feedback.ideas'::regclass)) FROM pg_constraint k JOIN pg_namespace n ON n.oid=k.connamespace WHERE n.nspname='alliance_feedback' AND k.contype='f')
 AND (SELECT count(*)=6 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='alliance_feedback')
 AND ${functions}
) AS feedback_boundary`;
export const FEEDBACK_SOURCE_SHA256=shapes.sourceSha256;
