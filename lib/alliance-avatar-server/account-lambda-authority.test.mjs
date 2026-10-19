import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {LambdaClient,InvokeCommand} from '@aws-sdk/client-lambda';
import {accountEvent,accountRecord} from './account-history.mjs';
import {accountHandoffBytes} from './account-handoff.mjs';
import {createAccountCheckpointAuthority} from './account-checkpoint-authority.mjs';
import {createAccountCheckpoint} from './account-checkpoint.mjs';
import {createLambdaAccountCheckpointAuthority as createClient,createAccountAuthorityLambdaHandler as createHandler} from './account-lambda-authority.mjs';
const scope={memberProjectRef:'abcdefghijklmnopqrst',journalProjectRef:'uvwxyzabcdefghijklmn',controlProjectRef:'opqrstuvwxyzabcdefgh',epoch:'11111111-1111-4111-8111-111111111111'},key='b'.repeat(64),zero={sequence:0,sha256:'0'.repeat(64)};
const resource={accountId:'123456789012',region:'us-east-2',functionName:'alliance-account-authority-synthetic',version:'7'},arn=`arn:aws:lambda:${resource.region}:${resource.accountId}:function:${resource.functionName}:${resource.version}`;
const sha=b=>createHash('sha256').update(b).digest('hex'),pin=b=>({generation:JSON.parse(b).generation,sha256:sha(b)}),tip=r=>({sequence:r.sequence,sha256:r.sha256});
const hs={memberProjectRef:scope.memberProjectRef,journalProjectRef:scope.journalProjectRef,epoch:scope.epoch},event=kind=>accountEvent({kind,subject:'a'.repeat(64)}),one=accountRecord({scope:hs,sequence:1,previous:zero.sha256,event:event('account_admitted')}),two=accountRecord({scope:hs,sequence:2,previous:one.sha256,event:event('account_remove_requested')});
const base=()=>accountHandoffBytes({format:1,scope,generation:1,previousSha256:zero.sha256,verificationKey:key,minimum:{head:tip(one),acknowledged:zero},pending:null});
const credentials=async()=>({accessKeyId:'ASIA'+'A'.repeat(16),secretAccessKey:'synthetic-local-only-not-a-real-secret',sessionToken:'synthetic-local-only-session-token',expiration:new Date(Date.now()+900000)});
const context=()=>({functionName:resource.functionName,functionVersion:resource.version,invokedFunctionArn:arn,getRemainingTimeInMillis:()=>6000});
const envelope=(op='read',input=null)=>({format:1,id:'a'.repeat(32),serviceArn:arn,operation:op,input});
function fixture({realSdk=false,clientPatch={},handlerPatch={},transform}={}){
 let bytes=base(),calls=0,cas=0,config,request,wire;
 const initial=pin(bytes),store={read:async()=>({bytes:Buffer.from(bytes),receipt:pin(bytes)}),compareAndSet:async q=>{cas++;if(q.expected.sha256!==sha(bytes))return {state:'conflict',receipt:pin(bytes)};bytes=Buffer.from(q.bytes);return {state:'committed',receipt:pin(bytes)};}};
 const authority=createAccountCheckpointAuthority({enabled:true,scope,verificationKey:key,minimum:initial,store});
 const handler=createHandler({enabled:true,resource,scope,verificationKey:key,authority,...handlerPatch});
 const openClient=c=>{
  config=c;
  if(realSdk)return new LambdaClient({...c,requestHandler:{handle:async r=>{
   calls++;wire=r;const e=JSON.parse(Buffer.from(r.body).toString());request=e;const value=await handler(e,context());
   return {response:{statusCode:200,headers:{'content-type':'application/json','x-amz-executed-version':resource.version},body:Buffer.from(JSON.stringify(value))}};
  },destroy(){}}});
  return {destroy(){},send:async command=>{
   calls++;assert.ok(command instanceof InvokeCommand);request=JSON.parse(Buffer.from(command.input.Payload).toString());
   const value=await handler(request,context()),r={$metadata:{httpStatusCode:200,attempts:1,totalRetryDelay:0},StatusCode:200,ExecutedVersion:resource.version,Payload:Buffer.from(JSON.stringify(value))};
   return transform?transform(r,command,request):r;
  }};
 };
 const client=createClient({enabled:true,resource,scope,verificationKey:key,minimum:initial,credentials,openClient,...clientPatch});
 const requestNext=(patch={},records=[one])=>{const next=accountHandoffBytes({...JSON.parse(bytes),generation:pin(bytes).generation+1,previousSha256:sha(bytes),...patch});return {expected:pin(bytes),next:pin(next),bytes:next,records,kind:'ordinary'};};
 return {client,handler,authority,store,initial,requestNext,get bytes(){return Buffer.from(bytes);},set bytes(b){bytes=Buffer.from(b);},get calls(){return calls;},get cas(){return cas;},get config(){return config;},get request(){return request;},get wire(){return wire;},close(){client.close();authority.close();}};
}
test('Lambda transport and handler default off perform no credential/storage work',async()=>{
 let n=0;const c=createClient({credentials:()=>n++});assert.deepEqual(await c.read(),{state:'unavailable'});assert.deepEqual(await c.advance({}),{state:'unavailable'});c.close();assert.equal(n,0);
 await assert.rejects(createHandler()(envelope(),context()),/alliance_account_lambda_unavailable/);
});
test('only exact published version binding and explicit provider/pin/config are accepted',()=>{
 for(const clientPatch of [{resource:{...resource,version:'$LATEST'}},{resource:{...resource,version:'live'}},{resource:{...resource,region:'https://other.invalid'}},{resource:{...resource,functionName:'other'}},{resource:{...resource,extra:true}},{credentials:undefined},{minimum:undefined},{timeoutMs:6001},{scope:{...scope,controlProjectRef:scope.memberProjectRef}}])assert.throws(()=>fixture({clientPatch}));
});
test('one synchronous IAM command uses pinned TLS endpoint, no logs/context/async/retries',async()=>{
 const f=fixture();try{assert.deepEqual(await f.client.read(),f.initial);assert.equal(f.calls,1);const c=f.config;assert.equal(c.endpoint,'https://lambda.us-east-2.amazonaws.com');assert.equal(c.maxAttempts,1);assert.equal(c.requestHandler.httpsAgent.options.rejectUnauthorized,true);assert.equal(c.requestHandler.httpsAgent.options.minVersion,'TLSv1.2');assert.deepEqual(Object.keys(f.request),['format','id','serviceArn','operation','input']);assert.equal(f.request.serviceArn,arn);}finally{f.close();}
});
test('real SDK signs/serializes/deserializes against memory-only handler with dummy STS credentials',async()=>{
 const f=fixture({realSdk:true});try{
  assert.deepEqual(await f.client.read(),f.initial);const q=f.requestNext({minimum:{head:tip(two),acknowledged:tip(one)}},[one,two]);assert.deepEqual(await f.client.advance(q),{state:'committed',receipt:q.next});assert.equal(f.calls,2);assert.equal(f.cas,1);
  assert.equal(f.wire.hostname,'lambda.us-east-2.amazonaws.com');assert.equal(f.wire.protocol,'https:');assert.equal(f.wire.path,`/2015-03-31/functions/${encodeURIComponent(arn)}/invocations`);assert.equal(f.wire.headers['x-amz-invocation-type'],'RequestResponse');assert.equal(f.wire.headers['x-amz-log-type'],'None');assert.ok(f.wire.headers.authorization.startsWith('AWS4-HMAC-SHA256 '));assert.equal(f.wire.headers['x-amz-security-token'],'synthetic-local-only-session-token');
 }finally{f.close();}
});
test('temporary provider rejects long-lived, tokenless, expired or overly long sessions before wire I/O',async()=>{
 for(const patch of [{accessKeyId:'AKIA'+'A'.repeat(16)},{sessionToken:undefined},{expiration:new Date(0)},{expiration:new Date(Date.now()+7200000)},{secretAccessKey:''}]){
  const f=fixture({realSdk:true,clientPatch:{credentials:async()=>({...await credentials(),...patch})}});try{assert.deepEqual(await f.client.read(),{state:'unavailable'});assert.equal(f.calls,0);assert.deepEqual(await f.client.read(),{state:'unavailable'});}finally{f.close();}
 }
});
test('local invalid proof, noncanonical bytes and oversized records never invoke',async()=>{
 const f=fixture();try{
  const valid=f.requestNext();for(const q of [{},{...valid,bytes:Buffer.from('{}')},{...valid,next:f.initial},{...valid,records:Array(257).fill(one)},{...valid,records:[{large:'x'.repeat(262145)}]},{...valid,extra:true}])assert.deepEqual(await f.client.advance(q),{state:'invalid'});
  assert.equal(f.calls,0);assert.deepEqual(await f.client.read(),f.initial);
 }finally{f.close();}
});
test('wire handler refuses wrong context/version/deadline and malformed events without authority I/O',async()=>{
 let n=0;const authority={read:async()=>{n++;return pin(base());},advance:async()=>{n++;},close(){}};
 const h=createHandler({enabled:true,resource,scope,verificationKey:key,authority});
 for(const patch of [{invokedFunctionArn:arn.replace(':7',':live')},{functionVersion:'8'},{functionName:'other'},{getRemainingTimeInMillis:()=>20},{getRemainingTimeInMillis:()=>NaN}])await assert.rejects(h(envelope(),{...context(),...patch}));
 for(const e of [{...envelope(),extra:1},{...envelope(),id:'bad'},{...envelope(),serviceArn:'other'},{...envelope(),operation:'reset'},{...envelope(),input:{}},envelope('advance',{bytes:'===='})])await assert.rejects(h(e,context()));assert.equal(n,0);
});
test('response HTTP200 alone, wrong version, retries, function error and log leak are refused',async()=>{
 for(const patch of [{StatusCode:202},{ExecutedVersion:'8'},{FunctionError:'Unhandled'},{LogResult:'private'},{ $metadata:{httpStatusCode:200,attempts:2,totalRetryDelay:0}},{Payload:Buffer.from('x'.repeat(1025))},{Payload:Buffer.from([255])}]){
  const f=fixture({transform:r=>({...r,...patch})});try{assert.deepEqual(await f.client.read(),{state:'unavailable'});assert.deepEqual(await f.client.read(),{state:'unavailable'});assert.equal(f.calls,1);}finally{f.close();}
 }
});
test('wrong reply request/service/operation and extra or forged result fields fail closed',async()=>{
 for(const patch of [{id:'b'.repeat(32)},{serviceArn:arn.replace(':7',':8')},{operation:'advance'},{extra:1},{result:{...pin(base()),extra:true}},{result:{state:'committed',receipt:pin(base())}}]){
  const f=fixture({transform:r=>({...r,Payload:Buffer.from(JSON.stringify({...JSON.parse(r.Payload),...patch}))})});try{assert.deepEqual(await f.client.read(),{state:'unavailable'});}finally{f.close();}
 }
});
test('authority validates semantics after transport parsing; invalid lowering does not write',async()=>{
 const f=fixture();try{assert.deepEqual(await f.client.advance(f.requestNext({minimum:{head:zero,acknowledged:zero}})),{state:'invalid'});assert.equal(f.cas,0);assert.deepEqual(await f.client.read(),f.initial);}finally{f.close();}
});
test('client retained receipt rejects a stale lower root in the same process',async()=>{
 const f=fixture();try{const before=f.bytes,q=f.requestNext({pending:{id:'c'.repeat(64),kind:'history_append',event:event('account_remove_requested'),expected:tip(one),target:null}});assert.equal((await f.client.advance(q)).state,'committed');f.bytes=before;assert.deepEqual(await f.client.read(),{state:'unavailable'});}finally{f.close();}
});
test('lost response after actual authority write returns unknown once and blocks further calls',async()=>{
 const f=fixture({transform:()=>{throw Error('sensitive provider detail must not escape');}});try{const q=f.requestNext();assert.deepEqual(await f.client.advance(q),{state:'unknown'});assert.equal(f.cas,1);assert.equal(pin(f.bytes).generation,2);assert.deepEqual(await f.client.read(),{state:'unavailable'});assert.deepEqual(await f.client.advance(q),{state:'unavailable'});assert.equal(f.calls,1);}finally{f.close();}
});
test('conflict returns independently verified current pin without retrying',async()=>{
 const f=fixture();try{const q=f.requestNext();assert.equal((await f.client.advance(q)).state,'committed');assert.deepEqual(await f.client.advance(q),{state:'conflict',receipt:q.next});assert.equal(f.cas,1);assert.equal(f.calls,2);}finally{f.close();}
});
test('pre-cancelled and busy calls do no extra invocation; close stops delayed response',async()=>{
 let enter,release;const ready=new Promise(r=>enter=r),f=fixture({transform:async r=>{enter();await new Promise(r=>release=r);return r;}});
 try{const c=new AbortController();c.abort();assert.deepEqual(await f.client.read({signal:c.signal}),{state:'cancelled'});assert.equal(f.calls,0);const pending=f.client.advance(f.requestNext());await ready;assert.deepEqual(await f.client.read(),{state:'busy'});f.client.close();assert.deepEqual(await pending,{state:'unknown'});release();await new Promise(r=>setImmediate(r));assert.equal(f.calls,1);assert.equal(f.cas,1);}finally{release?.();f.close();}
});
test('deadline quarantines client and ignores late committed result without replay',async()=>{
 let release;const f=fixture({clientPatch:{timeoutMs:50},transform:async r=>{await new Promise(r=>release=r);return r;}});try{assert.deepEqual(await f.client.advance(f.requestNext()),{state:'unknown'});assert.equal(f.cas,1);release();await new Promise(r=>setImmediate(r));assert.deepEqual(await f.client.read(),{state:'unavailable'});assert.equal(f.calls,1);}finally{release?.();f.close();}
});
test('handler deadline closes authority, sanitizes failure and rejects later requests',async()=>{
 let closed=0,release;const h=createHandler({enabled:true,resource,scope,verificationKey:key,timeoutMs:25,authority:{read:()=>new Promise(r=>release=r),advance:async()=>{},close(){closed++;}}});
 const r=await h(envelope(),context());assert.deepEqual(r.result,{state:'unavailable'});assert.equal(closed,1);release(pin(base()));await assert.rejects(h(envelope(),context()));
});
test('real SDK coordinator composes pending advancement and resolution with one business dispatch',async()=>{
 const f=fixture({realSdk:true});let slotBytes=f.bytes,rows=[one],dispatches=0;
 const slot={read:async()=>({bytes:Buffer.from(slotBytes),receipt:pin(slotBytes)}),compareAndSet:async q=>{if(q.expected.sha256!==sha(slotBytes))return {state:'conflict',receipt:pin(slotBytes)};slotBytes=Buffer.from(q.bytes);return {state:'committed',receipt:pin(slotBytes)};}};
 const c=createAccountCheckpoint({enabled:true,reconciliationEnabled:true,scope,verificationKey:key,minimum:f.initial,slot,anchor:f.client,history:{snapshot:async()=>({scope:hs,enabled:true,admissionsOpen:true,head:tip(rows.at(-1)),records:structuredClone(rows)}),append:async()=>{dispatches++;rows=[one,two];return {state:'recorded'};}},acknowledgements:{read:async()=>zero,advance:async()=>{throw Error('Unexpected');}}});
 try{const intent={id:'c'.repeat(64),kind:'history_append',event:event('account_remove_requested'),expected:tip(one),target:null};assert.equal((await c.execute(intent)).outcome,'reported_commit');assert.equal(f.cas,1);assert.equal((await c.reconcile()).state,'resolved');assert.equal(dispatches,1);assert.equal(JSON.parse(f.bytes).pending,null);assert.deepEqual(f.bytes,slotBytes);assert.equal(f.cas,3);assert.equal(pin(f.bytes).generation,4);}finally{c.close();f.close();}
});

