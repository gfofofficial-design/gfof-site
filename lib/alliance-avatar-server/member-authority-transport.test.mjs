import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {createMemberAuthorityTransport,createMemberAuthorityHandler} from './member-authority-transport.mjs';
import {createAnchoredControlAuthority} from './control-authority.mjs';
import {createAnchoredJournalWitness} from './anchored-witness.mjs';
import {controlPolicySha256} from './control-policy.mjs';
import {createDynamoMemberAuthorityNonceStore} from './account-gateway-nonce.mjs';
import {createLambdaExecutionRoleProvider} from './aws-runtime-credentials.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex'),zero={sequence:0,sha256:'0'.repeat(64)};
const scope={memberProjectRef:'abcdefghijklmnopqrst',journalProjectRef:'uvwxyzabcdefghijklmn',controlProjectRef:'opqrstuvwxyzabcdefgh',epoch:'11111111-1111-4111-8111-111111111111'};
const gateway={apiId:'abcdefghij',region:'us-east-2',stage:'preview'};
const resource={accountId:'123456789012',region:'us-east-2',functionName:'alliance-member-authority-synthetic',version:'7'};
const arn=`arn:aws:lambda:${resource.region}:${resource.accountId}:function:${resource.functionName}:${resource.version}`;
const context=()=>({...resource,functionVersion:resource.version,invokedFunctionArn:arn,getRemainingTimeInMillis:()=>10000});
const startup=()=>({format:1,memberProjectRef:scope.memberProjectRef,journalProjectRef:scope.journalProjectRef,epoch:scope.epoch,bootId:'a'.repeat(64),challenge:'b'.repeat(64)});
const witness=()=>({projectRef:scope.memberProjectRef,epoch:scope.epoch,challenge:'c'.repeat(64)});
const key=()=>{const pair=generateKeyPairSync('ed25519');return {pair,hex:Buffer.from(pair.publicKey.export({format:'jwk'}).x,'base64url').toString('hex')};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve};};
const refuses=p=>assert.rejects(p,e=>e.message==='alliance_member_authority_unavailable'&&!e.cause);

