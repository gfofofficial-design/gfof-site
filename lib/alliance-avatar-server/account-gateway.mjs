// Source-only signed HTTPS transport and REST-v1 proxy factory. Neither is mounted.
// No AWS keys, environment lookup, retry, nonce-store fallback or root initialization.
import {createHash,createPublicKey,randomBytes,sign,verify} from 'node:crypto';
import {request as httpsRequest,Agent} from 'node:https';
import {performance} from 'node:perf_hooks';
import {controlExact as exact} from './control-policy.mjs';
import {authorityReceipt as receipt,authorityArn as binding,authorityPolicy as policy,authorityAdvance as advance,authorityResult as result,authorityParsed as parsed,AUTHORITY_MAX_BYTES as MAX} from './account-authority-wire.mjs';
const fail=()=>Error('alliance_account_gateway_unavailable'),sha=b=>createHash('sha256').update(b).digest('hex');
const PATH='/checkpoint',SKEW=30,headerNames=['content-type','x-gf-key-id','x-gf-time','x-gf-nonce','x-gf-signature'];
function gatewayBinding(v){
 if(!exact(v,['apiId','region','stage'])||typeof v.apiId!=='string'||!(/^[a-z0-9]{10}$/).test(v.apiId)||typeof v.region!=='string'||!(/^us-(east|west)-[12]$/).test(v.region)||typeof v.stage!=='string'||!(/^[a-z][a-z0-9_-]{0,31}$/).test(v.stage))throw fail();
 return Object.freeze({...v,host:`${v.apiId}.execute-api.${v.region}.amazonaws.com`,path:`/${v.stage}${PATH}`});
}
function publicKey(v){
 if(!exact(v,['keyId','spki'])||typeof v.spki!=='string'||v.spki.length>128||!(/^[A-Za-z0-9+/]+={0,2}$/).test(v.spki))throw fail();
 const bytes=Buffer.from(v.spki,'base64');if(bytes.toString('base64')!==v.spki||sha(bytes)!==v.keyId)throw fail();
 const key=createPublicKey({key:bytes,format:'der',type:'spki'});if(key.asymmetricKeyType!=='ed25519'||!key.export({format:'der',type:'spki'}).equals(bytes))throw fail();
 return {key,keyId:v.keyId};
}
function signingBytes(g,arn,keyId,time,nonce,body){return Buffer.from(['GF-ALLIANCE-GATEWAY-V1','POST',`https://${g.host}`,g.path,arn,keyId,time,nonce,sha(body)].join('\n'),'utf8');}
function response(statusCode,value){return {statusCode,isBase64Encoded:false,headers:{'content-type':'application/json','cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'},body:JSON.stringify(value)};}
const unavailable=()=>response(503,{state:'unavailable'});
function headers(event){
 const single=event.headers,multi=event.multiValueHeaders;
 if(!single||typeof single!=='object'||Array.isArray(single)||!multi||typeof multi!=='object'||Array.isArray(multi))throw fail();
 const out={};
 for(const name of [...headerNames,'host']){
  const a=Object.entries(single).filter(([k])=>k.toLowerCase()===name),b=Object.entries(multi).filter(([k])=>k.toLowerCase()===name);
  if(a.length!==1||b.length!==1||typeof a[0][1]!=='string'||!Array.isArray(b[0][1])||b[0][1].length!==1||b[0][1][0]!==a[0][1])throw fail();
  out[name]=a[0][1];
 }
 if(out['content-type']!=='application/json'||!(/^[1-9]\d{0,10}$/).test(out['x-gf-time'])||!(/^[a-f0-9]{32}$/).test(out['x-gf-nonce'])||!(/^[A-Za-z0-9_-]{86}$/).test(out['x-gf-signature']))throw fail();
 return out;
}
// Trusted, bounded one-shot HTTPS implementation; no redirect following.
function sendHttps(options,body,signal){
 return new Promise((resolve,reject)=>{
  let req,reply,settled=false;const done=(error,value)=>{if(settled)return;settled=true;if(error){reply?.destroy();req?.destroy();reject(fail());}else resolve(value);};
  try{req=httpsRequest({...options,signal},r=>{reply=r;let size=0;const chunks=[];
   if(r.statusCode!==200||r.headers['content-type']!=='application/json'||r.headers['content-encoding']!==undefined||r.headers['set-cookie']!==undefined||r.headers.location!==undefined){done(fail());return;}
   r.on('data',b=>{size+=b.length;if(size>1024){done(fail());return;}chunks.push(b);});r.on('error',()=>done(fail()));r.on('aborted',()=>done(fail()));r.on('end',()=>done(null,{statusCode:r.statusCode,headers:{'content-type':r.headers['content-type']},body:Buffer.concat(chunks)}));
  });req.on('error',()=>done(fail()));req.setTimeout(5000,()=>done(fail()));req.end(body);}catch{done(fail());}
 });
}

