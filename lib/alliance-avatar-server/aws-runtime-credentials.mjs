// AWS-side factories only. No environment/files/metadata lookup, STS hop, cache,
// credential persistence or fake expiration. Injected readers are a trust boundary.
import {Agent} from 'node:https';
import {performance} from 'node:perf_hooks';
import {controlExact as exact} from './control-policy.mjs';
const providers=new WeakMap(),fail=()=>Error('alliance_aws_runtime_unavailable');
function binding(value,kind){
 if(!exact(value,['accountId','region','functionName','version'])||typeof value.accountId!=='string'||!/^\d{12}$/.test(value.accountId)||typeof value.region!=='string'||!/^us-(east|west)-[12]$/.test(value.region)||typeof value.functionName!=='string'||!new RegExp('^alliance-account-'+kind+'-[a-z0-9-]{1,37}$').test(value.functionName)||typeof value.version!=='string'||!/^[1-9]\d{0,8}$/.test(value.version))throw fail();
 return Object.freeze({...value});
}
function temporary(value){
 if(!exact(value,['accessKeyId','secretAccessKey','sessionToken'])||typeof value.accessKeyId!=='string'||!/^ASIA[A-Z0-9]{16}$/.test(value.accessKeyId)||typeof value.secretAccessKey!=='string'||!/^[-A-Za-z0-9/+=]{40}$/.test(value.secretAccessKey)||typeof value.sessionToken!=='string'||!/^[-A-Za-z0-9/+=._]{16,8192}$/.test(value.sessionToken))throw fail();
 return Object.freeze({accessKeyId:value.accessKeyId,secretAccessKey:value.secretAccessKey,sessionToken:value.sessionToken});
}
export function assertExplicitCredentialProvider(credentials,source){
 if(typeof credentials!=='function'||source!==undefined||providers.has(credentials))throw fail();
}
// Expected resource comes from an independently reviewed AWS installation
// manifest. readRuntime must obtain context/region/credentials from Lambda,
// NEVER from event/HTTP/body fields. The brand checks wiring, not AWS identity.
export function createLambdaExecutionRoleProvider({enabled=false,resource,kind='gateway',readRuntime,timeoutMs=250}={}){
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>1000)throw fail();
 let expected,closed=false,faulted=false;const pending=new Set();
 if(enabled===true){
  if(!['gateway','authority'].includes(kind)||typeof readRuntime!=='function')throw fail();
  expected=binding(resource,kind);
 }
 const provider=async({signal,minimumRemainingMs=100}={})=>{
  if(enabled!==true||closed||faulted||signal?.aborted||!Number.isInteger(minimumRemainingMs)||minimumRemainingMs<100||minimumRemainingMs>6100||pending.size>=2)throw fail();
  const c=new AbortController(),abort=()=>c.abort(),started=performance.now();let onAbort;
  pending.add(c);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  const stopped=new Promise((_,reject)=>{onAbort=()=>reject(fail());c.signal.addEventListener('abort',onAbort,{once:true});}),timer=setTimeout(abort,timeoutMs);
  const check=()=>{if(closed||faulted||c.signal.aborted||performance.now()-started>=timeoutMs)throw fail();};
  try{
   check();const value=await Promise.race([Promise.resolve().then(()=>{check();return readRuntime({signal:c.signal});}),stopped]);check();
   if(!exact(value,['context','region','credentials'])||value.region!==expected.region)throw fail();
   const context=value.context,arn='arn:aws:lambda:'+expected.region+':'+expected.accountId+':function:'+expected.functionName+':'+expected.version;
   if(!context||context.invokedFunctionArn!==arn||context.functionName!==expected.functionName||context.functionVersion!==expected.version||typeof context.getRemainingTimeInMillis!=='function')throw fail();
   const remaining=context.getRemainingTimeInMillis();
   if(!Number.isFinite(remaining)||remaining<minimumRemainingMs)throw fail();
   const snapshot=temporary(value.credentials);check();return snapshot;
  }catch{faulted=true;for(const other of pending)other.abort();throw fail();}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);c.signal.removeEventListener('abort',onAbort);c.abort();pending.delete(c);}
 };
 Object.defineProperty(provider,'close',{value:()=>{closed=true;for(const c of pending)c.abort();}});
 if(enabled===true)providers.set(provider,{resource:expected,kind});
 return Object.freeze(provider);
}
// Internal adapter for bounded SDK requests. A fresh client owns exactly one
// immutable credential snapshot and one send. No client/credentials survive to
// another request; SDK memoization cannot reuse a previous snapshot.
export function createLambdaRuntimeClient({profile,credentials,source,target,kind,config,openClient,timeoutMs,maxConcurrent=1}={}){
 const registered=providers.get(credentials);
 if(profile!=='lambda-execution-role'||!registered||!['gateway','authority'].includes(kind)||registered.kind!==kind||typeof openClient!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>6000||![1,2].includes(maxConcurrent))throw fail();
 const expected=binding(source,kind);
 if(Object.keys(expected).some(k=>expected[k]!==registered.resource[k])||!target||target.accountId!==expected.accountId||target.region!==expected.region||config?.region!==expected.region||config.maxAttempts!==1||config.useFipsEndpoint!==false||config.useDualstackEndpoint!==false)throw fail();
 let closed=false;const pending=new Set();
 const stop=entry=>{entry.controller.abort();try{entry.client?.destroy();}catch{}entry.agent?.destroy();};
 return Object.freeze({
  async send(command,{abortSignal}={}){
   if(closed||abortSignal?.aborted||pending.size>=maxConcurrent)throw fail();
   const c=new AbortController(),entry={controller:c},abort=()=>c.abort(),started=performance.now();let onAbort;
   pending.add(entry);abortSignal?.addEventListener('abort',abort,{once:true});if(abortSignal?.aborted)abort();
   const stopped=new Promise((_,reject)=>{onAbort=()=>reject(fail());c.signal.addEventListener('abort',onAbort,{once:true});}),timer=setTimeout(abort,timeoutMs);
   const check=()=>{if(closed||c.signal.aborted||performance.now()-started>=timeoutMs)throw fail();};
   try{
    check();const snapshot=await Promise.race([credentials({signal:c.signal,minimumRemainingMs:timeoutMs+100}),stopped]);check();
    entry.agent=new Agent({keepAlive:false,maxSockets:1,maxTotalSockets:1,minVersion:'TLSv1.2',rejectUnauthorized:true});
    // AWS SDK may attach identity-source metadata. Give it an owned mutable
    // copy; preserve the provider's frozen snapshot and never share this copy.
    const selected={...config,credentials:{...snapshot},requestHandler:{...config.requestHandler,httpsAgent:entry.agent}};
    try{entry.client=openClient(selected);if(typeof entry.client?.send!=='function'||typeof entry.client?.destroy!=='function')throw fail();}catch{throw fail();}
    check();const response=await Promise.race([Promise.resolve().then(()=>{check();return entry.client.send(command,{abortSignal:c.signal});}),stopped]);check();return response;
   }catch(error){
    // Preserve only the Dynamo condition signal needed by the nonce protocol;
    // the outer store independently checks status/attempts before treating it as
    // a duplicate. No provider diagnostics or arbitrary error fields escape.
    if(!closed&&!c.signal.aborted&&error?.name==='ConditionalCheckFailedException')throw Object.assign(fail(),{name:'ConditionalCheckFailedException',$metadata:{httpStatusCode:error.$metadata?.httpStatusCode,attempts:error.$metadata?.attempts,totalRetryDelay:error.$metadata?.totalRetryDelay}});
    throw fail();
   }finally{clearTimeout(timer);abortSignal?.removeEventListener('abort',abort);c.signal.removeEventListener('abort',onAbort);stop(entry);pending.delete(entry);}
  },
  destroy(){closed=true;for(const entry of pending)stop(entry);}
 });
}