function proxy(options,body){
 const headers={...options.headers,host:options.hostname};
 return {resource:'/member-authority',path:'/member-authority',httpMethod:'POST',headers,multiValueHeaders:Object.fromEntries(Object.entries(headers).map(([k,v])=>[k,[v]])),queryStringParameters:null,multiValueQueryStringParameters:null,pathParameters:null,stageVariables:null,isBase64Encoded:false,body:body.toString('utf8'),requestContext:{accountId:resource.accountId,apiId:gateway.apiId,stage:gateway.stage,domainName:options.hostname,resourcePath:'/member-authority',path:options.path,httpMethod:'POST'}};
}
function resign(event,pair,domain='GF-ALLIANCE-MEMBER-AUTHORITY-V1'){
 const h=event.headers;
 const message=Buffer.from([domain,'POST',`https://${h.host}`,event.requestContext.path,arn,h['x-gf-key-id'],h['x-gf-time'],h['x-gf-nonce'],sha(Buffer.from(event.body))].join('\n'));
 h['x-gf-signature']=sign(null,message,pair.privateKey).toString('base64url');
 event.multiValueHeaders=Object.fromEntries(Object.entries(h).map(([k,v])=>[k,[v]]));return event;
}
function fixture({client:clientOptions={},server:serverOptions={},claim,requestChange,replyChange,contextChange,controlIssue,witnessIssue,transport}={}){
 const caller=key(),controlKey=key(),journalKey=key(),spki=caller.pair.publicKey.export({format:'der',type:'spki'});
 const callerKey={keyId:sha(spki),spki:spki.toString('base64'),notBeforeUtc:new Date(Math.floor(Date.now()/1000)*1000-60000).toISOString(),notAfterUtc:new Date(Date.now()+3600000).toISOString()};
 const options={gateway,resource,scope,callerKey,controlVerificationKey:controlKey.hex,journalVerificationKey:journalKey.hex};
 const anchor={format:1,memberProjectRef:scope.memberProjectRef,journalProjectRef:scope.journalProjectRef,epoch:scope.epoch,...zero};
 const raw={format:1,memberProjectRef:scope.memberProjectRef,journalProjectRef:scope.journalProjectRef,epoch:scope.epoch,revision:2,state:'review',changeId:'22222222-2222-4222-8222-222222222222',freezeId:'33333333-3333-4333-8333-333333333333',frozenAt:'2026-01-01T00:00:00.000Z',checkpointSha256:'f'.repeat(64),floor:zero};
 const policy={...raw,sha256:controlPolicySha256(raw)};
 const control=createAnchoredControlAuthority({enabled:true,...scope,verificationKey:controlKey.hex,minimum:{revision:2,sha256:policy.sha256,floor:zero},store:{read:async()=>structuredClone(policy)},anchorStore:{read:async()=>structuredClone(anchor)},signBytes:bytes=>sign(null,bytes,controlKey.pair.privateKey)});
 const journal=createAnchoredJournalWitness({enabled:true,projectRef:scope.memberProjectRef,journalProjectRef:scope.journalProjectRef,epoch:scope.epoch,verificationKey:journalKey.hex,minimum:zero,anchorStore:{read:async()=>structuredClone(anchor)},store:{tip:async()=>({projectRef:scope.memberProjectRef,epoch:scope.epoch,enabled:true,...zero}),records:async()=>[]},signBytes:bytes=>sign(null,bytes,journalKey.pair.privateKey),timeoutMs:3500});
 const calls={keys:0,transport:0,claims:0,control:0,witness:0,closes:0};const seen=new Set();let lastEvent,lastOptions;
 const claims={claim:async(q,o)=>{calls.claims++;assert.deepEqual(Object.keys(q),['keyId','nonce','requestSha256','expiresAt']);if(claim)return claim(q,o);if(seen.has(q.nonce))return false;seen.add(q.nonce);return true;}};
 const issuers={control:{issue:async(q,o)=>{calls.control++;return controlIssue?controlIssue(q,o,control):control.issue(q,o);},close(){calls.closes++;control.close();}},witness:{issue:async(q,o)=>{calls.witness++;return witnessIssue?witnessIssue(q,o,journal):journal.issue(q,o);},close(){calls.closes++;journal.close();}}};
 const server=createMemberAuthorityHandler({enabled:true,...options,claims,...issuers,...serverOptions});
 const client=createMemberAuthorityTransport({enabled:true,...options,signingKey:async()=>{calls.keys++;return caller.pair.privateKey;},transport:async(o,b,s)=>{
  calls.transport++;lastOptions=o;lastEvent=proxy(o,b);if(requestChange)lastEvent=requestChange(lastEvent,caller.pair);
  if(transport)return transport(o,b,s);
  const result=await server.handle(lastEvent,contextChange?contextChange(context()):context());
  const reply={statusCode:result.statusCode,headers:{'content-type':result.headers['content-type']},body:Buffer.from(result.body)};
  return replyChange?replyChange(reply,{caller,controlKey,journalKey}):reply;
 },...clientOptions});
 return {client,server,calls,options,caller,issuers,claims,get lastEvent(){return lastEvent;},get lastOptions(){return lastOptions;},close(){client.close();server.close();}};
}