export function createGatewayAccountCheckpointAuthority({enabled=false,gateway,resource,scope,verificationKey,minimum,signingKey,callerKey,transport=sendHttps,timeoutMs=6000}={}){
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>6000)throw fail();let g,arn,p,pin,k,agent;
 if(enabled===true){g=gatewayBinding(gateway);arn=binding(resource);if(g.region!==resource.region)throw fail();p=policy(scope,verificationKey);pin=receipt(minimum);k=publicKey(callerKey);if(typeof signingKey!=='function'||typeof transport!=='function')throw fail();agent=new Agent({keepAlive:true,maxSockets:1,maxTotalSockets:1,minVersion:'TLSv1.2',rejectUnauthorized:true});}
 let active=false,closed=false,faulted=false,controller;
 async function operation(input,{signal}={},write=false){
  if(enabled!==true||closed||faulted)return {state:'unavailable'};if(signal?.aborted)return {state:'cancelled'};if(active)return {state:'busy'};
  let q;if(write)try{q=advance(input,p);}catch{return {state:'invalid'};}
  const id=randomBytes(16).toString('hex'),op=write?'advance':'read',payload=Buffer.from(JSON.stringify({format:1,id,serviceArn:arn,operation:op,input:write?{...q,bytes:q.bytes.toString('base64')}:null}));if(payload.length>MAX)return {state:'invalid'};
  const c=new AbortController(),abort=()=>c.abort(),started=performance.now();let onAbort,dispatched=false;controller=c;active=true;
  signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  const stopped=new Promise((_,reject)=>{onAbort=()=>reject(fail());c.signal.addEventListener('abort',onAbort,{once:true});}),timer=setTimeout(abort,timeoutMs);
  const check=()=>{if(closed||c.signal.aborted||performance.now()-started>=timeoutMs)throw fail();};
  try{
   const key=await Promise.race([Promise.resolve().then(()=>{check();return signingKey({signal:c.signal});}),stopped]);check();
   if(key?.type!=='private'||key.asymmetricKeyType!=='ed25519'||sha(createPublicKey(key).export({format:'der',type:'spki'}))!==k.keyId)throw fail();
   const time=String(Math.floor(Date.now()/1000)),signature=sign(null,signingBytes(g,arn,k.keyId,time,id,payload),key).toString('base64url');
   const options={protocol:'https:',hostname:g.host,port:443,path:g.path,method:'POST',agent,minVersion:'TLSv1.2',rejectUnauthorized:true,headers:{'content-type':'application/json','content-length':String(payload.length),'x-gf-key-id':k.keyId,'x-gf-time':time,'x-gf-nonce':id,'x-gf-signature':signature}};
   const r=await Promise.race([Promise.resolve().then(()=>{check();dispatched=true;return transport(options,Buffer.from(payload),c.signal);}),stopped]);check();
   if(r?.statusCode!==200||!exact(r.headers,['content-type'])||r.headers['content-type']!=='application/json')throw fail();
   const envelope=parsed(r.body,1024);if(!exact(envelope,['format','id','serviceArn','operation','result'])||envelope.format!==1||envelope.id!==id||envelope.serviceArn!==arn||envelope.operation!==op||!Buffer.from(JSON.stringify(envelope)).equals(Buffer.from(r.body)))throw fail();
   const value=result(envelope.result,write,q?.next),current=value.receipt??(Object.hasOwn(value,'generation')?value:null);
   if(current){if(current.generation<pin.generation||current.generation===pin.generation&&current.sha256!==pin.sha256)throw fail();pin={...current};}
   if(['unknown','unavailable','cancelled'].includes(value.state))faulted=true;return value;
  }catch{faulted=true;return {state:write&&dispatched?'unknown':signal?.aborted?'cancelled':'unavailable'};}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);c.signal.removeEventListener('abort',onAbort);c.abort();active=false;controller=undefined;}
 }
 return Object.freeze({read:o=>operation(null,o),advance:(q,o)=>operation(q,o,true),close(){closed=true;controller?.abort();agent?.destroy();}});
}

