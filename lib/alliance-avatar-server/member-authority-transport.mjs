// Disabled, unmounted transport for member startup decisions/deletion witnesses.
// No key lookup, store discovery, signing-key generation, initialization or retry.
import {createHash,createPublicKey,randomBytes,sign,verify} from 'node:crypto';
import {request as httpsRequest,Agent} from 'node:https';
import {performance} from 'node:perf_hooks';
import {controlExact as exact,controlRef as ref,controlUuid as uuid,controlHash as hash} from './control-policy.mjs';
import {reviewGatewayCallerKey,assertGatewayKeyCurrent} from './gateway-signing-key.mjs';
import {startupDecisionBytes} from './startup-gate.mjs';
import {deletionWitnessBytes} from './deletion-journal.mjs';

const PATH='/member-authority',MAX=4096,SKEW=30;
const failure=()=>Error('alliance_member_authority_unavailable');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const encode=value=>Buffer.from(JSON.stringify(value));
const signedHeaders=['content-type','x-gf-key-id','x-gf-time','x-gf-nonce','x-gf-signature'];
function scope(value){
 const names=['memberProjectRef','journalProjectRef','controlProjectRef','epoch'];
 if(!exact(value,names)||!uuid(value.epoch)||!names.slice(0,3).every(k=>ref(value[k]))||new Set(names.slice(0,3).map(k=>value[k])).size!==3)throw failure();
 return Object.fromEntries(names.map(k=>[k,value[k]]));
}
function binding(gateway,resource){
 if(!exact(gateway,['apiId','region','stage'])||!['apiId','region','stage'].every(k=>typeof gateway[k]==='string')||!(/^[a-z0-9]{10}$/).test(gateway.apiId)||!(/^us-(east|west)-[12]$/).test(gateway.region)||!(/^[a-z][a-z0-9_-]{0,31}$/).test(gateway.stage)||
  !exact(resource,['accountId','region','functionName','version'])||!['accountId','region','functionName','version'].every(k=>typeof resource[k]==='string')||!(/^\d{12}$/).test(resource.accountId)||resource.region!==gateway.region||!(/^alliance-member-authority-[a-z0-9-]{1,39}$/).test(resource.functionName)||!(/^[1-9]\d{0,8}$/).test(resource.version))throw failure();
 const host=`${gateway.apiId}.execute-api.${gateway.region}.amazonaws.com`;
 return Object.freeze({...gateway,...resource,host,path:`/${gateway.stage}${PATH}`,arn:`arn:aws:lambda:${resource.region}:${resource.accountId}:function:${resource.functionName}:${resource.version}`});
}
function configuration({gateway,resource,scope:input,callerKey,controlVerificationKey,journalVerificationKey}){
 const s=scope(input),b=binding(gateway,resource),caller=reviewGatewayCallerKey(callerKey);
 if(!hash(controlVerificationKey)||!hash(journalVerificationKey)||controlVerificationKey==='0'.repeat(64)||journalVerificationKey==='0'.repeat(64)||controlVerificationKey===journalVerificationKey)throw failure();
 const key=hex=>createPublicKey({format:'jwk',key:{kty:'OKP',crv:'Ed25519',x:Buffer.from(hex,'hex').toString('base64url')}});
 const control=key(controlVerificationKey),journal=key(journalVerificationKey);
 for(const k of [control,journal])if(digest(k.export({format:'der',type:'spki'}))===caller.keyId)throw failure();
 return {s,b,caller,control,journal};
}
// Public expected configuration only. This validates shapes/identities without
// opening a transport, reading credentials or treating them as AWS attestation.
export function reviewMemberAuthorityBinding(value){
 try{
  if(!exact(value,['gateway','resource','scope','callerKey','controlVerificationKey','journalVerificationKey']))throw failure();
  configuration(value);return structuredClone(value);
 }catch{throw failure();}
}
function parse(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.byteLength<1||bytes.byteLength>MAX)throw failure();
 const copy=Buffer.from(bytes),value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(copy));
 if(!encode(value).equals(copy))throw failure();return value;
}
function requestInput(operation,value,s){
 if(operation==='startup'){
  if(!exact(value,['format','memberProjectRef','journalProjectRef','epoch','bootId','challenge'])||value.format!==1||value.memberProjectRef!==s.memberProjectRef||value.journalProjectRef!==s.journalProjectRef||value.epoch!==s.epoch||!hash(value.bootId)||!hash(value.challenge))throw failure();
  return {...value};
 }
 if(operation!=='witness'||!exact(value,['challenge'])||!hash(value.challenge))throw failure();
 return {challenge:value.challenge};
}
function signingBytes(b,keyId,time,nonce,body){
 return Buffer.from(['GF-ALLIANCE-MEMBER-AUTHORITY-V1','POST',`https://${b.host}`,b.path,b.arn,keyId,time,nonce,digest(body)].join('\n'));
}
function checkedReply(operation,raw,input,c){
 if(!(raw instanceof Uint8Array)||raw.byteLength>2048)throw failure();
 const value=parse(raw);let message,key,issuedAt;
 if(operation==='startup'){
  if(!exact(value,['decision','signature']))throw failure();const d=value.decision;
  message=startupDecisionBytes(d);key=c.control;issuedAt=d.issuedAt;
  if(d.memberProjectRef!==c.s.memberProjectRef||d.journalProjectRef!==c.s.journalProjectRef||d.epoch!==c.s.epoch||d.bootId!==input.bootId||d.challenge!==input.challenge)throw failure();
 }else{
  if(!exact(value,['anchor','signature']))throw failure();const a=value.anchor;
  message=deletionWitnessBytes(a);key=c.journal;issuedAt=a.issuedAt;
  if(a.projectRef!==c.s.memberProjectRef||a.epoch!==c.s.epoch||a.challenge!==input.challenge)throw failure();
 }
 const age=Date.now()-Date.parse(issuedAt);
 if(typeof value.signature!=='string'||!(/^[a-f0-9]{128}$/).test(value.signature)||age< -1000||age>=30000||!verify(null,message,key,Buffer.from(value.signature,'hex')))throw failure();
 return Buffer.from(raw);
}
function signedEventHeaders(event){
 const out={};
 for(const name of [...signedHeaders,'host']){
  const entries=object=>object&&typeof object==='object'&&!Array.isArray(object)?Object.entries(object).filter(([k])=>k.toLowerCase()===name):[];
  const one=entries(event.headers),many=entries(event.multiValueHeaders);
  if(one.length!==1||many.length!==1||typeof one[0][1]!=='string'||!Array.isArray(many[0][1])||many[0][1].length!==1||one[0][1]!==many[0][1][0])throw failure();
  out[name]=one[0][1];
 }
 if(out['content-type']!=='application/json'||!(/^[1-9]\d{0,10}$/).test(out['x-gf-time'])||!(/^[a-f0-9]{32}$/).test(out['x-gf-nonce'])||!(/^[A-Za-z0-9_-]{86}$/).test(out['x-gf-signature']))throw failure();
 return out;
}
const response=(statusCode,value)=>({statusCode,isBase64Encoded:false,headers:{'content-type':'application/json','cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'},body:JSON.stringify(value)});
const unavailable=()=>response(503,{state:'unavailable'});

