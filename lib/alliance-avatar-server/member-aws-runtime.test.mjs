import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createHash,sign} from 'node:crypto';
import {rootCertificates} from 'node:tls';
import {createAwsMemberAuthorityRuntime,reviewAwsMemberInstallation} from './member-aws-runtime.mjs';
import {createMemberAuthorityTransport,reviewMemberAuthorityBinding} from './member-authority-transport.mjs';
import {allianceTrustRecordBytes} from './trust-record.mjs';
import {controlPolicySha256} from './control-policy.mjs';
const zero={sequence:0,sha256:'0'.repeat(64)},sha=b=>createHash('sha256').update(b).digest('hex');
const scope={memberProjectRef:'abcdefghijklmnopqrst',journalProjectRef:'uvwxyzabcdefghijklmn',controlProjectRef:'opqrstuvwxyzabcdefgh',epoch:'11111111-1111-4111-8111-111111111111'};
const resource={accountId:'123456789012',region:'us-east-2',functionName:'alliance-member-authority-synthetic',version:'7'};
const arn=`arn:aws:lambda:${resource.region}:${resource.accountId}:function:${resource.functionName}:${resource.version}`;
const key=()=>{const pair=generateKeyPairSync('ed25519');return {...pair,hex:Buffer.from(pair.publicKey.export({format:'jwk'}).x,'base64url').toString('hex')};};
const startup=()=>({format:1,memberProjectRef:scope.memberProjectRef,journalProjectRef:scope.journalProjectRef,epoch:scope.epoch,bootId:'a'.repeat(64),challenge:'b'.repeat(64)});
const witness=()=>({projectRef:scope.memberProjectRef,epoch:scope.epoch,challenge:'c'.repeat(64)});
const metadata=()=>({httpStatusCode:200,attempts:1,totalRetryDelay:0});
const context=()=>({invokedFunctionArn:arn,functionName:resource.functionName,functionVersion:resource.version,getRemainingTimeInMillis:()=>10000});
const environment=letter=>({AWS_REGION:resource.region,AWS_EXECUTION_ENV:'AWS_Lambda_nodejs24.x',AWS_LAMBDA_FUNCTION_NAME:resource.functionName,AWS_LAMBDA_FUNCTION_VERSION:resource.version,AWS_LAMBDA_INITIALIZATION_TYPE:'on-demand',AWS_ACCESS_KEY_ID:'ASIA'+letter.repeat(16),AWS_SECRET_ACCESS_KEY:letter.repeat(40),AWS_SESSION_TOKEN:'synthetic-memory-only-token-'+letter});
function configuration(){
 const caller=key(),control=key(),journal=key(),spki=caller.publicKey.export({format:'der',type:'spki'});
 const binding={gateway:{apiId:'abcdefghij',region:resource.region,stage:'preview'},resource:{...resource},scope:{...scope},callerKey:{keyId:sha(spki),spki:spki.toString('base64'),notBeforeUtc:new Date(Date.now()-60000).toISOString(),notAfterUtc:new Date(Date.now()+3600000).toISOString()},controlVerificationKey:control.hex,journalVerificationKey:journal.hex};
 const raw={format:1,memberProjectRef:scope.memberProjectRef,journalProjectRef:scope.journalProjectRef,epoch:scope.epoch,revision:2,state:'review',changeId:'22222222-2222-4222-8222-222222222222',freezeId:'33333333-3333-4333-8333-333333333333',frozenAt:'2026-01-01T00:00:00.000Z',checkpointSha256:'f'.repeat(64),floor:zero};
 const policy={...raw,sha256:controlPolicySha256(raw)};
 const record={format:1,...scope,generation:1,previousSha256:zero.sha256,controlMinimum:{revision:policy.revision,sha256:policy.sha256,floor:zero},removalMinimum:zero,controlVerificationKey:control.hex,journalVerificationKey:journal.hex};
 const bytes=allianceTrustRecordBytes(record),signing={};
 for(const [i,purpose] of ['control','journal'].entries())signing[purpose]={accountId:resource.accountId,region:resource.region,keyArn:`arn:aws:kms:${resource.region}:${resource.accountId}:key/${String(i+1).repeat(8)}-1111-4111-8111-111111111111`};
 const installation={format:1,binding,nonce:{accountId:resource.accountId,region:resource.region,tableName:'alliance-member-nonce-synthetic',tableId:'44444444-4444-4444-8444-444444444444',epoch:scope.epoch},signing};
 return {caller,control,journal,policy,installation,trustRecordBytes:bytes,expectedTrust:{sha256:sha(bytes),minimumGeneration:1}};
}
function proxy(options,body){const headers={...options.headers,host:options.hostname};return {resource:'/member-authority',path:'/member-authority',httpMethod:'POST',headers,multiValueHeaders:Object.fromEntries(Object.entries(headers).map(([k,v])=>[k,[v]])),queryStringParameters:null,multiValueQueryStringParameters:null,pathParameters:null,stageVariables:null,isBase64Encoded:false,body:body.toString(),requestContext:{accountId:resource.accountId,apiId:'abcdefghij',stage:'preview',domainName:options.hostname,resourcePath:'/member-authority',path:options.path,httpMethod:'POST'}};}
async function fixture({shared,modifyOptions,beforeQuery}={}){
 const f=shared??configuration(),state={environment:environment('A'),environmentReads:0,pools:[],sql:[],dynamo:[],kms:[],credentials:[],ended:0,nonces:new Map(),context:context(),journalEnabled:true};
 function pool(config){state.pools.push(config);return {on(){},async end(){state.ended++;},async connect(){return {release(){},once(){},removeListener(){},async query(q){
  state.sql.push(q.text);await beforeQuery?.(q);
  if(q.text.startsWith('select current_database'))return {rows:[{database:'postgres',actor:config.user,login:config.user,tls:true,restricted:true,isolated:true,limited:true,durable:true,dedicated:true}]};
  if(q.text.includes('alliance_control.read_policy('))return {rows:[{result:structuredClone(f.policy)}]};
  if(q.text.includes('alliance_control.read_anchor('))return {rows:[{result:{format:1,memberProjectRef:scope.memberProjectRef,journalProjectRef:scope.journalProjectRef,epoch:scope.epoch,...zero}}]};
  if(q.text.includes('alliance_journal.tip('))return {rows:[{result:{projectRef:scope.memberProjectRef,epoch:scope.epoch,...zero,enabled:state.journalEnabled}}]};
  if(q.text.includes('alliance_journal.records('))return {rows:[{result:[]}]};
  if(q.text==='COMMIT')return {command:'COMMIT'};
  assert.ok(q.text==='BEGIN READ ONLY'||q.text.startsWith('SET LOCAL'));return {rows:[]};
 }}}};}
 const options={enabled:true,installation:f.installation,trustRecordBytes:f.trustRecordBytes,expectedTrust:f.expectedTrust,
  connections:{control:{host:`db.${scope.controlProjectRef}.supabase.co`,password:'synthetic-control-only-'.repeat(2),ca:rootCertificates[0]},journal:{host:`db.${scope.journalProjectRef}.supabase.co`,password:'synthetic-journal-only-'.repeat(2),ca:rootCertificates[0]}},
  readEnvironment:()=>{state.environmentReads++;return state.environment;},openControlPool:pool,openJournalPool:pool,
  openDynamoClient:config=>({destroy(){},async send(command){
   state.credentials.push({...config.credentials});const name=command.constructor.name,q=command.input,n=f.installation.nonce;state.dynamo.push(name);
   if(name==='DescribeTableCommand')return {$metadata:metadata(),Table:{TableArn:`arn:aws:dynamodb:${resource.region}:${resource.accountId}:table/${n.tableName}`,TableId:n.tableId,TableName:n.tableName,TableStatus:'ACTIVE',DeletionProtectionEnabled:true,BillingModeSummary:{BillingMode:'PAY_PER_REQUEST'},KeySchema:[{AttributeName:'nonceKey',KeyType:'HASH'}],AttributeDefinitions:[{AttributeName:'nonceKey',AttributeType:'S'}]}};
   if(name==='DescribeTimeToLiveCommand')return {$metadata:metadata(),TimeToLiveDescription:{TimeToLiveStatus:'ENABLED',AttributeName:'expiresAt'}};
   if(name==='PutItemCommand'){if(state.nonces.has(q.Item.nonceKey.S))throw Object.assign(Error('synthetic duplicate'),{name:'ConditionalCheckFailedException',$metadata:{...metadata(),httpStatusCode:400}});state.nonces.set(q.Item.nonceKey.S,q.Item);return {$metadata:metadata()};}
   if(name==='GetItemCommand')return {$metadata:metadata(),Item:state.nonces.get(q.Key.nonceKey.S)};
   throw Error('unexpected synthetic Dynamo command');
  }}),openKmsClient:config=>({destroy(){},async send(command){
   state.credentials.push({...config.credentials});const name=command.constructor.name,q=command.input;state.kms.push({name,keyArn:q.KeyId});
   const purpose=q.KeyId===f.installation.signing.control.keyArn?'control':'journal',pair=f[purpose];
   if(name==='GetPublicKeyCommand')return {$metadata:metadata(),KeyId:q.KeyId,KeyUsage:'SIGN_VERIFY',KeySpec:'ECC_NIST_EDWARDS25519',PublicKey:pair.publicKey.export({format:'der',type:'spki'}),SigningAlgorithms:['ED25519_SHA_512','ED25519_PH_SHA_512']};
   assert.equal(name,'SignCommand');assert.equal(q.MessageType,'RAW');return {$metadata:metadata(),KeyId:q.KeyId,SigningAlgorithm:'ED25519_SHA_512',Signature:sign(null,q.Message,pair.privateKey)};
  }})};
 modifyOptions?.(options,state);
 const runtime=await createAwsMemberAuthorityRuntime(options),clients=[];
 const client=()=>{const c=createMemberAuthorityTransport({enabled:true,...f.installation.binding,signingKey:async()=>f.caller.privateKey,transport:async(o,b)=>{
  state.saved=proxy(o,b);const r=await runtime.handler(state.saved,state.context);return {statusCode:r.statusCode,headers:{'content-type':r.headers['content-type']},body:Buffer.from(r.body)};
 }});clients.push(c);return c;};
 return {f,state,runtime,client,options,async close(){for(const c of clients)c.close();await runtime.close();}};
}
test('disabled member AWS composition touches no pool, environment or SDK capability',async()=>{
 let io=0;const bad=new Proxy({},{get(){io++;throw Error('must not inspect');}});
 const r=await createAwsMemberAuthorityRuntime({connections:bad,installation:bad,expectedTrust:bad,readEnvironment:()=>io++});
 assert.equal((await r.handler({},{})).statusCode,503);await r.close();assert.equal(io,0);
 await assert.rejects(createAwsMemberAuthorityRuntime({enabled:'true'}),{message:'alliance_member_aws_unavailable'});
});
test('public installation review uses separately supplied canonical trust pins and returns no secret configuration',()=>{
 const f=configuration(),review=reviewAwsMemberInstallation(f);assert.equal(review.trustSha256,sha(f.trustRecordBytes));assert.equal(review.recordGeneration,1);
 const binding=reviewMemberAuthorityBinding(f.installation.binding);binding.gateway.stage='changed';assert.equal(f.installation.binding.gateway.stage,'preview');
 assert.deepEqual(Object.keys(review),['format','installationSha256','trustSha256','minimumGeneration','recordGeneration']);
});
for(const [name,patch] of Object.entries({
 'stale generation':f=>f.expectedTrust.minimumGeneration=2,
 'wrong external digest':f=>f.expectedTrust.sha256='f'.repeat(64),
 'extra manifest pin':f=>f.installation.expectedTrust=f.expectedTrust,
 'old account function':f=>f.installation.binding.resource.functionName='alliance-account-authority-synthetic',
 'unversioned function':f=>f.installation.binding.resource.version='$LATEST',
 'other member scope':f=>f.installation.binding.scope.epoch='55555555-5555-4555-8555-555555555555',
 'old account nonce table':f=>f.installation.nonce.tableName='alliance-account-nonce-synthetic',
 'nonce from other epoch':f=>f.installation.nonce.epoch='55555555-5555-4555-8555-555555555555',
 'nonce from other account':f=>f.installation.nonce.accountId='999999999999',
 'KMS alias':f=>f.installation.signing.control.keyArn='alias/live',
 'same KMS key twice':f=>f.installation.signing.journal={...f.installation.signing.control},
 'cross-region signer':f=>f.installation.signing.journal.region='us-west-2',
 'swapped purpose keys':f=>{[f.installation.binding.controlVerificationKey,f.installation.binding.journalVerificationKey]=[f.installation.binding.journalVerificationKey,f.installation.binding.controlVerificationKey];}
}))test(`installation ${name} refuses before connection-secret or provider access`,async()=>{
 const f=configuration();patch(f);let touched=0;
 const connections=new Proxy({},{ownKeys(){touched++;throw Error('private connections inspected');}});
 assert.throws(()=>reviewAwsMemberInstallation(f),{message:'alliance_member_aws_unavailable'});
 await assert.rejects(createAwsMemberAuthorityRuntime({...f,enabled:true,connections}),{message:'alliance_member_aws_unavailable'});assert.equal(touched,0);
});
test('member signed startup/witness composes three actual read adapters with branded nonce and KMS factories',async()=>{
 const f=await fixture();try{
  assert.equal(JSON.parse(await f.client().readDecision(startup())).decision.state,'review');
  assert.equal(JSON.parse(await f.client().readWitness(witness())).anchor.sequence,0);
  assert.deepEqual(f.state.pools.map(x=>x.user),['alliance_control_reader','alliance_control_reader','alliance_journal_reader']);
  assert.equal(f.state.nonces.size,2);assert.equal(f.state.kms.filter(x=>x.name==='SignCommand').length,2);
  assert.ok(f.state.sql.every(x=>!/\b(GRANT|REVOKE|INSERT|UPDATE|DELETE|CREATE|ALTER)\b/.test(x.split(' as limited')[0])||x.startsWith('select current_database')));
  for(const c of f.state.pools){assert.equal(c.ssl.rejectUnauthorized,true);assert.equal(c.ssl.servername,c.host);assert.equal(c.enableChannelBinding,true);}
 }finally{await f.close();}assert.equal(f.state.ended,3);
});
test('wrong second-argument Lambda context cannot be replaced by request context and reads no credentials',async()=>{
 const f=await fixture();try{f.state.context.functionVersion='8';await assert.rejects(f.client().readDecision(startup()));assert.equal(f.state.environmentReads,0);assert.equal(f.state.sql.length,0);assert.equal(f.state.dynamo.length,0);}finally{await f.close();}
});
test('malformed execution credentials stop before provider sends or database reads',async()=>{
 const f=await fixture();try{delete f.state.environment.AWS_SESSION_TOKEN;await assert.rejects(f.client().readDecision(startup()));assert.equal(f.state.sql.length,0);assert.equal(f.state.dynamo.length,0);assert.equal(f.state.kms.length,0);}finally{await f.close();}
});
test('warm calls take fresh execution-role credentials without retaining a prior invocation',async()=>{
 const f=await fixture();try{await f.client().readDecision(startup());const before=f.state.credentials.length;f.state.environment=environment('B');await f.client().readWitness(witness());assert.ok(f.state.credentials.slice(before).every(x=>x.accessKeyId==='ASIA'+'B'.repeat(16)));}finally{await f.close();}
});
test('consumed signed nonce cannot produce a second signature or issuer read',async()=>{
 const f=await fixture();try{await f.client().readDecision(startup());const sql=f.state.sql.length,kms=f.state.kms.length;assert.equal((await f.runtime.handler(structuredClone(f.state.saved),context())).statusCode,503);assert.equal(f.state.sql.length,sql);assert.equal(f.state.kms.length,kms);}finally{await f.close();}
});
test('database failures return only unavailable, with no provider diagnostics or secret cause',async()=>{
 const f=await fixture({beforeQuery:async()=>{throw Error('synthetic private DSN must not escape');}});try{await assert.rejects(f.client().readDecision(startup()),{message:'alliance_member_authority_unavailable'});const result=await f.runtime.handler({},context());assert.equal(result.body,'{"state":"unavailable"}');assert.equal(f.state.kms.length,0);}finally{await f.close();}
});
test('partial construction closes earlier pools and refuses without exposing connection details',async()=>{
 const f=configuration();let ended=0;
 await assert.rejects(createAwsMemberAuthorityRuntime({...f,enabled:true,connections:{control:{host:`db.${scope.controlProjectRef}.supabase.co`,password:'synthetic-only-control-value',ca:rootCertificates[0]},journal:{host:`db.${scope.journalProjectRef}.supabase.co`,password:'synthetic-only-journal-value',ca:'invalid synthetic CA'}},openControlPool:()=>({on(){},async connect(){throw Error('unexpected connect');},async end(){ended++;}})}),{message:'alliance_member_aws_unavailable'});assert.equal(ended,2);
});
test('closing prevents further invocation work and pool shutdown is idempotent',async()=>{
 const f=await fixture();await f.close();await f.runtime.close();assert.equal(f.state.ended,3);assert.equal((await f.runtime.handler({},context())).statusCode,503);assert.equal(f.state.environmentReads,0);
});
test('paused Journal writes preserve readable history proof without granting serving permission',async()=>{
 const f=await fixture();try{f.state.journalEnabled=false;const result=JSON.parse(await f.client().readWitness(witness()));assert.equal(result.anchor.sequence,0);assert.deepEqual(Object.keys(result),['anchor','signature']);assert.equal(f.state.kms.filter(x=>x.name==='SignCommand').length,1);}finally{await f.close();}
});
test('busy invocation is refused without dispatch while the admitted invocation completes',async()=>{
 let enter,release,paused=false;const ready=new Promise(r=>enter=r);
 const f=await fixture({beforeQuery:async q=>{if(!paused&&q.text==='BEGIN READ ONLY'){paused=true;enter();await new Promise(r=>release=r);}}});
 try{const pending=f.client().readDecision(startup());await ready;const before=f.state.environmentReads;assert.equal((await f.runtime.handler(structuredClone(f.state.saved),context())).statusCode,503);assert.equal(f.state.environmentReads,before);release();assert.equal(JSON.parse(await pending).decision.state,'review');}finally{release?.();await f.close();}
});
test('close during an admitted database read withholds late signing and clears owned pools',async()=>{
 let enter,release;const ready=new Promise(r=>enter=r);
 const f=await fixture({beforeQuery:async q=>{if(q.text==='BEGIN READ ONLY'){enter();await new Promise(r=>release=r);}}});
 try{const pending=f.client().readDecision(startup());await ready;await f.runtime.close();await assert.rejects(pending);release();await new Promise(r=>setImmediate(r));assert.equal(f.state.kms.length,0);assert.equal(f.state.ended,3);}finally{release?.();await f.close();}
});
