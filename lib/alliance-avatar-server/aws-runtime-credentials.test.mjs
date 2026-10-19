import test from 'node:test';
import assert from 'node:assert/strict';
import {createLambdaExecutionRoleProvider as createProvider,createLambdaRuntimeClient as createClient,assertExplicitCredentialProvider} from './aws-runtime-credentials.mjs';
const resource=()=>({accountId:'123456789012',region:'us-east-2',functionName:'alliance-account-gateway-synthetic',version:'3'});
const creds=(letter='A')=>({accessKeyId:'ASIA'+letter.repeat(16),secretAccessKey:letter.repeat(40),sessionToken:'synthetic-memory-only-'+letter});
const context=(r=resource())=>({functionName:r.functionName,functionVersion:r.version,invokedFunctionArn:'arn:aws:lambda:'+r.region+':'+r.accountId+':function:'+r.functionName+':'+r.version,getRemainingTimeInMillis:()=>10000});
const runtime=()=>({context:context(),region:'us-east-2',credentials:creds()});
const config=()=>({region:'us-east-2',maxAttempts:1,useFipsEndpoint:false,useDualstackEndpoint:false,requestHandler:{connectionTimeout:400,requestTimeout:700,throwOnRequestTimeout:true}});
const error=/^Error: alliance_aws_runtime_unavailable$/;
function fixture(patch={}){
 const state={reads:0,opens:[],sends:0,destroys:0},p=createProvider({enabled:true,resource:resource(),readRuntime:()=>{state.reads++;return runtime();},...patch});
 const openClient=c=>{state.opens.push(c);return {send:async()=>{state.sends++;return 'ok';},destroy(){state.destroys++;}};};
 const make=options=>createClient({profile:'lambda-execution-role',credentials:p,source:resource(),target:resource(),kind:'gateway',config:config(),openClient,timeoutMs:1000,...options});
 return {p,state,make};
}
test('runtime provider defaults off and never reads platform data',async()=>{
 let calls=0;for(const enabled of [undefined,false,'true']){const p=createProvider({enabled,readRuntime:()=>calls++});await assert.rejects(p(),error);p.close();}assert.equal(calls,0);
});
test('runtime provider requires explicit exact published AWS binding and reader',()=>{
 for(const patch of [{resource:undefined},{resource:{...resource(),version:'$LATEST'}},{resource:{...resource(),version:'live'}},{resource:{...resource(),accountId:'123'}},{resource:{...resource(),region:'https://other.invalid'}},{resource:{...resource(),functionName:'other'}},{resource:{...resource(),extra:true}},{readRuntime:undefined},{kind:'netlify'},{timeoutMs:1001}])assert.throws(()=>fixture(patch),error);
});
test('runtime snapshots contain exactly the three platform fields and are fresh immutable copies',async()=>{
 const value=runtime();let reads=0;const f=fixture({readRuntime:()=>{reads++;return value;}});
 try{const a=await f.p();assert.deepEqual(Object.keys(a),['accessKeyId','secretAccessKey','sessionToken']);assert.ok(Object.isFrozen(a));value.credentials=creds('B');const b=await f.p();assert.equal(a.accessKeyId,creds().accessKeyId);assert.equal(b.accessKeyId,creds('B').accessKeyId);assert.notEqual(a,b);assert.equal(reads,2);assert.equal(Object.hasOwn(b,'expiration'),false);}finally{f.p.close();}
});
test('wrong actual context, account, region, version, alias or remaining time permanently faults provider',async()=>{
 for(const patch of [v=>v.context.invokedFunctionArn=v.context.invokedFunctionArn.replace('123456789012','999999999999'),v=>v.region='us-west-2',v=>v.context.functionVersion='4',v=>v.context.functionName='other',v=>v.context.invokedFunctionArn=v.context.invokedFunctionArn.replace(':3',':live'),v=>v.context.getRemainingTimeInMillis=()=>NaN,v=>v.context.getRemainingTimeInMillis=()=>1099,v=>v.extra=true]){
  let reads=0;const f=fixture({readRuntime:()=>{reads++;const value=runtime();patch(value);return value;}});try{await assert.rejects(f.p({minimumRemainingMs:1100}),error);await assert.rejects(f.p(),error);assert.equal(reads,1);}finally{f.p.close();}
 }
});
test('runtime credentials refuse AKIA, tokenless, malformed, extra expiry or source fields without conversion',async()=>{
 for(const patch of [{accessKeyId:'AKIA'+'A'.repeat(16)},{sessionToken:undefined},{sessionToken:'bad\nvalue'},{secretAccessKey:'short'},{expiration:new Date(Date.now()+900000)},{source:'environment'}]){
  const f=fixture({readRuntime:()=>({...runtime(),credentials:{...creds(),...patch}})});try{await assert.rejects(f.p(),error);}finally{f.p.close();}
 }
});
test('runtime profile is explicit and cannot be selected by an arbitrary provider or wrong manifest',()=>{
 const f=fixture();try{
  for(const patch of [{profile:'automatic'},{credentials:async()=>creds()},{source:undefined},{source:{...resource(),version:'4'}},{source:{...resource(),extra:true}},{target:{...resource(),accountId:'999999999999'}},{target:{...resource(),region:'us-west-2'}},{kind:'authority'},{config:{...config(),maxAttempts:2}},{config:{...config(),region:'us-west-2'}}])assert.throws(()=>f.make(patch),error);
  assert.throws(()=>assertExplicitCredentialProvider(f.p),error);assert.throws(()=>assertExplicitCredentialProvider(async()=>creds(),resource()),error);assert.doesNotThrow(()=>assertExplicitCredentialProvider(async()=>creds()));assert.equal(f.state.reads,0);assert.equal(f.state.opens.length,0);
 }finally{f.p.close();}
});
test('runtime client obtains credentials and destroys one owned SDK client per send with no reuse',async()=>{
 let reads=0;const f=fixture({readRuntime:()=>({...runtime(),credentials:creds(++reads===1?'A':'B')})}),c=f.make();
 try{assert.equal(await c.send({}),'ok');assert.equal(await c.send({}),'ok');assert.equal(reads,2);assert.equal(f.state.opens.length,2);assert.equal(f.state.destroys,2);for(const value of f.state.opens){assert.ok(Object.isFrozen(value.credentials));assert.equal(Object.hasOwn(value.credentials,'expiration'),false);assert.equal(value.requestHandler.httpsAgent.options.minVersion,'TLSv1.2');assert.equal(value.requestHandler.httpsAgent.options.rejectUnauthorized,true);assert.equal(value.requestHandler.httpsAgent.options.keepAlive,false);}assert.equal(f.state.opens[0].credentials.accessKeyId,creds().accessKeyId);assert.equal(f.state.opens[1].credentials.accessKeyId,creds('B').accessKeyId);}finally{c.destroy();f.p.close();}
});
test('missing credentials on next request cannot fall back to a previous successful snapshot',async()=>{
 let reads=0;const f=fixture({readRuntime:()=>++reads===1?runtime():null}),c=f.make();
 try{assert.equal(await c.send({}),'ok');await assert.rejects(c.send({}),error);await assert.rejects(c.send({}),error);assert.equal(reads,2);assert.equal(f.state.opens.length,1);assert.equal(f.state.sends,1);}finally{c.destroy();f.p.close();}
});
test('pre-cancelled request and closed client do not read credentials or open SDK clients',async()=>{
 const f=fixture(),c=f.make(),abort=new AbortController();abort.abort();
 try{await assert.rejects(c.send({},{abortSignal:abort.signal}),error);c.destroy();await assert.rejects(c.send({}),error);assert.equal(f.state.reads,0);assert.equal(f.state.opens.length,0);}finally{c.destroy();f.p.close();}
});
test('close during delayed runtime lookup discards late credentials before any SDK construction',async()=>{
 let enter,release;const ready=new Promise(r=>enter=r),f=fixture({readRuntime:()=>{enter();return new Promise(r=>release=r);}}),c=f.make();
 try{const pending=c.send({});await ready;c.destroy();await assert.rejects(pending,error);release(runtime());await new Promise(r=>setImmediate(r));assert.equal(f.state.opens.length,0);}finally{release?.(runtime());c.destroy();f.p.close();}
});
test('provider deadline sanitizes diagnostics and quarantines late or failed readers',async()=>{
 let release,reads=0;const f=fixture({timeoutMs:25,readRuntime:()=>{reads++;return new Promise(r=>release=r);}});
 try{await assert.rejects(f.p(),error);release(runtime());await new Promise(r=>setImmediate(r));await assert.rejects(f.p(),error);assert.equal(reads,1);}finally{release?.(runtime());f.p.close();}
 const broken=fixture({readRuntime:()=>{throw Error('private-runtime-provider-detail');}});try{await assert.rejects(broken.p(),error);}finally{broken.p.close();}
});
test('runtime client bounds in-flight work and close aborts a send without replay or private error escape',async()=>{
 const f=fixture();let enter,release,sends=0,destroys=0;const ready=new Promise(r=>enter=r),c=f.make({openClient:()=>({send:()=>{sends++;enter();return new Promise(r=>release=r);},destroy(){destroys++;}})});
 try{const pending=c.send({});await ready;await assert.rejects(c.send({}),error);c.destroy();await assert.rejects(pending,error);release('late');await new Promise(r=>setImmediate(r));assert.equal(sends,1);assert.ok(destroys>=1);}finally{release?.('late');c.destroy();f.p.close();}
});
test('runtime client carries only conditional-failure classification and metadata, never raw provider errors',async()=>{
 const f=fixture(),c=f.make({openClient:()=>({send:async()=>{throw Object.assign(Error('private-sdk-detail'),{name:'ConditionalCheckFailedException',$metadata:{httpStatusCode:400,attempts:1,totalRetryDelay:0,requestId:'private-id'},extra:'private-extra'});},destroy(){}})});
 try{await assert.rejects(c.send({}),e=>e.message==='alliance_aws_runtime_unavailable'&&e.name==='ConditionalCheckFailedException'&&JSON.stringify(e.$metadata)==='{"httpStatusCode":400,"attempts":1,"totalRetryDelay":0}'&&!Object.hasOwn(e,'extra'));}finally{c.destroy();f.p.close();}
});
