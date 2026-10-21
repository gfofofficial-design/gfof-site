// Explicit source candidate only. Provider administrator power remains trusted;
// this does not authorize a hosted grant, install, login or account service.
export const MANAGED_ACCOUNT_ENVIRONMENT_SQL=`SELECT jsonb_build_object(
 'bootstrap',(SELECT oid=10 AND rolsuper FROM pg_catalog.pg_roles WHERE rolname='supabase_admin'),
 'schemas',(SELECT count(*)=2 AND bool_and(pg_catalog.pg_get_userbyid(n.nspowner)='supabase_admin') FROM pg_catalog.pg_namespace n WHERE n.nspname IN('auth','storage')),
 'private',NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles r CROSS JOIN pg_catalog.pg_namespace n WHERE r.rolname IN('alliance_account_owner','alliance_account_reader','alliance_account_writer','alliance_account_operator') AND n.nspname IN('auth','storage') AND (has_schema_privilege(r.oid,n.oid,'USAGE,CREATE') OR EXISTS(SELECT 1 FROM pg_catalog.pg_class c WHERE c.relnamespace=n.oid AND c.relkind IN('r','p','v','m','f','S') AND CASE WHEN c.relkind='S' THEN has_sequence_privilege(r.oid,c.oid,'USAGE,SELECT,UPDATE') ELSE has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES') END))),
 'publicEmpty',NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN('r','p','v','m','f','S')) AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'),
 'memberships',(SELECT jsonb_agg(v ORDER BY v->>0,v->>1,v->>2) FROM (
  SELECT jsonb_build_array(pg_catalog.pg_get_userbyid(m.roleid),pg_catalog.pg_get_userbyid(m.member),pg_catalog.pg_get_userbyid(m.grantor),m.admin_option,m.inherit_option,m.set_option) AS v FROM pg_catalog.pg_auth_members m
  WHERE m.roleid IN(SELECT oid FROM pg_catalog.pg_roles WHERE rolname IN('alliance_account_owner','alliance_account_reader','alliance_account_writer','alliance_account_operator')) OR m.member IN(SELECT oid FROM pg_catalog.pg_roles WHERE rolname IN('alliance_account_owner','alliance_account_reader','alliance_account_writer','alliance_account_operator')) LIMIT 9
 ) x))`;
export function accountDeploymentProfile(profile){
 if(!['strict','supabase-managed'].includes(profile))throw Error('alliance_account_store_unavailable');
 return profile;
}
export function managedAccountEnvironment(){
 return {bootstrap:true,schemas:true,private:true,publicEmpty:true,memberships:['operator','owner','reader','writer'].map(r=>['alliance_account_'+r,'postgres','supabase_admin',true,false,false])};
}
