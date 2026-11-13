// Deferred production composition only. Importing this module reads no private
// file and creates no pool. Purpose-bound stores supply their explicit validated
// credentials, roles and TLS configuration; no driver/environment discovery here.
export async function createMemberPgPoolFactory({enabled=false}={}){
 if(enabled!==true)return undefined;
 try{
  const {Pool}=await import('pg');
  if(typeof Pool!=='function')throw Error();
  return configuration=>new Pool(configuration);
 }catch{throw Error('alliance_member_pool_factory_unavailable');}
}
