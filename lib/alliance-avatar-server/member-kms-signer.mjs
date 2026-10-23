// Disabled, unmounted purpose-bound managed-signing candidate. No key generation,
// import/export, environment lookup, alias discovery, permission change or retry.
import {KMSClient,GetPublicKeyCommand,SignCommand} from '@aws-sdk/client-kms';
import {createPublicKey,verify} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {createLambdaRuntimeClient} from './aws-runtime-credentials.mjs';
import {controlExact as exact,controlRef as ref,controlUuid as uuid,controlHash as hash} from './control-policy.mjs';
import {startupDecisionBytes} from './startup-gate.mjs';
import {deletionWitnessBytes} from './deletion-journal.mjs';
const fail=()=>Error('alliance_member_signer_unavailable');
const ALGORITHM='ED25519_SHA_512',SPEC='ECC_NIST_EDWARDS25519';
const domains={control:'GF-ALLIANCE-STARTUP-DECISION-V1\0',journal:'GF-ALLIANCE-DELETION-WITNESS-V1\0'};
function reviewed({purpose,scope,resource,verificationKey}){
 if(!Object.hasOwn(domains,purpose)||!exact(scope,['memberProjectRef','journalProjectRef','epoch'])||!ref(scope.memberProjectRef)||!ref(scope.journalProjectRef)||scope.memberProjectRef===scope.journalProjectRef||!uuid(scope.epoch)||!hash(verificationKey)||verificationKey==='0'.repeat(64))throw fail();
 if(!exact(resource,['accountId','region','keyArn'])||typeof resource.accountId!=='string'||!/^\d{12}$/.test(resource.accountId)||typeof resource.region!=='string'||!/^us-(east|west)-[12]$/.test(resource.region)||typeof resource.keyArn!=='string'||!new RegExp('^arn:aws:kms:'+resource.region+':'+resource.accountId+':key/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$').test(resource.keyArn))throw fail();
 const key=createPublicKey({format:'jwk',key:{kty:'OKP',crv:'Ed25519',x:Buffer.from(verificationKey,'hex').toString('base64url')}});
 return {purpose,scope:{...scope},resource:{...resource},key,spki:key.export({format:'der',type:'spki'})};
}
function message(raw,c){
 if(!(raw instanceof Uint8Array)||raw.byteLength<1||raw.byteLength>2048)throw fail();
 const bytes=Buffer.from(raw),text=new TextDecoder('utf-8',{fatal:true}).decode(bytes),prefix=domains[c.purpose];
 if(!text.startsWith(prefix))throw fail();const value=JSON.parse(text.slice(prefix.length));
 const canonical=c.purpose==='control'?startupDecisionBytes(value):deletionWitnessBytes(value);
 if(!canonical.equals(bytes)||value.epoch!==c.scope.epoch||
  (c.purpose==='control'?(value.memberProjectRef!==c.scope.memberProjectRef||value.journalProjectRef!==c.scope.journalProjectRef):value.projectRef!==c.scope.memberProjectRef))throw fail();
 const age=Date.now()-Date.parse(value.issuedAt);if(age< -1000||age>=30000)throw fail();return bytes;
}
export function createMemberKmsSigner({enabled=false,purpose,scope,resource,verificationKey,credentials,credentialSource,openClient,timeoutMs=1200}={}){
 if(typeof enabled!=='boolean'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>1200)throw fail();
 let c,client,closed=false,faulted=false,active=false,controller;
 if(enabled)try{
  c=reviewed({purpose,scope,resource,verificationKey});if(openClient!==undefined&&typeof openClient!=='function')throw fail();
  const config={region:c.resource.region,endpoint:`https://kms.${c.resource.region}.amazonaws.com`,maxAttempts:1,retryMode:'standard',endpointDiscoveryEnabled:false,useFipsEndpoint:false,useDualstackEndpoint:false,requestHandler:{connectionTimeout:400,requestTimeout:700,throwOnRequestTimeout:true}};
  client=createLambdaRuntimeClient({profile:'lambda-execution-role',credentials,source:credentialSource,target:c.resource,kind:'member-authority',config,openClient:openClient??(options=>new KMSClient(options)),timeoutMs:Math.min(700,timeoutMs),maxConcurrent:1});
 }catch{try{client?.destroy();}catch{}throw fail();}
 return Object.freeze({
  async signBytes(raw,{signal}={}){
   if(!enabled||closed||faulted||active||(signal!==undefined&&!(signal instanceof AbortSignal))||signal?.aborted)throw fail();
   let bytes;try{bytes=message(raw,c);}catch{throw fail();}
   active=true;const aborter=new AbortController(),started=performance.now(),abort=()=>aborter.abort();controller=aborter;
   const stopped=new Promise((_,reject)=>aborter.signal.addEventListener('abort',()=>reject(fail()),{once:true}));
   const timer=setTimeout(abort,timeoutMs);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
   const check=()=>{if(closed||faulted||aborter.signal.aborted||performance.now()-started>=timeoutMs)throw fail();message(bytes,c);};
   const send=async command=>{
    check();const reply=await Promise.race([Promise.resolve().then(()=>{check();return client.send(command,{abortSignal:aborter.signal});}),stopped]);check();
    if(reply?.$metadata?.httpStatusCode!==200||reply.$metadata.attempts!==1||reply.$metadata.totalRetryDelay!==0)throw fail();return reply;
   };
   try{
    const publicResult=await send(new GetPublicKeyCommand({KeyId:c.resource.keyArn}));
    if(publicResult.KeyId!==c.resource.keyArn||publicResult.KeyUsage!=='SIGN_VERIFY'||publicResult.KeySpec!==SPEC||!(publicResult.PublicKey instanceof Uint8Array)||!Buffer.from(publicResult.PublicKey).equals(c.spki)||!Array.isArray(publicResult.SigningAlgorithms)||publicResult.SigningAlgorithms.length!==2||new Set(publicResult.SigningAlgorithms).size!==2||!publicResult.SigningAlgorithms.includes(ALGORITHM)||!publicResult.SigningAlgorithms.includes('ED25519_PH_SHA_512'))throw fail();
    const result=await send(new SignCommand({KeyId:c.resource.keyArn,Message:Buffer.from(bytes),MessageType:'RAW',SigningAlgorithm:ALGORITHM}));
    if(result.KeyId!==c.resource.keyArn||result.SigningAlgorithm!==ALGORITHM||!(result.Signature instanceof Uint8Array)||result.Signature.byteLength!==64||!verify(null,bytes,c.key,result.Signature))throw fail();
    check();return Buffer.from(result.Signature);
   }catch{faulted=true;try{client?.destroy();}catch{}throw fail();}
   finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);aborter.abort();controller=undefined;active=false;}
  },
  close(){closed=true;controller?.abort();try{client?.destroy();}catch{}}
 });
}
