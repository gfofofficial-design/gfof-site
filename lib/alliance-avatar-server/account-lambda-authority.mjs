// Source-only synchronous IAM Invoke transport, not a deployed handler/HTTP route.
// No default credentials, root bootstrap, caller identity provider or retry.
import {LambdaClient,InvokeCommand} from '@aws-sdk/client-lambda';
import {Agent} from 'node:https';
import {createHash,randomBytes} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {isDeepStrictEqual as same} from 'node:util';
import {accountHandoffBytes,reviewAccountHandoff} from './account-handoff.mjs';
import {controlExact as exact,controlHash as hash} from './control-policy.mjs';
const zero='0'.repeat(64),MAX=274432,sha=b=>createHash('sha256').update(b).digest('hex');
const fail=()=>Error('alliance_account_lambda_unavailable');
function receipt(v){
 if(!exact(v,['generation','sha256'])||!Number.isSafeInteger(v.generation)||v.generation<1||v.generation>2147483646||!hash(v.sha256)||v.sha256===zero)throw fail();
 return {generation:v.generation,sha256:v.sha256};
}
function binding(v){
 if(!exact(v,['accountId','region','functionName','version'])||typeof v.accountId!=='string'||!/^\d{12}$/.test(v.accountId)||typeof v.region!=='string'||!/^us-(east|west)-[12]$/.test(v.region)||typeof v.functionName!=='string'||!/^alliance-account-authority-[a-z0-9-]{1,37}$/.test(v.functionName)||typeof v.version!=='string'||!(/^[1-9]\d{0,8}$/).test(v.version))throw fail();
 return `arn:aws:lambda:${v.region}:${v.accountId}:function:${v.functionName}:${v.version}`;
}
function policy(scope,verificationKey){
 scope=structuredClone(scope);
 accountHandoffBytes({format:1,scope,generation:1,previousSha256:zero,verificationKey,minimum:{head:{sequence:0,sha256:zero},acknowledged:{sequence:0,sha256:zero}},pending:null});
 return {scope,verificationKey};
}
function advance(input,p,wire=false){
 if(!exact(input,['expected','next','bytes','records','kind'])||!['ordinary','resolution'].includes(input.kind)||!Array.isArray(input.records)||input.records.length>256||Buffer.byteLength(JSON.stringify(input.records))>262144)throw fail();
 const expected=receipt(input.expected),next=receipt(input.next);let bytes;
 if(wire){
  if(typeof input.bytes!=='string'||input.bytes.length>5464||!(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/).test(input.bytes))throw fail();
  bytes=Buffer.from(input.bytes,'base64');if(bytes.toString('base64')!==input.bytes)throw fail();
 }else{if(!(input.bytes instanceof Uint8Array))throw fail();bytes=Buffer.from(input.bytes);}
 if(bytes.length<1||bytes.length>4096||next.generation!==expected.generation+1||sha(bytes)!==next.sha256)throw fail();
 const record=reviewAccountHandoff({bytes,expectedSha256:next.sha256,expectedScope:p.scope,expectedVerificationKey:p.verificationKey,minimumGeneration:next.generation});
 if(record.generation!==next.generation||record.previousSha256!==expected.sha256)throw fail();
 return {expected,next,bytes,records:structuredClone(input.records),kind:input.kind};
}
function result(v,write,next){
 if(exact(v,['generation','sha256'])&&!write)return receipt(v);
 if(exact(v,['state'])&&['unavailable','cancelled','busy',...(write?['invalid','unknown']:[])].includes(v.state))return {state:v.state};
 if(write&&exact(v,['state','receipt'])&&['committed','conflict'].includes(v.state)){
  const r=receipt(v.receipt);if(v.state==='committed'&&!same(r,next))throw fail();return {state:v.state,receipt:r};
 }
 throw fail();
}
function parsed(bytes,max){
 if(!(bytes instanceof Uint8Array)||bytes.byteLength<1||bytes.byteLength>max)throw fail();
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}

