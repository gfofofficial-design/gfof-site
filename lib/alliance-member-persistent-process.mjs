// One explicitly owned process. The installed closed-bootstrap mode has no
// private application factory and cannot be promoted by a management request.
import {createPersistentAllianceHost} from './alliance-member-finite-host.mjs';
import {createPersistentAllianceHttpsServer} from './alliance-member-persistent-https.mjs';
import {createPersistentAllianceLocalControl} from './alliance-member-local-control.mjs';

const fail=()=>Error('alliance_persistent_process_unavailable');
export function createPersistentAllianceProcess({enabled=false,generationEnabled=false,origin,installation,window,openApplication,readTlsMaterial,socketPath,bind='127.0.0.1',port=443}={}){
 if(enabled===false)return Object.freeze({listen:async()=>({state:'disabled'}),reloadTls:async()=>false,close:async()=>{}});
 if(enabled!==true||typeof generationEnabled!=='boolean'||generationEnabled===false&&openApplication!==undefined)throw fail();
 let application,https,control,attempted=false,closed=false,closing;
 function close(){
  if(closing)return closing;closed=true;
  closing=Promise.all([control?.close(),https?.close(),application?.close()]).then(()=>undefined);return closing;
 }
 try{
  application=generationEnabled?createPersistentAllianceHost({enabled:true,origin,expectedInstallation:installation,window,openApplication}):createPersistentAllianceHost();
  https=createPersistentAllianceHttpsServer({enabled:true,origin,installation,readTlsMaterial,bind,port,applicationHost:application});
  control=createPersistentAllianceLocalControl({enabled:true,socketPath,installation,applicationHost:application});
 }catch{void close().catch(()=>{});throw fail();}
 return Object.freeze({
  async listen(){
   if(attempted||closed)throw fail();attempted=true;
   try{
    await control.listen();if(closed)throw fail();const bound=await https.listen();if(closed)throw fail();
    return {state:'persistent_process_listening',port:bound.port,generationEnabled,preparation:'not_started'};
   }catch{try{await close();}catch{}throw fail();}
  },reloadTls:()=>https.reloadTls(),close,
 });
}