test('default closed factories perform no key, transport, claim or issuer action',async()=>{
 let calls=0;const fail=()=>{calls++;throw Error('unexpected');};
 const client=createMemberAuthorityTransport({signingKey:fail,transport:fail}),server=createMemberAuthorityHandler({claims:{claim:fail},control:{issue:fail,close:fail},witness:{issue:fail,close:fail}});
 await refuses(client.readDecision(startup()));await refuses(client.readWitness(witness()));assert.equal((await server.handle({},context())).statusCode,503);client.close();server.close();assert.equal(calls,0);
});
test('actual control and journal issuers cross the signed transport with exact correlation and pinned TLS settings',async()=>{
 const f=fixture();try{
  const decision=JSON.parse(await f.client.readDecision(startup())),anchor=JSON.parse(await f.client.readWitness(witness()));
  assert.equal(decision.decision.challenge,startup().challenge);assert.equal(decision.decision.state,'review');assert.equal(anchor.anchor.sequence,0);
  assert.equal(f.calls.control,1);assert.equal(f.calls.witness,1);assert.equal(f.calls.claims,2);assert.equal(f.calls.transport,2);
  assert.equal(f.lastOptions.hostname,'abcdefghij.execute-api.us-east-2.amazonaws.com');assert.equal(f.lastOptions.path,'/preview/member-authority');assert.equal(f.lastOptions.rejectUnauthorized,true);assert.equal(f.lastOptions.minVersion,'TLSv1.2');
  assert.equal(f.lastOptions.agent.options.maxSockets,1);assert.equal(f.lastOptions.headers.authorization,undefined);
 }finally{f.close();}
});
test('literal booleans, string identity, numeric versions and distinct three-key purposes are mandatory',()=>{
 const f=fixture();try{
  for(const extra of [{enabled:'true'},{resource:{...resource,version:'$LATEST'}},{resource:{...resource,accountId:123456789012}},{resource:{...resource,functionName:'alliance-account-authority-synthetic'}},{scope:{...scope,journalProjectRef:scope.memberProjectRef}},{journalVerificationKey:f.options.controlVerificationKey},{controlVerificationKey:f.caller.hex}])assert.throws(()=>createMemberAuthorityTransport({...f.options,enabled:true,signingKey:async()=>f.caller.pair.privateKey,...extra}));
  assert.throws(()=>createMemberAuthorityHandler({enabled:true,...f.options,...f.issuers}));
 }finally{f.close();}
});
test('wrong client scope or malformed challenge is refused before key loading or transport',async()=>{
 const f=fixture();try{
  await refuses(f.client.readDecision({...startup(),epoch:'22222222-2222-4222-8222-222222222222'}));
  await refuses(f.client.readWitness({...witness(),projectRef:scope.journalProjectRef}));
  await refuses(f.client.readDecision({...startup(),challenge:'bad'}));
  await refuses(f.client.readDecision(startup(),{signal:{aborted:false}}));
  assert.equal(f.calls.keys,0);assert.equal(f.calls.transport,0);
  await f.client.readDecision(startup());assert.equal(f.calls.control,1);
 }finally{f.close();}
});
test('wrong private caller key is refused before transport',async()=>{
 const wrong=key(),f=fixture({client:{signingKey:()=>wrong.pair.privateKey}});try{await refuses(f.client.readDecision(startup()));assert.equal(f.calls.transport,0);assert.equal(f.calls.claims,0);}finally{f.close();}
});
test('a startup signature cannot substitute for a deletion witness',async()=>{
 const f=fixture({witnessIssue:()=>({state:'signed',bytes:Buffer.from('{"decision":{},"signature":"'+ '0'.repeat(128)+'"}')})});try{await refuses(f.client.readWitness(witness()));assert.equal(f.calls.claims,1);assert.equal(f.calls.witness,1);assert.equal(f.calls.closes,2);}finally{f.close();}
});
for(const [name,change] of Object.entries({
 'tampered signature':e=>{e.headers['x-gf-signature']='A'.repeat(86);e.multiValueHeaders['x-gf-signature']=[e.headers['x-gf-signature']];return e;},
 'old account-checkpoint signature domain':(e,k)=>resign(e,k,'GF-ALLIANCE-GATEWAY-V1'),
 'duplicated signed header':e=>{e.headers['X-GF-Key-Id']=e.headers['x-gf-key-id'];return e;},
 'ambiguous multi-value header':e=>{e.multiValueHeaders['x-gf-time'].push(e.headers['x-gf-time']);return e;},
 'query string':e=>({...e,queryStringParameters:{extra:'1'}}),
 'base64 API body':e=>({...e,isBase64Encoded:true}),
 'wrong HTTP path':e=>({...e,path:'/checkpoint'}),
 'wrong API stage':e=>({...e,requestContext:{...e.requestContext,stage:'other'}}),
 'duplicate JSON keys':(e,k)=>{e.body=e.body.replace('"format":1','"format":1,"format":1');return resign(e,k);},
 'noncanonical whitespace':(e,k)=>{e.body=' '+e.body;return resign(e,k);},
 'signed wrong control project':(e,k)=>{const v=JSON.parse(e.body);v.scope.controlProjectRef='12345678901234567890';e.body=JSON.stringify(v);return resign(e,k);},
 'signed arbitrary signing operation':(e,k)=>{const v=JSON.parse(e.body);v.operation='sign';e.body=JSON.stringify(v);return resign(e,k);},
 'signed raw message injection':(e,k)=>{const v=JSON.parse(e.body);v.input.message='not an authority request';e.body=JSON.stringify(v);return resign(e,k);},
 'clock beyond skew':(e,k)=>{e.headers['x-gf-time']=String(Math.floor(Date.now()/1000)-31);return resign(e,k);}
}))test(`${name} never reaches nonce store or issuer`,async()=>{
 const f=fixture({requestChange:change});try{await refuses(f.client.readDecision(startup()));assert.equal(f.calls.claims,0);assert.equal(f.calls.control,0);assert.equal(f.calls.witness,0);}finally{f.close();}
});
for(const [name,change] of Object.entries({alias:c=>({...c,invokedFunctionArn:arn.replace(/:7$/,':alias')}),wrongVersion:c=>({...c,functionVersion:'8'}),wrongFunction:c=>({...c,functionName:'other'}),deadline:c=>({...c,getRemainingTimeInMillis:()=>10})}))test(`actual-context ${name} mismatch cannot invoke an authority`,async()=>{
 const f=fixture({contextChange:change});try{await refuses(f.client.readDecision(startup()));assert.equal(f.calls.claims,0);assert.equal(f.calls.control,0);}finally{f.close();}
});
test('replay is denied across two handlers sharing claims; fresh requests still work after a known duplicate',async()=>{
 const f=fixture();const second=createMemberAuthorityHandler({enabled:true,...f.options,claims:f.claims,...f.issuers});try{
  await f.client.readDecision(startup());const original=structuredClone(f.lastEvent);
  assert.equal((await second.handle(original,context())).statusCode,503);assert.equal(f.calls.control,1);
  assert.equal((await f.server.handle(original,context())).statusCode,503);await f.client.readWitness(witness());assert.equal(f.calls.witness,1);
 }finally{second.close();f.close();}
});

