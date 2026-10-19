import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {createLambdaExecutionRoleProvider} from './aws-runtime-credentials.mjs';
import {createDynamoAccountCheckpointStore} from './account-dynamodb-store.mjs';
import {createAccountCheckpointAuthority} from './account-checkpoint-authority.mjs';
import {accountHandoffBytes} from './account-handoff.mjs';
import {accountEvent,accountRecord} from './account-history.mjs';
const zero={sequence:0,sha256:'0'.repeat(64)},key='b'.repeat(64),tag='a'.repeat(64),sha=b=>createHash('sha256').update(b).digest('hex');
const scope={memberProjectRef:'abcdefghijklmnopqrst',journalProjectRef:'uvwxyzabcdefghijklmn',controlProjectRef:'opqrstuvwxyzabcdefgh',epoch:'11111111-1111-4111-8111-111111111111'},hs={memberProjectRef:scope.memberProjectRef,journalProjectRef:scope.journalProjectRef,epoch:scope.epoch};
const one=accountRecord({scope:hs,sequence:1,previous:zero.sha256,event:accountEvent({kind:'account_admitted',subject:tag})}),point={sequence:1,sha256:one.sha256};
const base=()=>({format:1,scope,generation:1,previousSha256:zero.sha256,verificationKey:key,minimum:{head:point,acknowledged:zero},pending:null});
const resource=()=>({accountId:'123456789012',region:'us-east-2',tableName:'alliance-account-authority-synthetic',tableId:'11111111-2222-3333-4444-555555555555',rootKey:'c'.repeat(64),custodyId:'d'.repeat(64)});
const meta={httpStatusCode:200,attempts:1,totalRetryDelay:0};
const receipt=b=>({generation:JSON.parse(b).generation,sha256:sha(b)}),clone=x=>structuredClone(x);
function fixture(){
 const r=resource(),initialBytes=accountHandoffBytes(base()),initial=receipt(initialBytes),calls=[],configs=[];
 const m={item:{rootKey:{S:r.rootKey},custodyId:{S:r.custodyId},generation:{N:'1'},sha256:{S:initial.sha256},bytes:{B:initialBytes}},ttl:'DISABLED',table:{TableArn:`arn:aws:dynamodb:${r.region}:${r.accountId}:table/${r.tableName}`,TableName:r.tableName,TableId:r.tableId,TableStatus:'ACTIVE',DeletionProtectionEnabled:true,BillingModeSummary:{BillingMode:'PAY_PER_REQUEST'},KeySchema:[{AttributeName:'rootKey',KeyType:'HASH'}],AttributeDefinitions:[{AttributeName:'rootKey',AttributeType:'S'}]},before:undefined,afterPut:undefined};
 const conditional=()=>Object.assign(Error('PRIVATE conditional detail'),{name:'ConditionalCheckFailedException',$metadata:{...meta,httpStatusCode:400}});
 const openClient=config=>{configs.push(config);return {destroy(){calls.push({name:'destroy'});},async send(command,options){
  const name=command.constructor.name,input=command.input;calls.push({name,input:clone(input)});await m.before?.(name,input,options);
  if(name==='DescribeTableCommand')return {$metadata:{...meta},Table:clone(m.table)};
  if(name==='DescribeTimeToLiveCommand')return {$metadata:{...meta},TimeToLiveDescription:{TimeToLiveStatus:m.ttl}};
  if(name==='GetItemCommand'){assert.equal(input.ConsistentRead,true);return {$metadata:{...meta},Item:clone(m.item)};}
  if(name==='PutItemCommand'){
   const e=input.ExpressionAttributeValues;
   if(!m.item||m.item.generation.N!==e[':generation'].N||m.item.sha256.S!==e[':sha'].S||m.item.custodyId.S!==e[':custody'].S||!Buffer.from(m.item.bytes.B).equals(Buffer.from(e[':bytes'].B)))throw conditional();
   m.item=clone(input.Item);m.afterPut?.();return {$metadata:{...meta}};
  }
  throw Error('Unexpected privileged operation');
 }};};
 const make=patch=>createDynamoAccountCheckpointStore({enabled:true,scope,verificationKey:key,resource:r,credentials:async()=>{throw Error('Private provider not used by mock transport');},openClient,...patch});
 const request=(patch={})=>{const bytes=accountHandoffBytes({...base(),generation:2,previousSha256:initial.sha256,...patch});return {expected:{...initial},bytes};};
 return {r,m,calls,configs,initial,initialBytes,make,request,conditional};
}
test('Dynamo store defaults off with no client, credentials, network or implicit initialization',async()=>{
 let opens=0,creds=0;const s=createDynamoAccountCheckpointStore({credentials:()=>creds++,openClient:()=>opens++});try{await assert.rejects(s.read(),/alliance_account_dynamodb_unavailable/);await assert.rejects(s.compareAndSet({}));assert.equal(opens,0);assert.equal(creds,0);}finally{s.close();}
});
test('enabled Dynamo store needs exact resource identity and explicit credential provider',()=>{
 const f=fixture();for(const patch of [{credentials:undefined},{resource:{...f.r,tableId:'missing'}},{resource:{...f.r,endpoint:'http://wrong'}},{resource:{...f.r,region:'ddblocal'}},{resource:{...f.r,custodyId:f.r.rootKey}},{timeoutMs:2501}])assert.throws(()=>f.make(patch));assert.equal(f.configs.length,0);
});
test('AWS client fixes HTTPS region, TLS validation, one SDK attempt and bounded sockets/timeouts',async()=>{
 const f=fixture(),s=f.make();try{const cfg=f.configs[0];assert.equal(cfg.endpoint,'https://dynamodb.us-east-2.amazonaws.com');assert.equal(cfg.maxAttempts,1);assert.equal(cfg.requestHandler.httpsAgent.options.rejectUnauthorized,true);assert.equal(cfg.requestHandler.httpsAgent.options.minVersion,'TLSv1.2');assert.equal(cfg.requestHandler.httpsAgent.maxSockets,2);assert.equal(cfg.requestHandler.throwOnRequestTimeout,true);f.r.tableName='alliance-account-authority-mutated';await s.read();assert.ok(f.calls.filter(c=>c.input).every(c=>c.input.TableName==='alliance-account-authority-synthetic'));}finally{s.close();}
});
test('strong read verifies canonical bytes and resource shape without writes',async()=>{
 const f=fixture(),s=f.make();try{const result=await s.read();assert.deepEqual(result.receipt,f.initial);assert.deepEqual(result.bytes,f.initialBytes);assert.deepEqual(f.calls.map(x=>x.name),['DescribeTableCommand','DescribeTimeToLiveCommand','GetItemCommand']);result.bytes.fill(0);assert.deepEqual((await s.read()).bytes,f.initialBytes);}finally{s.close();}
});
test('missing item, wrong custody, extra fields or changed bytes cannot become a new root',async()=>{
 for(const change of [f=>{f.m.item=undefined;},f=>{f.m.item.custodyId.S='e'.repeat(64);},f=>{f.m.item.extra={S:'unreviewed'};},f=>{f.m.item.bytes.B=Buffer.from('changed');}]){const f=fixture(),s=f.make();change(f);try{await assert.rejects(s.compareAndSet(f.request()),e=>e.outcome==='not_started');assert.ok(!f.calls.some(c=>c.name==='PutItemCommand'));}finally{s.close();}}
});
test('wrong table/account/instance, disabled protection, streams, indexes and TTL refuse before item access',async()=>{
 for(const change of [f=>{f.m.table.TableArn=f.m.table.TableArn.replace('123456789012','999999999999');},f=>{f.m.table.TableId='22222222-2222-3333-4444-555555555555';},f=>{f.m.table.TableStatus='UPDATING';},f=>{f.m.table.DeletionProtectionEnabled=false;},f=>{f.m.table.StreamSpecification={StreamEnabled:true};},f=>{f.m.table.GlobalSecondaryIndexes=[{}];},f=>{f.m.table.Replicas=[{}];},f=>{f.m.ttl='ENABLED';},f=>{f.m.table.KeySchema.push({AttributeName:'other',KeyType:'RANGE'});}]){const f=fixture(),s=f.make();change(f);try{await assert.rejects(s.read());assert.ok(!f.calls.some(c=>c.name==='GetItemCommand'||c.name==='PutItemCommand'));}finally{s.close();}}
});
test('CAS conditions include existing key, custody, generation, digest AND the previously read bytes',async()=>{
 const f=fixture(),s=f.make(),q=f.request();try{assert.deepEqual(await s.compareAndSet(q),{state:'committed',receipt:receipt(q.bytes)});const p=f.calls.find(c=>c.name==='PutItemCommand').input;assert.match(p.ConditionExpression,/attribute_exists/);assert.deepEqual(p.ExpressionAttributeValues[':bytes'].B,new Uint8Array(f.initialBytes));assert.equal(p.ReturnValuesOnConditionCheckFailure,'NONE');assert.equal(p.ReturnValues,'NONE');assert.deepEqual((await s.read()).bytes,q.bytes);assert.equal(f.calls.filter(c=>c.name==='PutItemCommand').length,1);}finally{s.close();}
});
test('stale expected state returns current conflict without a write attempt',async()=>{
 const f=fixture(),s=f.make();try{const q=f.request();await s.compareAndSet(q);assert.deepEqual(await s.compareAndSet(q),{state:'conflict',receipt:receipt(q.bytes)});assert.equal(f.calls.filter(c=>c.name==='PutItemCommand').length,1);}finally{s.close();}
});
test('conditional-failure response causes a fresh read, never SDK/application retry',async()=>{
 const f=fixture(),s=f.make(),q=f.request();f.m.before=(name,input)=>{if(name==='PutItemCommand'){f.m.item=clone(input.Item);}};
 try{assert.deepEqual(await s.compareAndSet(q),{state:'conflict',receipt:receipt(q.bytes)});assert.equal(f.calls.filter(c=>c.name==='PutItemCommand').length,1);assert.equal(f.calls.filter(c=>c.name==='GetItemCommand').length,2);}finally{s.close();}
});
test('post-write resource replacement is unknown and cannot release a committed receipt',async()=>{
 const f=fixture(),s=f.make();f.m.afterPut=()=>{f.m.table.TableId='22222222-2222-3333-4444-555555555555';};try{await assert.rejects(s.compareAndSet(f.request()),e=>e.outcome==='unknown'&&!e.message.includes('PRIVATE'));assert.equal(f.m.item.generation.N,'2');assert.equal(f.calls.filter(c=>c.name==='PutItemCommand').length,1);}finally{s.close();}
});
test('lost write reply is sanitized unknown, while independently stored canonical bytes remain readable',async()=>{
 const f=fixture(),s=f.make(),q=f.request();let once=true;f.m.before=(name,input)=>{if(name==='PutItemCommand'&&once){once=false;f.m.item=clone(input.Item);throw Error('PRIVATE endpoint secret');}};
 try{await assert.rejects(s.compareAndSet(q),e=>e.outcome==='unknown'&&e.message==='alliance_account_dynamodb_unavailable');assert.deepEqual((await s.read()).bytes,q.bytes);assert.equal(f.calls.filter(c=>c.name==='PutItemCommand').length,1);}finally{s.close();}
});
test('malformed generation/scope or predecessor rejects before any request',async()=>{
 const f=fixture(),s=f.make();try{for(const q of [{expected:f.initial,bytes:Buffer.from('not canonical')},f.request({previousSha256:'e'.repeat(64)}),f.request({scope:{...scope,epoch:'22222222-2222-4222-8222-222222222222'}})])await assert.rejects(s.compareAndSet(q));assert.equal(f.calls.length,0);}finally{s.close();}
});
test('cancellation and timeout stop late writes without retries, queues or follow-up reads',async()=>{
 const f=fixture();let enter,release;const ready=new Promise(r=>enter=r);f.m.before=async name=>{if(name==='PutItemCommand'){enter();await new Promise(r=>release=r);}};const s=f.make({timeoutMs:60}),pending=s.compareAndSet(f.request());await ready;await assert.rejects(s.read());await assert.rejects(pending,e=>e.outcome==='unknown');const count=f.calls.length;release();await new Promise(r=>setImmediate(r));assert.equal(f.calls.length,count);assert.equal(f.calls.filter(c=>c.name==='PutItemCommand').length,1);s.close();
 const g=fixture(),t=g.make(),c=new AbortController();c.abort();try{await assert.rejects(t.read({signal:c.signal}));assert.equal(g.calls.length,0);}finally{t.close();}
});
test('trusted authority prevents semantic rollback even with increasing Dynamo generation',async()=>{
 const f=fixture(),s=f.make(),a=createAccountCheckpointAuthority({enabled:true,scope,verificationKey:key,minimum:f.initial,store:s});const q=f.request({minimum:{head:zero,acknowledged:zero}});
 try{assert.deepEqual(await a.advance({expected:q.expected,next:receipt(q.bytes),bytes:q.bytes,records:[one],kind:'ordinary'}),{state:'invalid'});assert.ok(!f.calls.some(c=>c.name==='PutItemCommand'));}finally{a.close();s.close();}
});
test('two independent authority/store instances serialize against one conditional item',async()=>{
 const f=fixture(),s=f.make(),t=f.make(),a=createAccountCheckpointAuthority({enabled:true,scope,verificationKey:key,minimum:f.initial,store:s}),b=createAccountCheckpointAuthority({enabled:true,scope,verificationKey:key,minimum:f.initial,store:t});const q=f.request();
 try{const request={expected:q.expected,next:receipt(q.bytes),bytes:q.bytes,records:[one],kind:'ordinary'},r=await Promise.all([a.advance(request),b.advance(request)]);assert.equal(r.filter(v=>v.state==='committed').length,1);assert.equal(r.filter(v=>v.state==='conflict').length,1);assert.deepEqual(Buffer.from(f.m.item.bytes.B),q.bytes);}finally{a.close();b.close();s.close();t.close();}
});