function sendHttps(options,body,signal){
 return new Promise((resolve,reject)=>{
  let request,reply,settled=false;
  const done=(error,value)=>{if(settled)return;settled=true;if(error){reply?.destroy();request?.destroy();reject(failure());}else resolve(value);};
  try{
   request=httpsRequest({...options,signal},r=>{
    reply=r;let size=0;const chunks=[];
    if(r.statusCode!==200||r.headers['content-type']!=='application/json'||r.headers['content-encoding']!==undefined||r.headers['set-cookie']!==undefined||r.headers.location!==undefined){done(failure());return;}
    r.on('data',bytes=>{size+=bytes.length;if(size>MAX){done(failure());return;}chunks.push(bytes);});
    r.on('error',()=>done(failure()));r.on('aborted',()=>done(failure()));
    r.on('end',()=>done(null,{statusCode:200,headers:{'content-type':'application/json'},body:Buffer.concat(chunks)}));
   });
   request.on('error',()=>done(failure()));request.setTimeout(5000,()=>done(failure()));request.end(body);
  }catch{done(failure());}
 });
}

export function createMemberAuthorityTransport({enabled=false,signingKey,transport=sendHttps,timeoutMs=6000,...options}={}){
 if(typeof enabled!=='boolean'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>6000)throw failure();
 let config,agent;
 if(enabled){config=configuration(options);if(typeof signingKey!=='function'||typeof transport!=='function')throw failure();agent=new Agent({keepAlive:true,maxSockets:1,maxTotalSockets:1,minVersion:'TLSv1.2',rejectUnauthorized:true});}
 let closed=false,faulted=false,active=false,controller;
 async function exchange(operation,value,signal){
  if(!enabled||closed||faulted||active||(signal!==undefined&&!(signal instanceof AbortSignal))||signal?.aborted)throw failure();
  const input=requestInput(operation,value,config.s),id=randomBytes(16).toString('hex');
  const body=encode({format:1,id,serviceArn:config.b.arn,scope:config.s,operation,input});
  const c=new AbortController(),started=performance.now(),abort=()=>c.abort();controller=c;active=true;
  const stopped=new Promise((_,reject)=>c.signal.addEventListener('abort',()=>reject(failure()),{once:true}));
  const timer=setTimeout(abort,timeoutMs);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  const check=()=>{if(closed||faulted||c.signal.aborted||performance.now()-started>=timeoutMs)throw failure();assertGatewayKeyCurrent(config.caller);};
  const phase=fn=>Promise.race([Promise.resolve().then(()=>{check();return fn();}),stopped]);
  try{
   assertGatewayKeyCurrent(config.caller,timeoutMs+31000);
   const key=await phase(()=>signingKey({signal:c.signal}));check();
   if(key?.type!=='private'||key.asymmetricKeyType!=='ed25519'||digest(createPublicKey(key).export({format:'der',type:'spki'}))!==config.caller.keyId)throw failure();
   const time=String(Math.floor(Date.now()/1000)),signature=sign(null,signingBytes(config.b,config.caller.keyId,time,id,body),key).toString('base64url');
   const request={protocol:'https:',hostname:config.b.host,port:443,path:config.b.path,method:'POST',agent,minVersion:'TLSv1.2',rejectUnauthorized:true,headers:{'content-type':'application/json','content-length':String(body.length),'x-gf-key-id':config.caller.keyId,'x-gf-time':time,'x-gf-nonce':id,'x-gf-signature':signature}};
   const result=await phase(()=>transport(request,Buffer.from(body),c.signal));check();
   if(result?.statusCode!==200||!exact(result.headers,['content-type'])||result.headers['content-type']!=='application/json')throw failure();
   const envelope=parse(result.body);
   if(!exact(envelope,['format','id','serviceArn','operation','bytes'])||envelope.format!==1||envelope.id!==id||envelope.serviceArn!==config.b.arn||envelope.operation!==operation||typeof envelope.bytes!=='string'||envelope.bytes.length>2732)throw failure();
   const raw=Buffer.from(envelope.bytes,'base64');if(raw.toString('base64')!==envelope.bytes)throw failure();
   return checkedReply(operation,raw,input,config);
  }catch{faulted=true;throw failure();}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);c.abort();controller=undefined;active=false;}
 }
 return Object.freeze({
  readDecision:(input,{signal}={})=>exchange('startup',input,signal),
  async readWitness(input){
   if(!input||!exact(input,Object.hasOwn(input,'signal')?['projectRef','epoch','challenge','signal']:['projectRef','epoch','challenge'])||input.projectRef!==config?.s.memberProjectRef||input.epoch!==config?.s.epoch)throw failure();
   return exchange('witness',{challenge:input.challenge},input.signal);
  },
  close(){closed=true;controller?.abort();agent?.destroy();}
 });
}

