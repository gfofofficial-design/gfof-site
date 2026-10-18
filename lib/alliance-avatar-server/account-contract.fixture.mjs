// Synthetic unit catalogue only. Real PostgreSQL catalogue drift is tested in
// the confirmed native driver; this data is not an attestation capability.
import manifest from './account-contract-data.mjs';
export function accountContractFixture(domain){
 const owner='alliance_account_owner',roles=['operator','owner','reader','writer'].map(r=>'alliance_account_'+r),read=domain==='history'?'snapshot':'ack_read',write=domain==='history'?'append':'ack_advance',operator=domain==='history'?['history_bootstrap','history_mode']:['ack_bootstrap','ack_mode'];
 return {
  version:17,path:'pg_catalog',schemaOwner:owner,
  schemaAcl:[...roles.map(r=>[r,owner,'USAGE',false]),[owner,owner,'CREATE',false]].sort((a,b)=>a[0].localeCompare(b[0])||a[2].localeCompare(b[2])),
  roles:roles.map(r=>[r,true]),tables:(domain==='history'?['entries','history_control']:['ack_control']).map(name=>({name,owner,kind:'r',rls:true,force:true,private:true,triggers:true})),
  functions:structuredClone(manifest[domain]).map(f=>({...f,owner,config:['search_path=""'],kind:'f',parallel:'u',strict:false,leakproof:false,set:false,plain:true,
   acl:[owner,...(f.name===read?['alliance_account_reader','alliance_account_writer']:f.name===write?['alliance_account_writer']:operator.includes(f.name)?['alliance_account_operator']:[])].sort().map(r=>[r,owner,false])}))
 };
}