const authoritySource={accountId:'123456789012',region:'us-east-2',functionName:'alliance-account-authority-synthetic',version:'7'};
const authorityRuntime=(letter='A')=>({region:authoritySource.region,context:{functionName:authoritySource.functionName,functionVersion:authoritySource.version,invokedFunctionArn:`arn:aws:lambda:${authoritySource.region}:${authoritySource.accountId}:function:${authoritySource.functionName}:${authoritySource.version}`,getRemainingTimeInMillis:()=>10000},credentials:{accessKeyId:'ASIA'+letter.repeat(16),secretAccessKey:letter.repeat(40),sessionToken:'synthetic-authority-only-'+letter}});
test('authority root runtime profile composes exact strong read and conditional CAS with fresh credentials',async()=>{
 const f=fixture();let reads=0;const p=createLambdaExecutionRoleProvider({enabled:true,kind:'authority',resource:authoritySource,readRuntime:()=>{reads++;return authorityRuntime();}}),s=f.make({credentials:p,credentialProfile:'lambda-execution-role',credentialSource:authoritySource});
 try{assert.deepEqual((await s.read()).receipt,f.initial);const q=f.request();assert.deepEqual(await s.compareAndSet(q),{state:'committed',receipt:receipt(q.bytes)});assert.deepEqual((await s.read()).bytes,q.bytes);assert.equal(reads,12);assert.equal(f.configs.length,12);assert.equal(f.calls.filter(c=>c.name==='PutItemCommand').length,1);assert.ok(f.configs.every(c=>!Object.hasOwn(c.credentials,'expiration')));}finally{s.close();p.close();}
});
test('real Dynamo SDK root read signs three independent authority snapshots without cached reuse',async()=>{
 const f=fixture(),wire=[];let reads=0;const p=createLambdaExecutionRoleProvider({enabled:true,kind:'authority',resource:authoritySource,readRuntime:()=>authorityRuntime(String.fromCharCode(65+reads++))});
 const s=f.make({credentials:p,credentialProfile:'lambda-execution-role',credentialSource:authoritySource,openClient:config=>new DynamoDBClient({...config,requestHandler:{handle:async request=>{
  wire.push(request);const name=request.headers['x-amz-target'].split('.').at(-1),body=name==='DescribeTable'?{Table:f.m.table}:name==='DescribeTimeToLive'?{TimeToLiveDescription:{TimeToLiveStatus:'DISABLED'}}:{Item:{...f.m.item,bytes:{B:Buffer.from(f.m.item.bytes.B).toString('base64')}}};
  return {response:{statusCode:200,headers:{'content-type':'application/x-amz-json-1.0'},body:Buffer.from(JSON.stringify(body))}};
 },destroy(){}}})});
 try{assert.deepEqual((await s.read()).receipt,f.initial);assert.equal(reads,3);assert.equal(wire.length,3);assert.equal(new Set(wire.map(r=>r.headers['x-amz-security-token'])).size,3);for(const request of wire)assert.ok(request.headers.authorization.includes('Credential=ASIA'+request.headers['x-amz-security-token'].at(-1).repeat(16)+'/'));}finally{s.close();p.close();}
});
test('authority runtime credential loss after actual CAS keeps unknown and performs no follow-up SDK call',async()=>{
 const f=fixture();let reads=0;const p=createLambdaExecutionRoleProvider({enabled:true,kind:'authority',resource:authoritySource,readRuntime:()=>++reads>=5?null:authorityRuntime()}),s=f.make({credentials:p,credentialProfile:'lambda-execution-role',credentialSource:authoritySource});
 try{await assert.rejects(s.compareAndSet(f.request()),e=>e.outcome==='unknown');assert.equal(f.m.item.generation.N,'2');assert.equal(f.calls.filter(c=>c.input).length,4);const count=f.calls.length;await assert.rejects(s.read());assert.equal(f.calls.length,count);}finally{s.close();p.close();}
});
test('authority root rejects implicit runtime mode, gateway credential source and foreign source versions',()=>{
 const f=fixture(),p=createLambdaExecutionRoleProvider({enabled:true,kind:'authority',resource:authoritySource,readRuntime:()=>{throw Error('must not read');}});
 try{for(const patch of [{credentials:p},{credentials:p,credentialProfile:'lambda-execution-role',credentialSource:{...authoritySource,version:'8'}},{credentials:p,credentialProfile:'lambda-execution-role',credentialSource:{...authoritySource,functionName:'alliance-account-gateway-synthetic'}},{credentialProfile:'unknown'}])assert.throws(()=>f.make(patch));assert.equal(f.configs.length,0);}finally{p.close();}
});