test('signed member transport consumes a simulated Dynamo record before issuing; replay and uncertain writes cannot issue twice',async()=>{
 const items=new Map(),commands=[],meta={httpStatusCode:200,attempts:1,totalRetryDelay:0};let loseWriteResponse=false;
 const table={accountId:resource.accountId,region:resource.region,tableName:'alliance-member-nonce-synthetic',tableId:'11111111-2222-3333-4444-555555555555',epoch:scope.epoch};
 const openClient=()=>({destroy(){},async send(command){
  const q=command.input,name=command.constructor.name;commands.push(name);assert.equal(q.TableName,table.tableName);
  if(name==='DescribeTableCommand')return {$metadata:meta,Table:{TableName:table.tableName,TableId:table.tableId,TableArn:`arn:aws:dynamodb:${table.region}:${table.accountId}:table/${table.tableName}`,TableStatus:'ACTIVE',DeletionProtectionEnabled:true,BillingModeSummary:{BillingMode:'PAY_PER_REQUEST'},KeySchema:[{AttributeName:'nonceKey',KeyType:'HASH'}],AttributeDefinitions:[{AttributeName:'nonceKey',AttributeType:'S'}]}};
  if(name==='DescribeTimeToLiveCommand')return {$metadata:meta,TimeToLiveDescription:{TimeToLiveStatus:'ENABLED',AttributeName:'expiresAt'}};
  if(name==='PutItemCommand'){assert.equal(q.ConditionExpression,'attribute_not_exists(#key)');if(items.has(q.Item.nonceKey.S))throw Object.assign(Error('synthetic duplicate'),{name:'ConditionalCheckFailedException',$metadata:{...meta,httpStatusCode:400}});items.set(q.Item.nonceKey.S,structuredClone(q.Item));if(loseWriteResponse)throw Error('synthetic lost write response');return {$metadata:meta};}
  if(name==='GetItemCommand'){assert.equal(q.ConsistentRead,true);return {$metadata:meta,Item:structuredClone(items.get(q.Key.nonceKey.S))};}
  throw Error('unexpected operation');
 }});
 const provider=createLambdaExecutionRoleProvider({enabled:true,kind:'member-authority',resource,readRuntime:()=>({region:resource.region,context:context(),credentials:{accessKeyId:'ASIA'+'A'.repeat(16),secretAccessKey:'A'.repeat(40),sessionToken:'synthetic-memory-only-session'}})});
 let first,second,other;const f=fixture({claim:(q,o)=>first.claim(q,o)});
 const make=()=>createDynamoMemberAuthorityNonceStore({enabled:true,resource:table,callerKeyId:f.options.callerKey.keyId,credentials:provider,credentialProfile:'lambda-execution-role',credentialSource:resource,openClient});
 try{
  first=make();second=make();other=createMemberAuthorityHandler({enabled:true,...f.options,claims:second,...f.issuers});
  await f.client.readDecision(startup());assert.equal(f.calls.control,1);assert.equal(items.size,1);assert.equal(commands.length,6);
  assert.equal((await other.handle(structuredClone(f.lastEvent),context())).statusCode,503);assert.equal(f.calls.control,1);assert.equal(commands.length,11);assert.equal(items.size,1);
  await f.client.readWitness(witness());assert.equal(f.calls.witness,1);assert.equal(items.size,2);
  loseWriteResponse=true;await refuses(f.client.readDecision(startup()));assert.equal(items.size,3);assert.equal(f.calls.control,1);assert.equal(f.calls.witness,1);
  const n=commands.length;await refuses(f.client.readDecision(startup()));assert.equal(commands.length,n);
  assert.equal((await other.handle(structuredClone(f.lastEvent),context())).statusCode,503);assert.equal(f.calls.control,1);assert.equal(items.size,3);
 }finally{other?.close();first?.close();second?.close();provider.close();f.close();}
});
for(const value of [undefined,0,'true'])test(`nonboolean nonce result ${String(value)} cannot dispatch and faults closed`,async()=>{
 const f=fixture({claim:()=>value});try{await refuses(f.client.readDecision(startup()));assert.equal(f.calls.control,0);assert.equal(f.calls.closes,2);await refuses(f.client.readDecision(startup()));assert.equal(f.calls.transport,1);}finally{f.close();}
});
test('late uncertain nonce completion cannot dispatch; no retry or renewed server instance is created',async()=>{
 const wait=deferred(),f=fixture({server:{timeoutMs:10},claim:()=>wait.promise});try{
  await refuses(f.client.readDecision(startup()));wait.resolve(true);await tick();assert.equal(f.calls.control,0);assert.equal(f.calls.claims,1);assert.equal(f.calls.closes,2);
 }finally{f.close();}
});
test('late signing-key load after client deadline never reaches transport',async()=>{
 const wait=deferred(),f=fixture({client:{timeoutMs:10,signingKey:()=>wait.promise}});try{
  await refuses(f.client.readDecision(startup()));wait.resolve(f.caller.pair.privateKey);await tick();assert.equal(f.calls.transport,0);await refuses(f.client.readDecision(startup()));
 }finally{f.close();}
});
test('client cancellation and close retire in-flight work with no automatic retry',async()=>{
 const wait=deferred(),started=deferred(),controller=new AbortController();
 const f=fixture({transport:()=>{started.resolve();return wait.promise;}});try{
  const pending=f.client.readDecision(startup(),{signal:controller.signal});await started.promise;controller.abort();await refuses(pending);wait.resolve({statusCode:503});await tick();
  await refuses(f.client.readWitness(witness()));assert.equal(f.calls.transport,1);assert.equal(f.calls.claims,0);
 }finally{f.close();}
});
test('one active client exchange has no queue and cannot overlap key loading',async()=>{
 const wait=deferred(),started=deferred();const f=fixture({transport:()=>{started.resolve();return wait.promise;}});try{
  const pending=f.client.readDecision(startup());await started.promise;await refuses(f.client.readWitness(witness()));assert.equal(f.calls.keys,1);f.client.close();await refuses(pending);wait.resolve({statusCode:503});
 }finally{f.close();}
});
for(const [name,change] of Object.entries({
 correlation:r=>{const v=JSON.parse(r.body);v.id='f'.repeat(32);return {...r,body:Buffer.from(JSON.stringify(v))};},
 operation:r=>{const v=JSON.parse(r.body);v.operation='witness';return {...r,body:Buffer.from(JSON.stringify(v))};},
 target:r=>{const v=JSON.parse(r.body);v.serviceArn=arn.replace(/:7$/,':8');return {...r,body:Buffer.from(JSON.stringify(v))};},
 signature:r=>{const v=JSON.parse(r.body),inner=JSON.parse(Buffer.from(v.bytes,'base64'));inner.signature='0'.repeat(128);v.bytes=Buffer.from(JSON.stringify(inner)).toString('base64');return {...r,body:Buffer.from(JSON.stringify(v))};},
 padding:r=>{const v=JSON.parse(r.body);v.bytes+='=';return {...r,body:Buffer.from(JSON.stringify(v))};},
 redirect:r=>({...r,statusCode:302,headers:{...r.headers,location:'https://example.invalid'}}),
 extraHeaders:r=>({...r,headers:{...r.headers,'set-cookie':'never'}})
}))test(`changed response ${name} is refused without retry`,async()=>{
 const f=fixture({replyChange:change});try{await refuses(f.client.readDecision(startup()));await refuses(f.client.readDecision(startup()));assert.equal(f.calls.transport,1);assert.equal(f.calls.control,1);}finally{f.close();}
});
test('server refuses malformed issuer results and reveals no internal error text',async()=>{
 const f=fixture({controlIssue:()=>{throw Error('PRIVATE FIXTURE ERROR - MUST NOT ESCAPE');}});try{
  await refuses(f.client.readDecision(startup()));assert.equal(f.calls.control,1);assert.equal(f.calls.closes,2);
  const result=await f.server.handle(f.lastEvent,context());assert.equal(result.body,'{"state":"unavailable"}');
 }finally{f.close();}
});
