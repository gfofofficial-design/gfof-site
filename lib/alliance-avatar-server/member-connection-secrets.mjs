// Default-off read-only credential source. No discovery, write, rotation, retry,
// disk/env secret lookup, plaintext diagnostics or cross-invocation value cache.
import {SecretsManagerClient,GetSecretValueCommand} from '@aws-sdk/client-secrets-manager';
import {X509Certificate} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {controlExact as exact,controlRef as ref,controlUuid as uuid} from './control-policy.mjs';
import {createLambdaRuntimeClient} from './aws-runtime-credentials.mjs';
const fail=()=>Error('alliance_member_connections_unavailable');
const purposes=['control','journal'];
function review(resource,scope,bindings){
 if(!exact(resource,['accountId','region','functionName','version'])||!Object.values(resource).every(v=>typeof v==='string')||!/^\d{12}$/.test(resource.accountId)||!/^us-(east|west)-[12]$/.test(resource.region)||
  !/^alliance-member-authority-[a-z0-9-]{1,39}$/.test(resource.functionName)||!/^[1-9]\d{0,8}$/.test(resource.version)||
  !exact(scope,['memberProjectRef','journalProjectRef','controlProjectRef','epoch'])||!uuid(scope.epoch)||
  !['memberProjectRef','journalProjectRef','controlProjectRef'].every(k=>ref(scope[k]))||new Set([scope.memberProjectRef,scope.journalProjectRef,scope.controlProjectRef]).size!==3||!exact(bindings,purposes))throw fail();
 const copy=structuredClone(bindings),pem=/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g;
 for(const purpose of purposes){
  const v=copy[purpose];
  if(!exact(v,['secretArn','versionId','ca'])||typeof v.secretArn!=='string'||
   !new RegExp('^arn:aws:secretsmanager:'+resource.region+':'+resource.accountId+':secret:alliance-member-'+purpose+'-reader-[a-z0-9-]{1,40}-[A-Za-z0-9]{6}$').test(v.secretArn)||
   typeof v.versionId!=='string'||!/^[a-f0-9-]{32,64}$/.test(v.versionId)||typeof v.ca!=='string'||v.ca.length>65536)throw fail();
  const blocks=v.ca.match(pem);if(!blocks?.length||v.ca.replace(pem,'').trim())throw fail();for(const block of blocks)new X509Certificate(block);
 }
 if(copy.control.secretArn===copy.journal.secretArn)throw fail();
 return {resource:{...resource},scope:{...scope},bindings:copy};
}
export function reviewMemberConnectionSecrets({resource,scope,bindings}={}){
 try{const c=review(resource,scope,bindings);return {resource:c.resource,scope:c.scope,bindings:c.bindings};}catch{throw fail();}
}
function value(reply,purpose,c){
 const binding=c.bindings[purpose];
 if(reply?.$metadata?.httpStatusCode!==200||reply.$metadata.attempts!==1||reply.$metadata.totalRetryDelay!==0||reply.ARN!==binding.secretArn||
  reply.VersionId!==binding.versionId||!Array.isArray(reply.VersionStages)||!reply.VersionStages.includes('AWSCURRENT')||
  reply.SecretBinary!==undefined||typeof reply.SecretString!=='string'||Buffer.byteLength(reply.SecretString)>4096)throw fail();
 const v=JSON.parse(reply.SecretString),role='alliance_'+purpose+'_reader';
 if(JSON.stringify(v)!==reply.SecretString||!exact(v,['format',...Object.keys(c.scope),'purpose','databaseRole','password'])||v.format!==1||
  Object.keys(c.scope).some(k=>v[k]!==c.scope[k])||v.purpose!==purpose||v.databaseRole!==role||
  typeof v.password!=='string'||v.password.length<24||v.password.length>128||Buffer.byteLength(v.password)>512||/[\u0000-\u001f\u007f]/.test(v.password))throw fail();
 return {host:`db.${c.scope[purpose+'ProjectRef']}.supabase.co`,password:v.password,ca:binding.ca};
}
export function createMemberConnectionSecrets({enabled=false,resource,scope,bindings,credentials,credentialSource,openClient,timeoutMs=700}={}){
 if(typeof enabled!=='boolean'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>700)throw fail();
 let c,client,closed=false,active=false,controller;
 if(enabled)try{
  c=review(resource,scope,bindings);if(openClient!==undefined&&typeof openClient!=='function')throw fail();
  const config={region:c.resource.region,endpoint:`https://secretsmanager.${c.resource.region}.amazonaws.com`,maxAttempts:1,retryMode:'standard',endpointDiscoveryEnabled:false,useFipsEndpoint:false,useDualstackEndpoint:false,requestHandler:{connectionTimeout:250,requestTimeout:450,throwOnRequestTimeout:true}};
  client=createLambdaRuntimeClient({profile:'lambda-execution-role',credentials,source:credentialSource,target:c.resource,kind:'member-authority',config,openClient:openClient??(options=>new SecretsManagerClient(options)),timeoutMs:Math.min(650,timeoutMs),maxConcurrent:2});
 }catch{try{client?.destroy();}catch{}throw fail();}
 return Object.freeze({
  async read({signal}={}){
   if(!enabled||closed||active||(signal!==undefined&&!(signal instanceof AbortSignal))||signal?.aborted)throw fail();
   const aborter=new AbortController(),started=performance.now(),abort=()=>aborter.abort();controller=aborter;active=true;
   const stopped=new Promise((_,reject)=>aborter.signal.addEventListener('abort',()=>reject(fail()),{once:true}));
   const timer=setTimeout(abort,timeoutMs);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
   const check=()=>{if(closed||aborter.signal.aborted||performance.now()-started>=timeoutMs)throw fail();};
   try{
    const pairs=await Promise.race([Promise.all(purposes.map(async purpose=>{
     check();const b=c.bindings[purpose];
     const reply=await client.send(new GetSecretValueCommand({SecretId:b.secretArn,VersionId:b.versionId,VersionStage:'AWSCURRENT'}),{abortSignal:aborter.signal});check();
     return [purpose,value(reply,purpose,c)];
    })),stopped]);check();return Object.fromEntries(pairs);
   }catch{throw fail();}
   finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);aborter.abort();controller=undefined;active=false;}
  },
  close(){closed=true;controller?.abort();try{client?.destroy();}catch{}}
 });
}