// Supplied context must be the real Lambda second argument; expected bindings
// come from an independent manifest. Shape matching is not AWS attestation.
// Mandatory claims is a durable cross-instance nonce capability, never a Set.
export function createMemberAuthorityHandler({enabled=false,claims,control,witness,timeoutMs=5500,...options}={}){
 if(typeof enabled!=='boolean'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>5500)throw failure();
 let config;
 if(enabled){config=configuration(options);if(typeof claims?.claim!=='function'||![control?.issue,control?.close,witness?.issue,witness?.close].every(x=>typeof x==='function'))throw failure();}
 let closed=false,faulted=false,active=false,controller;
 const close=()=>{closed=true;controller?.abort();if(enabled)for(const capability of [control,witness])try{capability?.close();}catch{}};
 async function handle(event,context){
  let envelope,input,claim;
  try{
   if(!enabled||closed||faulted||context?.invokedFunctionArn!==config.b.arn||context.functionName!==config.b.functionName||context.functionVersion!==config.b.version||typeof context.getRemainingTimeInMillis!=='function')throw failure();
   const remaining=context.getRemainingTimeInMillis();if(!Number.isFinite(remaining)||remaining<timeoutMs+500)throw failure();
   const rc=event?.requestContext,b=config.b;
   if(event.httpMethod!=='POST'||event.resource!==PATH||event.path!==PATH||event.isBase64Encoded!==false||event.queryStringParameters!==null||event.multiValueQueryStringParameters!==null||event.pathParameters!==null||event.stageVariables!==null||rc?.accountId!==b.accountId||rc.apiId!==b.apiId||rc.stage!==b.stage||rc.domainName!==b.host||rc.resourcePath!==PATH||rc.httpMethod!=='POST'||rc.path!==b.path||typeof event.body!=='string'||event.body.length>MAX)throw failure();
   const body=Buffer.from(event.body);if(body.length>MAX)throw failure();
   const headers=signedEventHeaders(event),time=Number(headers['x-gf-time']);
   assertGatewayKeyCurrent(config.caller);
   if(headers.host!==b.host||headers['x-gf-key-id']!==config.caller.keyId||!Number.isSafeInteger(time)||Math.abs(Math.floor(Date.now()/1000)-time)>SKEW||time*1000<config.caller.notBefore||time*1000>=config.caller.notAfter)throw failure();
   const signature=Buffer.from(headers['x-gf-signature'],'base64url');
   if(signature.length!==64||signature.toString('base64url')!==headers['x-gf-signature']||!verify(null,signingBytes(b,config.caller.keyId,headers['x-gf-time'],headers['x-gf-nonce'],body),config.caller.key,signature))throw failure();
   envelope=parse(body);
   if(!exact(envelope,['format','id','serviceArn','scope','operation','input'])||envelope.format!==1||envelope.id!==headers['x-gf-nonce']||envelope.serviceArn!==b.arn||JSON.stringify(envelope.scope)!==JSON.stringify(config.s))throw failure();
   input=requestInput(envelope.operation,envelope.input,config.s);
   claim={keyId:config.caller.keyId,nonce:envelope.id,requestSha256:digest(body),expiresAt:time+SKEW+1};
  }catch{return unavailable();}
  if(active)return unavailable();active=true;
  const c=new AbortController(),started=performance.now();controller=c;
  const stopped=new Promise((_,reject)=>c.signal.addEventListener('abort',()=>reject(failure()),{once:true})),timer=setTimeout(()=>c.abort(),timeoutMs);
  const check=()=>{if(closed||faulted||c.signal.aborted||performance.now()-started>=timeoutMs)throw failure();assertGatewayKeyCurrent(config.caller);};
  const phase=fn=>Promise.race([Promise.resolve().then(()=>{check();return fn();}),stopped]);
  try{
   const consumed=await phase(()=>claims.claim(claim,{signal:c.signal}));check();
   if(consumed===false)return unavailable();if(consumed!==true)throw failure();
   const issuer=envelope.operation==='startup'?control:witness;
   const result=await phase(()=>issuer.issue(input,{signal:c.signal}));check();
   if(result?.state!=='signed')throw failure();const bytes=checkedReply(envelope.operation,result.bytes,input,config);check();
   return response(200,{format:1,id:envelope.id,serviceArn:config.b.arn,operation:envelope.operation,bytes:bytes.toString('base64')});
  }catch{faulted=true;close();return unavailable();}
  finally{clearTimeout(timer);c.abort();controller=undefined;active=false;}
 }
 return Object.freeze({handle,close});
}
