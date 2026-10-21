// Explicit managed-provider candidate. No discovery, grants, credentials or apply.
const roles=['anchor_writer','operator','owner','reader'].map(r=>'alliance_control_'+r);
const list=roles.map(r=>`'${r}'`).join(',');
// Catalogue OIDs avoid resolving private object names using installer privileges.
// Names/argument OIDs below are fixed source constants, never caller input.
const relation=name=>`(SELECT c.oid FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='alliance_control' AND c.relname='${name}')`;
const routine=(name,args)=>`(SELECT p.oid FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='alliance_control' AND p.proname='${name}' AND p.proargtypes='${args}'::oidvector)`;
export const MANAGED_CONTROL_ENVIRONMENT_SQL=`SELECT jsonb_build_object(
 'bootstrap',(SELECT oid=10 AND rolsuper FROM pg_catalog.pg_roles WHERE rolname='supabase_admin'),
 'schemas',(SELECT count(*)=2 AND bool_and(pg_catalog.pg_get_userbyid(n.nspowner)='supabase_admin') FROM pg_catalog.pg_namespace n WHERE n.nspname IN('auth','storage')),
 'roles',(SELECT count(*)=4 AND bool_and(NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication AND NOT rolinherit AND (rolname<>'alliance_control_owner' OR NOT rolcanlogin)) FROM pg_catalog.pg_roles WHERE rolname IN(${list})),
 'private',NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles r CROSS JOIN pg_catalog.pg_namespace n WHERE r.rolname IN(${list}) AND n.nspname IN('auth','storage') AND (has_schema_privilege(r.oid,n.oid,'USAGE,CREATE') OR EXISTS(SELECT 1 FROM pg_catalog.pg_class c WHERE c.relnamespace=n.oid AND c.relkind IN('r','p','v','m','f','S') AND CASE WHEN c.relkind='S' THEN has_sequence_privilege(r.oid,c.oid,'USAGE,SELECT,UPDATE') ELSE has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES') END))),
 'dedicated',to_regnamespace('alliance_account') IS NULL AND to_regnamespace('alliance_avatar') IS NULL AND to_regnamespace('alliance_journal') IS NULL AND to_regclass('public.alliance_member_owners') IS NULL,
 'controlRights',NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname IN('alliance_control_reader','alliance_control_operator','alliance_control_anchor_writer') AND (
 has_schema_privilege(r.oid,'alliance_control','CREATE') OR NOT has_schema_privilege(r.oid,'alliance_control','USAGE')
 OR coalesce(has_table_privilege(r.oid,${relation('policy')},'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),true) OR coalesce(has_any_column_privilege(r.oid,${relation('policy')},'SELECT,INSERT,UPDATE,REFERENCES'),true)
 OR coalesce(has_table_privilege(r.oid,${relation('removal_anchor')},'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),true) OR coalesce(has_any_column_privilege(r.oid,${relation('removal_anchor')},'SELECT,INSERT,UPDATE,REFERENCES'),true)
 OR has_function_privilege(r.oid,${routine('read_policy','25 25 2950')},'EXECUTE') IS DISTINCT FROM (r.rolname IN('alliance_control_reader','alliance_control_operator'))
 OR has_function_privilege(r.oid,${routine('read_anchor','25 25 2950')},'EXECUTE') IS DISTINCT FROM (r.rolname IN('alliance_control_reader','alliance_control_anchor_writer'))
 OR has_function_privilege(r.oid,${routine('advance_anchor','25 25 2950 23 25 23 25 3802')},'EXECUTE') IS DISTINCT FROM (r.rolname='alliance_control_anchor_writer')
 OR has_function_privilege(r.oid,${routine('bootstrap','25 25 2950 2950')},'EXECUTE') IS DISTINCT FROM (r.rolname='alliance_control_operator')
 OR has_function_privilege(r.oid,${routine('transition','25 25 2950 23 25 2950 3802 3802')},'EXECUTE') IS DISTINCT FROM (r.rolname='alliance_control_operator')
 OR has_function_privilege(r.oid,${routine('transition_startup_only','25 25 2950 23 25 2950 3802 3802')},'EXECUTE') IS DISTINCT FROM false)),
 'publicEmpty',NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN('r','p','v','m','f','S')) AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'),
 'memberships',(SELECT jsonb_agg(v ORDER BY v->>0,v->>1,v->>2) FROM (
 SELECT jsonb_build_array(pg_catalog.pg_get_userbyid(m.roleid),pg_catalog.pg_get_userbyid(m.member),pg_catalog.pg_get_userbyid(m.grantor),m.admin_option,m.inherit_option,m.set_option) AS v FROM pg_catalog.pg_auth_members m
 WHERE m.roleid IN(SELECT oid FROM pg_catalog.pg_roles WHERE rolname IN(${list})) OR m.member IN(SELECT oid FROM pg_catalog.pg_roles WHERE rolname IN(${list})) LIMIT 9
 ) x))`;
export function controlDeploymentProfile(profile){
 if(!['strict','supabase-managed'].includes(profile))throw Error('alliance_control_unavailable');return profile;
}
export function managedControlEnvironment(){return {bootstrap:true,schemas:true,roles:true,private:true,dedicated:true,controlRights:true,publicEmpty:true,memberships:roles.map(r=>[r,'postgres','supabase_admin',true,false,false])};}
// Fixed source comparison only; no live baseline is learned or persisted.
export const MANAGED_CONTROL_ISOLATION=`((${MANAGED_CONTROL_ENVIRONMENT_SQL}) IS NOT DISTINCT FROM '${JSON.stringify(managedControlEnvironment())}'::jsonb)`;