test('wire base64 rejects truncation, noncanonical padding, foreign scope and extra input fields',async()=>{
 const f=fixture();try{const q=f.requestNext(),wire={...q,bytes:q.bytes.toString('base64')},foreign=accountHandoffBytes({...JSON.parse(q.bytes),scope:{...scope,epoch:'22222222-2222-4222-8222-222222222222'}});for(const input of [{...wire,bytes:wire.bytes.slice(0,-1)},{...wire,bytes:'===='},{...wire,extra:true},{...wire,bytes:Buffer.from('{}').toString('base64')},{...wire,bytes:foreign.toString('base64'),next:pin(foreign)}])await assert.rejects(f.handler(envelope('advance',input),context()));assert.equal(f.cas,0);}finally{f.close();}
});
test('incorrect committed receipt and malformed write replies stay unknown and cannot dispatch again',async()=>{
 for(const result of [{state:'committed',receipt:pin(base())},{state:'committed'},{state:'reset'},{state:'committed',receipt:{generation:2,sha256:'f'.repeat(64)}}]){
  const f=fixture({transform:r=>({...r,Payload:Buffer.from(JSON.stringify({...JSON.parse(r.Payload),result}))})});try{assert.deepEqual(await f.client.advance(f.requestNext()),{state:'unknown'});assert.equal(f.cas,1);assert.deepEqual(await f.client.read(),{state:'unavailable'});assert.equal(f.calls,1);}finally{f.close();}
 }
});
test('handler captures request identity before await and never reflects extra provider details',async()=>{
 let release;const h=createHandler({enabled:true,resource,scope,verificationKey:key,authority:{read:()=>new Promise(r=>release=r),advance:async()=>{},close(){}}}),e=envelope(),pending=h(e,context());await new Promise(r=>setImmediate(r));e.id='b'.repeat(32);e.operation='advance';release(pin(base()));const r=await pending;assert.equal(r.id,'a'.repeat(32));assert.equal(r.operation,'read');assert.deepEqual(r.result,pin(base()));
});
test('actual SDK retryable service error is sent only once and uncertain writes never retry',async()=>{
 let calls=0;const c=createClient({enabled:true,resource,scope,verificationKey:key,minimum:pin(base()),credentials,openClient:config=>new LambdaClient({...config,requestHandler:{handle:async()=>{calls++;return {response:{statusCode:503,headers:{'content-type':'application/json','x-amzn-errortype':'ServiceException'},body:Buffer.from('{"message":"synthetic provider detail"}')}};},destroy(){}}})});
 const next=accountHandoffBytes({...JSON.parse(base()),generation:2,previousSha256:sha(base())}),q={expected:pin(base()),next:pin(next),bytes:next,records:[one],kind:'ordinary'};
 try{assert.deepEqual(await c.advance(q),{state:'unknown'});assert.equal(calls,1);assert.deepEqual(await c.advance(q),{state:'unavailable'});assert.equal(calls,1);}finally{c.close();}
});
test('handler sanitizes provider operation and cleanup failures without raw error escape',async()=>{
 const h=createHandler({enabled:true,resource,scope,verificationKey:key,authority:{read:async()=>{throw Error('private provider detail');},advance:async()=>{},close(){throw Error('private cleanup detail');}}});
 assert.deepEqual((await h(envelope(),context())).result,{state:'unavailable'});await assert.rejects(h(envelope(),context()),/^Error: alliance_account_lambda_unavailable$/);
});