export function createLambdaAccountCheckpointAuthority({enabled=false,resource,scope,verificationKey,minimum,credentials,openClient,timeoutMs=5500}={}){
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>6000)throw fail();let arn,p,pin,client,agent;
 if(enabled===true){
  arn=binding(resource);resource={...resource};p=policy(scope,verificationKey);pin=receipt(minimum);
  if(typeof credentials!=='function'||openClient!==undefined&&typeof openClient!=='function')throw fail();
  // Trusted provider must supply expiring STS credentials. No default-chain lookup.
  const temporary=async()=>{
   const v=await credentials(),expires=v?.expiration?.getTime?.(),now=Date.now();
   if(typeof v?.accessKeyId!=='string'||!/^ASIA[A-Z0-9]{16}$/.test(v.accessKeyId)||typeof v.secretAccessKey!=='string'||v.secretAccessKey.length<16||v.secretAccessKey.length>128||typeof v.sessionToken!=='string'||v.sessionToken.length<16||v.sessionToken.length>8192||!Number.isFinite(expires)||expires<now+timeoutMs+60000||expires>now+3600000)throw fail();
   return {accessKeyId:v.accessKeyId,secretAccessKey:v.secretAccessKey,sessionToken:v.sessionToken,expiration:new Date(expires)};
  };
  agent=new Agent({keepAlive:true,maxSockets:1,maxTotalSockets:1,minVersion:'TLSv1.2',rejectUnauthorized:true});
  const config={region:resource.region,endpoint:`https://lambda.${resource.region}.amazonaws.com`,credentials:temporary,maxAttempts:1,retryMode:'standard',useFipsEndpoint:false,useDualstackEndpoint:false,requestHandler:{httpsAgent:agent,connectionTimeout:500,requestTimeout:5000,throwOnRequestTimeout:true}};
  try{client=openClient?openClient(config):new LambdaClient(config);if(typeof client?.send!=='function'||typeof client?.destroy!=='function')throw fail();}catch{agent.destroy();throw fail();}
 }
 let active=false,closed=false,faulted=false,controller;
 async function operation(input,{signal}={},write=false){
  if(enabled!==true||closed||faulted)return {state:'unavailable'};if(signal?.aborted)return {state:'cancelled'};if(active)return {state:'busy'};
  let q;if(write)try{q=advance(input,p);}catch{return {state:'invalid'};}
  const id=randomBytes(16).toString('hex'),op=write?'advance':'read';
  const request={format:1,id,serviceArn:arn,operation:op,input:write?{...q,bytes:q.bytes.toString('base64')}:null};
  const payload=Buffer.from(JSON.stringify(request));if(payload.length>MAX)return {state:'invalid'};
  const c=new AbortController(),abort=()=>c.abort(),started=performance.now();let onAbort,dispatched=false;
  controller=c;active=true;signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  const stopped=new Promise((_,reject)=>{onAbort=()=>reject(fail());c.signal.addEventListener('abort',onAbort,{once:true});}),timer=setTimeout(abort,timeoutMs);
  const check=()=>{if(closed||c.signal.aborted||performance.now()-started>=timeoutMs)throw fail();};
  try{
   const response=await Promise.race([Promise.resolve().then(()=>{check();dispatched=true;return client.send(new InvokeCommand({FunctionName:arn,InvocationType:'RequestResponse',LogType:'None',Payload:payload}),{abortSignal:c.signal});}),stopped]);check();
   if(response?.$metadata?.httpStatusCode!==200||response.$metadata.attempts!==1||response.$metadata.totalRetryDelay!==0||response.StatusCode!==200||response.ExecutedVersion!==resource.version||response.FunctionError!==undefined||response.LogResult!==undefined)throw fail();
   const envelope=parsed(response.Payload,1024);
   if(!exact(envelope,['format','id','serviceArn','operation','result'])||envelope.format!==1||envelope.id!==id||envelope.serviceArn!==arn||envelope.operation!==op)throw fail();
   const value=result(envelope.result,write,q?.next),r=value.receipt??(Object.hasOwn(value,'generation')?value:null);
   if(r){if(r.generation<pin.generation||r.generation===pin.generation&&r.sha256!==pin.sha256)throw fail();pin={...r};}
   if(['unknown','unavailable','cancelled'].includes(value.state))faulted=true;
   return value;
  }catch{faulted=true;return {state:write&&dispatched?'unknown':signal?.aborted?'cancelled':'unavailable'};}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);c.signal.removeEventListener('abort',onAbort);c.abort();active=false;controller=undefined;}
 }
 return Object.freeze({read:o=>operation(null,o),advance:(q,o)=>operation(q,o,true),close(){closed=true;controller?.abort();client?.destroy();agent?.destroy();}});
}

// Only mount behind AWS IAM Invoke after separate deployment/IAM acceptance.
// Context is supplied by Lambda, NEVER by an HTTP caller or JSON body.
export function createAccountAuthorityLambdaHandler({enabled=false,resource,scope,verificationKey,authority,timeoutMs=4500}={}){
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>4500)throw fail();let arn,p;
 if(enabled===true){arn=binding(resource);resource={...resource};p=policy(scope,verificationKey);if(typeof authority?.read!=='function'||typeof authority?.advance!=='function'||typeof authority?.close!=='function')throw fail();}
 let active=false,faulted=false;
 const closeAuthority=()=>{try{authority.close();}catch{/* Never surface provider teardown details. */}};
 return async(event,context)=>{
  let q;
  try{
   if(enabled!==true||faulted||!context||context.invokedFunctionArn!==arn||context.functionVersion!==resource.version||context.functionName!==resource.functionName||typeof context.getRemainingTimeInMillis!=='function')throw fail();
   const remaining=context.getRemainingTimeInMillis();
   if(!Number.isFinite(remaining)||remaining<timeoutMs+500||!exact(event,['format','id','serviceArn','operation','input'])||event.format!==1||typeof event.id!=='string'||!(/^[a-f0-9]{32}$/).test(event.id)||event.serviceArn!==arn||!['read','advance'].includes(event.operation)||Buffer.byteLength(JSON.stringify(event))>MAX)throw fail();
   if(event.operation==='read'){if(event.input!==null)throw fail();}else q=advance(event.input,p,true);
  }catch{throw fail();}
  const id=event.id,op=event.operation;
  const response=value=>({format:1,id,serviceArn:arn,operation:op,result:value});
  if(active)return response({state:'busy'});active=true;
  const c=new AbortController(),started=performance.now();let onAbort;
  const stopped=new Promise((_,reject)=>{onAbort=()=>reject(fail());c.signal.addEventListener('abort',onAbort,{once:true});}),timer=setTimeout(()=>c.abort(),timeoutMs);
  try{
   const value=await Promise.race([Promise.resolve().then(()=>op==='read'?authority.read({signal:c.signal}):authority.advance(q,{signal:c.signal})),stopped]);
   if(c.signal.aborted||performance.now()-started>=timeoutMs)throw fail();
   const validated=result(value,op==='advance',q?.next);
   if(['unknown','unavailable','cancelled'].includes(validated.state)){faulted=true;closeAuthority();}
   return response(validated);
  }catch{faulted=true;closeAuthority();return response({state:op==='advance'?'unknown':'unavailable'});}
  finally{clearTimeout(timer);c.signal.removeEventListener('abort',onAbort);c.abort();active=false;}
 };
}
