// Canonical name-based catalog snapshot of fixed disposable schemas only.
// No password hash or arbitrary role/schema input is returned.
import assert from 'node:assert/strict';
export const REPLACEMENT_DOMAINS=Object.freeze({
 member:{schemas:['public','auth','alliance_avatar'],roles:['anon','authenticated','service_role','alliance_avatar_owner','alliance_avatar_executor'],tables:11},
 journal:{schemas:['alliance_journal'],roles:['anon','authenticated','service_role','alliance_journal_owner','alliance_journal_executor'],tables:3},
 control:{schemas:['alliance_control'],roles:['anon','authenticated','service_role','alliance_control_owner','alliance_control_reader','alliance_control_operator','alliance_control_anchor_writer'],tables:2},
 'account-history':{schemas:['alliance_account'],roles:['anon','authenticated','service_role','alliance_account_owner','alliance_account_reader','alliance_account_writer','alliance_account_operator'],tables:2},
 'account-ack':{schemas:['alliance_account'],roles:['anon','authenticated','service_role','alliance_account_owner','alliance_account_reader','alliance_account_writer','alliance_account_operator'],tables:1}
});
export function replacementSecurity(admin,domain){
 if(process.env.ALLIANCE_AVATAR_SERVER_TEST_CONFIRM!=='disposable_server_fixture'||!Object.hasOwn(REPLACEMENT_DOMAINS,domain))throw Error('Wrong replacement security fixture');
 const {schemas,roles}=REPLACEMENT_DOMAINS[domain],quoted=xs=>xs.map(x=>"'"+x+"'").join(','),ns=quoted(schemas),rs=quoted(roles);
 // ACL OIDs vary across fresh clusters. Preserve each named grantor/grantee,
 // privilege and grant option; do not compare raw OID-bearing aclitem strings.
 // PostgreSQL NULL ACLs mean acldefault(type,owner), not an empty grant set.
 // pg_dump/restore can materialize that equivalent default explicitly.
 const acl=value=>`(select coalesce(jsonb_agg(jsonb_build_array(coalesce(g.rolname,'PUBLIC'),r.rolname,a.privilege_type,a.is_grantable) order by coalesce(g.rolname,'PUBLIC'),r.rolname,a.privilege_type,a.is_grantable),'[]'::jsonb) from pg_catalog.aclexplode(${value}) a left join pg_catalog.pg_roles g on g.oid=a.grantee join pg_catalog.pg_roles r on r.oid=a.grantor)`;
 const result=JSON.parse(admin(`set timezone='UTC';set datestyle='ISO, YMD';select jsonb_build_object(
 'roles',(select jsonb_agg(jsonb_build_array(rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolreplication,rolbypassrls,rolconnlimit,rolconfig,rolvaliduntil) order by rolname) from pg_catalog.pg_roles where rolname in(${rs})),
 'memberships',(select coalesce(jsonb_agg(jsonb_build_array(r.rolname,m.rolname,g.rolname,a.admin_option,a.inherit_option,a.set_option) order by r.rolname,m.rolname,g.rolname),'[]'::jsonb) from pg_catalog.pg_auth_members a join pg_catalog.pg_roles r on r.oid=a.roleid join pg_catalog.pg_roles m on m.oid=a.member join pg_catalog.pg_roles g on g.oid=a.grantor where r.rolname in(${rs}) or m.rolname in(${rs})),
 'schemas',(select jsonb_agg(jsonb_build_array(n.nspname,r.rolname,${acl("coalesce(n.nspacl,pg_catalog.acldefault('n',n.nspowner))")}) order by n.nspname) from pg_catalog.pg_namespace n join pg_catalog.pg_roles r on r.oid=n.nspowner where n.nspname in(${ns})),
 'tables',(select jsonb_agg(jsonb_build_array(n.nspname,c.relname,r.rolname,c.relrowsecurity,c.relforcerowsecurity,${acl("coalesce(c.relacl,pg_catalog.acldefault('r',c.relowner))")}) order by n.nspname,c.relname) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace join pg_catalog.pg_roles r on r.oid=c.relowner where n.nspname in(${ns}) and c.relkind='r'),
 'columns',(select jsonb_agg(jsonb_build_array(n.nspname,c.relname,a.attnum,a.attname,pg_catalog.format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attidentity,a.attgenerated,pg_catalog.pg_get_expr(d.adbin,d.adrelid),${acl("coalesce(a.attacl,pg_catalog.acldefault('c',c.relowner))")}) order by n.nspname,c.relname,a.attnum) from pg_catalog.pg_attribute a join pg_catalog.pg_class c on c.oid=a.attrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace left join pg_catalog.pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum where n.nspname in(${ns}) and c.relkind='r' and a.attnum>0 and not a.attisdropped),
 'functions',(select jsonb_agg(jsonb_build_array(n.nspname,p.proname,pg_catalog.pg_get_function_identity_arguments(p.oid),r.rolname,p.prosecdef,p.proconfig,pg_catalog.pg_get_functiondef(p.oid),${acl("coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))")}) order by n.nspname,p.proname,pg_catalog.pg_get_function_identity_arguments(p.oid)) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace join pg_catalog.pg_roles r on r.oid=p.proowner where n.nspname in(${ns})),
 'policies',(select jsonb_agg(jsonb_build_array(schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check) order by schemaname,tablename,policyname) from pg_catalog.pg_policies where schemaname in(${ns})),
 'constraints',(select jsonb_agg(jsonb_build_array(n.nspname,c.relname,k.conname,pg_catalog.pg_get_constraintdef(k.oid,true)) order by n.nspname,c.relname,k.conname) from pg_catalog.pg_constraint k join pg_catalog.pg_class c on c.oid=k.conrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname in(${ns})),
 'indexes',(select jsonb_agg(jsonb_build_array(schemaname,tablename,indexname,indexdef) order by schemaname,tablename,indexname) from pg_catalog.pg_indexes where schemaname in(${ns})),
 'triggers',(select jsonb_agg(jsonb_build_array(n.nspname,c.relname,t.tgname,t.tgenabled,pg_catalog.pg_get_triggerdef(t.oid)) order by n.nspname,c.relname,t.tgname) from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid=t.tgrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname in(${ns}) and not t.tgisinternal),
 'defaults',(select jsonb_agg(jsonb_build_array(r.rolname,coalesce(n.nspname,''),d.defaclobjtype,${acl('d.defaclacl')}) order by r.rolname,coalesce(n.nspname,''),d.defaclobjtype) from pg_catalog.pg_default_acl d join pg_catalog.pg_roles r on r.oid=d.defaclrole left join pg_catalog.pg_namespace n on n.oid=d.defaclnamespace where r.rolname in(${rs}) or n.nspname in(${ns})),
 'effective',(select jsonb_agg(jsonb_build_array(r.rolname,n.nspname,c.relname,k,has_table_privilege(r.rolname,c.oid,k)) order by r.rolname,n.nspname,c.relname,k) from pg_catalog.pg_roles r cross join pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) k where r.rolname in(${rs}) and n.nspname in(${ns}) and c.relkind='r')
 );`).split('\n').map(x=>x.trim()).find(x=>x.startsWith('{')));
 assert.equal(result.roles.length,roles.length);assert.deepEqual(result.memberships,[]);assert.equal(result.tables.length,REPLACEMENT_DOMAINS[domain].tables);
 for(const row of result.roles){assert.equal(row[1],false);for(const n of [3,4,5,6])assert.equal(row[n],false);assert.equal(row[7],-1);assert.equal(row[8],null);assert.equal(row[9],null);assert.equal(row[2],!row[0].startsWith('alliance_'));}
 return result;
}
export function recreateReplacementRoles(admin,domain){
 if(!Object.hasOwn(REPLACEMENT_DOMAINS,domain)||process.env.ALLIANCE_AVATAR_SERVER_TEST_CONFIRM!=='disposable_server_fixture')throw Error('Wrong replacement role fixture');
 const roles=REPLACEMENT_DOMAINS[domain].roles;
 // Entirely literal allowlisted role names/attributes, never execute recovered
 // role SQL, credentials, memberships or ALTER SYSTEM settings.
 admin('begin;'+roles.map(r=>`create role ${r} nologin ${r.startsWith('alliance_')?'noinherit':'inherit'} nosuperuser nocreatedb nocreaterole noreplication nobypassrls password null;`).join('')+'commit;');
 assert.match(admin(`select count(*) from pg_catalog.pg_authid where rolname in(${roles.map(r=>"'"+r+"'").join(',')}) and not rolcanlogin and rolpassword is null;`),new RegExp('\\n\\s*'+roles.length+'\\s*\\n'));
}
export function recreateReplacementDefaults(admin,domain){
 if(!Object.hasOwn(REPLACEMENT_DOMAINS,domain)||process.env.ALLIANCE_AVATAR_SERVER_TEST_CONFIRM!=='disposable_server_fixture')throw Error('Wrong replacement defaults fixture');
 const owner={member:'alliance_avatar_owner',journal:'alliance_journal_owner',control:'alliance_control_owner','account-history':'alliance_account_owner','account-ack':'alliance_account_owner'}[domain];
 // Schema-selected dumps are not the authority for global future-object policy.
 // This fixed password-free reconstruction comes from reviewed candidate DDL.
 admin(`alter default privileges for role ${owner} revoke execute on functions from public;`);
}