// trustedContext is actual Lambda context; event must be supplied by the exact
// REST-v1 integration protected by its Lambda resource policy, never by a caller.
// claims.claim must atomically consume nonce across ALL instances before dispatch.
export function createAccountGatewayHandler({enabled=false,gateway,resource,bridge,scope,verificationKey,callerKey,claims,authority,timeoutMs=6500}={}){
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>6500)throw fail();let g,arn,p,k,bridgeArn;
 if(enabled===true){
  g=gatewayBinding(gateway);arn=binding(resource);p=policy(scope,verificationKey);k=publicKey(callerKey);
  if(!exact(bridge,['accountId','region','functionName','version'])||bridge.accountId!==resource.accountId||bridge.region!==g.region||g.region!==resource.region||typeof bridge.functionName!=='string'||!(/^alliance-account-gateway-[a-z0-9-]{1,39}$/).test(bridge.functionName)||typeof bridge.version!=='string'||!(/^[1-9]\d{0,8}$/).test(bridge.version)||typeof claims?.claim!=='function'||![authority?.read,authority?.advance,authority?.close].every(v=>typeof v==='function'))throw fail();
  bridge={...bridge};bridgeArn=`arn:aws:lambda:${bridge.region}:${bridge.accountId}:function:${bridge.functionName}:${bridge.version}`;
 }
 let active=false,faulted=false;
 const stop=()=>{faulted=true;try{authority.close();}catch{}};
 return async(event,context)=>{
  let envelope,q,claim;
  try{
   if(enabled!==true||faulted||context?.invokedFunctionArn!==bridgeArn||context?.functionName!==bridge.functionName||context?.functionVersion!==bridge.version||typeof context.getRemainingTimeInMillis!=='function')throw fail();
   const remaining=context.getRemainingTimeInMillis();if(!Number.isFinite(remaining)||remaining<timeoutMs+500)throw fail();
   const rc=event?.requestContext;
   if(event.httpMethod!=='POST'||event.resource!==PATH||event.path!==PATH||event.isBase64Encoded!==false||event.queryStringParameters!==null||event.multiValueQueryStringParameters!==null||event.pathParameters!==null||event.stageVariables!==null||rc?.accountId!==bridge.accountId||rc.apiId!==g.apiId||rc.stage!==g.stage||rc.domainName!==g.host||rc.resourcePath!==PATH||rc.httpMethod!=='POST'||rc.path!==g.path||typeof event.body!=='string')throw fail();
   if(event.body.length<1||event.body.length>MAX)throw fail();const body=Buffer.from(event.body,'utf8');if(body.length>MAX||body.toString('utf8')!==event.body)throw fail();
   const h=headers(event),now=Math.floor(Date.now()/1000),time=Number(h['x-gf-time']);if(h.host!==g.host||h['x-gf-key-id']!==k.keyId||!Number.isSafeInteger(time)||Math.abs(now-time)>SKEW)throw fail();
   const signature=Buffer.from(h['x-gf-signature'],'base64url');if(signature.length!==64||signature.toString('base64url')!==h['x-gf-signature']||!verify(null,signingBytes(g,arn,k.keyId,h['x-gf-time'],h['x-gf-nonce'],body),k.key,signature))throw fail();
   envelope=parsed(body,MAX);
   if(!exact(envelope,['format','id','serviceArn','operation','input'])||envelope.format!==1||envelope.id!==h['x-gf-nonce']||envelope.serviceArn!==arn||!['read','advance'].includes(envelope.operation)||JSON.stringify(envelope)!==event.body)throw fail();
   if(envelope.operation==='read'){if(envelope.input!==null)throw fail();}else q=advance(envelope.input,p,true);
   // Fixed expiry exceeds the entire accepted request window, including skew.
   claim={keyId:k.keyId,nonce:envelope.id,requestSha256:sha(body),expiresAt:time+SKEW+1};
  }catch{return unavailable();}
  if(active)return unavailable();active=true;
  const c=new AbortController(),started=performance.now();let onAbort,dispatched=false;
  const stopped=new Promise((_,reject)=>{onAbort=()=>reject(fail());c.signal.addEventListener('abort',onAbort,{once:true});}),timer=setTimeout(()=>c.abort(),timeoutMs);
  const check=()=>{if(faulted||c.signal.aborted||performance.now()-started>=timeoutMs)throw fail();};
  const phase=fn=>Promise.race([Promise.resolve().then(()=>{check();return fn();}),stopped]);
  try{
   // A collision, stale nonce, storage error or uncertain claim never dispatches.
   const accepted=await phase(()=>claims.claim({...claim},{signal:c.signal}));check();if(accepted!==true)return unavailable();
   if(Math.floor(Date.now()/1000)>=claim.expiresAt)return unavailable();
   const value=await phase(()=>{dispatched=true;return envelope.operation==='read'?authority.read({signal:c.signal}):authority.advance(q,{signal:c.signal});});check();
   const validated=result(value,envelope.operation==='advance',q?.next);if(['unknown','unavailable','cancelled'].includes(validated.state))stop();
   return response(200,{format:1,id:envelope.id,serviceArn:arn,operation:envelope.operation,result:validated});
  }catch{
   stop();return dispatched?response(200,{format:1,id:envelope.id,serviceArn:arn,operation:envelope.operation,result:{state:envelope.operation==='advance'?'unknown':'unavailable'}}):unavailable();
  }finally{clearTimeout(timer);c.signal.removeEventListener('abort',onAbort);c.abort();active=false;}
 };
}
