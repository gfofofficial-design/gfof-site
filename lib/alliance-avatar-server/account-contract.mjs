// Fixed reviewed SQL contract, not a caller-provided allowlist or live attestation
// service. Digest covers source after CRLF->LF only; never trim or reformat SQL.
import {isDeepStrictEqual} from 'node:util';
import manifest from './account-contract-data.mjs';
import {controlExact as exact} from './control-policy.mjs';
import {accountDeploymentProfile,MANAGED_ACCOUNT_ENVIRONMENT_SQL,managedAccountEnvironment} from './account-managed.mjs';
const owner='alliance_account_owner',prefix='alliance_account_',fail=()=>Error('alliance_account_contract_unavailable');
const expected=structuredClone(manifest);
const roles=['operator','owner','reader','writer'].map(r=>prefix+r);
export const ACCOUNT_CONTRACT_SQL=`WITH functions AS (
 SELECT p.*,l.lanname,pg_catalog.pg_get_userbyid(p.proowner) AS owner_name
 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang
 WHERE n.nspname='alliance_account' ORDER BY p.proname,pg_catalog.oidvectortypes(p.proargtypes) LIMIT 9
), tables AS (
 SELECT c.* FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='alliance_account' AND c.relkind IN('r','p','v','m','f','S') ORDER BY c.relname LIMIT 4
)
SELECT jsonb_build_object(
 'version',current_setting('server_version_num')::integer / 10000,
 'path',current_setting('search_path'),
 'schemaOwner',(SELECT pg_catalog.pg_get_userbyid(n.nspowner) FROM pg_catalog.pg_namespace n WHERE n.nspname='alliance_account'),
 'schemaAcl',(SELECT jsonb_agg(v ORDER BY v->>0,v->>2) FROM (
  SELECT jsonb_build_array(CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END,pg_catalog.pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable) AS v
  FROM pg_catalog.pg_namespace n CROSS JOIN LATERAL pg_catalog.aclexplode(coalesce(n.nspacl,pg_catalog.acldefault('n',n.nspowner))) a WHERE n.nspname='alliance_account' LIMIT 9
 ) x),
 'roles',(SELECT jsonb_agg(jsonb_build_array(r.rolname,
  NOT r.rolsuper AND NOT r.rolinherit AND NOT r.rolcreatedb AND NOT r.rolcreaterole AND NOT r.rolreplication AND NOT r.rolbypassrls AND (r.rolname<>'alliance_account_owner' OR NOT r.rolcanlogin)
  AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m WHERE m.roleid=r.oid OR m.member=r.oid)) ORDER BY r.rolname)
  FROM pg_catalog.pg_roles r WHERE r.rolname IN('alliance_account_operator','alliance_account_owner','alliance_account_reader','alliance_account_writer')),
 'tables',(SELECT jsonb_agg(jsonb_build_object('name',c.relname,'owner',pg_catalog.pg_get_userbyid(c.relowner),'kind',c.relkind,'rls',c.relrowsecurity,'force',c.relforcerowsecurity,
  'private',NOT EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault('r',c.relowner))) a WHERE a.grantee<>c.relowner OR a.grantor<>c.relowner)
   AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute col CROSS JOIN LATERAL pg_catalog.aclexplode(col.attacl) a WHERE col.attrelid=c.oid AND (a.grantee<>c.relowner OR a.grantor<>c.relowner)),
  'triggers',NOT EXISTS(SELECT 1 FROM pg_catalog.pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal)) ORDER BY c.relname) FROM tables c),
 'functions',(SELECT jsonb_agg(jsonb_build_object('name',p.proname,'args',pg_catalog.oidvectortypes(p.proargtypes),'names',p.proargnames,'returns',pg_catalog.pg_get_function_result(p.oid),'language',p.lanname,
  'definer',p.prosecdef,'volatility',p.provolatile,'sha256',encode(sha256(convert_to(replace(p.prosrc,E'\\r\\n',E'\\n'),'UTF8')),'hex'),
  'owner',p.owner_name,'config',p.proconfig,'kind',p.prokind,'parallel',p.proparallel,'strict',p.proisstrict,'leakproof',p.proleakproof,'set',p.proretset,
  'plain',p.probin IS NULL AND p.prosqlbody IS NULL AND p.proargmodes IS NULL AND p.proallargtypes IS NULL AND p.proargdefaults IS NULL AND p.protrftypes IS NULL AND p.pronargdefaults=0 AND p.provariadic=0 AND p.prosupport=0,
  'acl',(SELECT jsonb_agg(v ORDER BY v->>0) FROM (
   SELECT jsonb_build_array(CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END,pg_catalog.pg_get_userbyid(a.grantor),a.is_grantable) AS v
   FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a LIMIT 9
  ) x)) ORDER BY p.proname,pg_catalog.oidvectortypes(p.proargtypes)) FROM functions p)
) AS contract`;
// The strict SQL and expected function/table contract remain unchanged. Only
// this explicit profile substitutes membership verification with the exact
// provider-management edges embedded in the same catalogue snapshot.
const isolation='AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m WHERE m.roleid=r.oid OR m.member=r.oid)';
const managedSql=ACCOUNT_CONTRACT_SQL.replace(isolation,'AND true').replace("'version',current_setting",`'managed',(${MANAGED_ACCOUNT_ENVIRONMENT_SQL}),\n 'version',current_setting`);
export function accountContractSQL(profile='strict'){return accountDeploymentProfile(profile)==='strict'?ACCOUNT_CONTRACT_SQL:managedSql;}
function acl(domain,name){
 const read=domain==='history'?'snapshot':'ack_read',write=domain==='history'?'append':'ack_advance',operator=domain==='history'?['history_bootstrap','history_mode']:['ack_bootstrap','ack_mode'];
 const grantees=[owner,...(name===read?[prefix+'reader',prefix+'writer']:name===write?[prefix+'writer']:operator.includes(name)?[prefix+'operator']:[])];
 return grantees.sort().map(r=>[r,owner,false]);
}
export function verifyAccountContract(value,domain,profile='strict'){
 try{
  accountDeploymentProfile(profile);const managed=profile==='supabase-managed';
  if(!['history','ack'].includes(domain)||!exact(value,['version','path','schemaOwner','schemaAcl','roles','tables','functions',...(managed?['managed']:[])])||![17,18].includes(value.version)||value.path!=='pg_catalog'||managed&&!isDeepStrictEqual(value.managed,managedAccountEnvironment()))throw fail();
  const tables=(domain==='history'?['entries','history_control']:['ack_control']).map(name=>({name,owner,kind:'r',rls:true,force:true,private:true,triggers:true}));
  const schemaAcl=[...roles.map(r=>[r,owner,'USAGE',false]),[owner,owner,'CREATE',false]].sort((a,b)=>a[0].localeCompare(b[0])||a[2].localeCompare(b[2]));
  const functions=expected[domain].map(f=>({...f,owner,config:['search_path=""'],kind:'f',parallel:'u',strict:false,leakproof:false,set:false,plain:true,acl:acl(domain,f.name)}));
  if(value.schemaOwner!==owner||!isDeepStrictEqual(value.schemaAcl,schemaAcl)||!isDeepStrictEqual(value.roles,roles.map(r=>[r,true]))||!isDeepStrictEqual(value.tables,tables)||!isDeepStrictEqual(value.functions,functions))throw fail();
  return true;
 }catch{throw fail();}
}
