import test from 'node:test';
import assert from 'node:assert/strict';
import {rootCertificates} from 'node:tls';
import {spawnSync} from 'node:child_process';
import {createMemberConnectionSecrets,reviewMemberConnectionSecrets} from './member-connection-secrets.mjs';
import {createLambdaInvocationRuntime} from './lambda-invocation-runtime.mjs';
import {createLambdaExecutionRoleProvider} from './aws-runtime-credentials.mjs';
const scope={memberProjectRef:'abcdefghijklmnopqrst',journalProjectRef:'uvwxyzabcdefghijklmn',controlProjectRef:'opqrstuvwxyzabcdefgh',epoch:'11111111-1111-4111-8111-111111111111'};
const resource={accountId:'123456789012',region:'us-east-2',functionName:'alliance-member-authority-synthetic',version:'7'};
const context=()=>({functionName:resource.functionName,functionVersion:resource.version,invokedFunctionArn:`arn:aws:lambda:${resource.region}:${resource.accountId}:function:${resource.functionName}:${resource.version}`,getRemainingTimeInMillis:()=>10000});
const env=letter=>({AWS_REGION:resource.region,AWS_EXECUTION_ENV:'AWS_Lambda_nodejs24.x',AWS_LAMBDA_FUNCTION_NAME:resource.functionName,AWS_LAMBDA_FUNCTION_VERSION:resource.version,AWS_LAMBDA_INITIALIZATION_TYPE:'on-demand',AWS_ACCESS_KEY_ID:'ASIA'+letter.repeat(16),AWS_SECRET_ACCESS_KEY:letter.repeat(40),AWS_SESSION_TOKEN:'synthetic-memory-only-role-session-'+letter});
const bindings=()=>Object.fromEntries(['control','journal'].map((p,i)=>[p,{secretArn:`arn:aws:secretsmanager:${resource.region}:${resource.accountId}:secret:alliance-member-${p}-reader-synthetic-Ab12Cd`,versionId:String(i+1).repeat(32),ca:rootCertificates[0]}]));
const payload=purpose=>({format:1,...scope,purpose,databaseRole:'alliance_'+purpose+'_reader',password:'synthetic-only-'+purpose+'-'.repeat(24)});
const metadata=()=>({httpStatusCode:200,attempts:1,totalRetryDelay:0});
const refuses=p=>assert.rejects(p,e=>e.message==='alliance_member_connections_unavailable'&&!e.cause);
function fixture({patchReply,send,options={}}={}){
 const state={environment:env('A'),commands:[],clients:[],destroyed:0,destroyedClients:new Set()},b=bindings();
 const adapter=createLambdaInvocationRuntime({enabled:true,resource,readEnvironment:()=>state.environment});
 const credentials=createLambdaExecutionRoleProvider({enabled:true,kind:'member-authority',resource,readRuntime:adapter.readRuntime});
 const openClient=config=>{const id=state.clients.length;state.clients.push(config);return {destroy(){state.destroyed++;state.destroyedClients.add(id);},async send(command,request){
  state.commands.push(command);if(send)return send(command,request);
  const purpose=command.input.SecretId===b.control.secretArn?'control':'journal';
  const reply={ARN:b[purpose].secretArn,VersionId:b[purpose].versionId,VersionStages:['AWSCURRENT'],SecretString:JSON.stringify(payload(purpose)),$metadata:metadata()};
  return patchReply?.(reply,purpose)??reply;
 }};};
 let source;try{source=createMemberConnectionSecrets({enabled:true,resource,scope,bindings:b,credentials,credentialSource:resource,openClient,...options});}catch(e){credentials.close();adapter.close();throw e;}
 const run=async work=>{const result=await adapter.run(context(),async()=>{try{return {value:await work()};}catch(error){return {error};}});if(result.error)throw result.error;return result.value;};
 return {source,state,b,run,close(){source.close();credentials.close();adapter.close();}};
}
test('default-off connection source touches no binding, environment, credential or SDK',async()=>{
 let touched=0;const bad=new Proxy({},{get(){touched++;throw Error('must not inspect');},ownKeys(){touched++;throw Error('must not inspect');}});
 const source=createMemberConnectionSecrets({resource:bad,scope:bad,bindings:bad,credentials:()=>touched++,openClient:()=>touched++});
 await refuses(source.read());source.close();assert.equal(touched,0);
 for(const enabled of ['true',null,1])assert.throws(()=>createMemberConnectionSecrets({enabled}));
});
test('isolated import/default-off does not read real runtime credentials or connect',()=>{
 const code=`import {strict as assert} from 'node:assert';const original=process.env;let reads=0;const blocked=new Set(['AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','AWS_SESSION_TOKEN','AWS_PROFILE','AWS_REGION']);process.env=new Proxy({}, {get(_,k){if(blocked.has(k)){reads++;throw Error('forbidden');}return undefined;}});try{const m=await import(${JSON.stringify(new URL('./member-connection-secrets.mjs',import.meta.url).href)});const s=m.createMemberConnectionSecrets();await assert.rejects(s.read());s.close();assert.equal(reads,0);}finally{process.env=original;}`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',code],{env:{TZ:'UTC'},encoding:'utf8',timeout:15000});assert.equal(child.status,0,child.stderr);assert.equal(child.stdout,'');
});
for(const [name,change] of Object.entries({
 'crossed purpose':b=>b.control.secretArn=b.journal.secretArn,
 'foreign account':b=>b.control.secretArn=b.control.secretArn.replace('123456789012','999999999999'),
 'foreign region':b=>b.journal.secretArn=b.journal.secretArn.replace('us-east-2','us-west-2'),
 'partial ARN':b=>b.control.secretArn='alliance-member-control-reader-synthetic',
 'old account namespace':b=>b.control.secretArn=b.control.secretArn.replace('alliance-member','alliance-account'),
 'unpinned version':b=>delete b.control.versionId,
 'label as version':b=>b.control.versionId='AWSCURRENT',
 'invalid CA':b=>b.journal.ca='not a certificate',
 'CA mixed with settings':b=>b.control.ca+='sslmode=disable',
 'extra private field':b=>b.control.password='synthetic unwanted value',
}))test(`public ${name} refuses before credential or SDK access`,()=>{
 const b=bindings();change(b);let called=0;
 assert.throws(()=>reviewMemberConnectionSecrets({resource,scope,bindings:b}),{message:'alliance_member_connections_unavailable'});
 assert.throws(()=>createMemberConnectionSecrets({enabled:true,resource,scope,bindings:b,credentials:()=>called++,openClient:()=>called++}),{message:'alliance_member_connections_unavailable'});assert.equal(called,0);
});
test('plain credential functions cannot replace the branded member execution role',()=>{
 assert.throws(()=>createMemberConnectionSecrets({enabled:true,resource,scope,bindings:bindings(),credentials:async()=>({}),credentialSource:resource}),{message:'alliance_member_connections_unavailable'});
});
test('only two pinned current versions are fetched with fresh bounded TLS clients; host and role are not taken from private data',async()=>{
 const f=fixture();try{
  const value=await f.run(()=>f.source.read());
  assert.deepEqual(Object.keys(value),['control','journal']);
  for(const purpose of ['control','journal'])assert.deepEqual(value[purpose],{host:`db.${scope[purpose+'ProjectRef']}.supabase.co`,password:payload(purpose).password,ca:rootCertificates[0]});
  assert.deepEqual(f.state.commands.map(c=>c.input),['control','journal'].map(p=>({SecretId:f.b[p].secretArn,VersionId:f.b[p].versionId,VersionStage:'AWSCURRENT'})));
  for(const c of f.state.clients){assert.equal(c.region,resource.region);assert.equal(c.endpoint,'https://secretsmanager.us-east-2.amazonaws.com');assert.equal(c.maxAttempts,1);assert.equal(c.requestHandler.httpsAgent.options.rejectUnauthorized,true);assert.equal(c.credentials.accessKeyId,'ASIA'+'A'.repeat(16));}
  assert.equal(f.state.destroyed,2);f.state.environment=env('B');await f.run(()=>f.source.read());
  assert.equal(f.state.commands.length,4);assert.ok(f.state.clients.slice(2).every(c=>c.credentials.accessKeyId==='ASIA'+'B'.repeat(16)));assert.equal(f.state.destroyed,4);
 }finally{f.close();}
});
for(const [name,patch] of Object.entries({
 'wrong returned ARN':v=>v.ARN+='x',
 'wrong returned version':v=>v.VersionId='f'.repeat(32),
 'previous stage only':v=>v.VersionStages=['AWSPREVIOUS'],
 'binary response':v=>v.SecretBinary=Buffer.from('synthetic'),
 'retried reply':v=>v.$metadata.attempts=2,
 'noncanonical JSON':v=>v.SecretString+=' ',
 'duplicate JSON key':v=>v.SecretString=v.SecretString.replace('{','{"format":0,'),
 'crossed scope':v=>{const p=JSON.parse(v.SecretString);p.epoch='99999999-9999-4999-8999-999999999999';v.SecretString=JSON.stringify(p);},
 'administrator role':v=>{const p=JSON.parse(v.SecretString);p.databaseRole='postgres';v.SecretString=JSON.stringify(p);},
 'crossed private purpose':v=>{const p=JSON.parse(v.SecretString);p.purpose='other';v.SecretString=JSON.stringify(p);},
 'private endpoint override':v=>{const p=JSON.parse(v.SecretString);p.host='elsewhere.invalid';v.SecretString=JSON.stringify(p);},
 'empty password':v=>{const p=JSON.parse(v.SecretString);p.password='';v.SecretString=JSON.stringify(p);},
 'control character':v=>{const p=JSON.parse(v.SecretString);p.password+='\n';v.SecretString=JSON.stringify(p);},
}))test(`private ${name} is refused without partial credentials or diagnostics`,async()=>{
 const f=fixture({patchReply:(reply,p)=>{if(p==='journal')patch(reply);return reply;}});try{await refuses(f.run(()=>f.source.read()));assert.equal(f.state.commands.length,2);assert.equal(f.state.destroyed,2);}finally{f.close();}
});
test('provider errors are sanitized and neither retried nor cached',async()=>{
 const f=fixture({send:()=>{throw Error('synthetic private connection must never escape');}});try{await refuses(f.run(()=>f.source.read()));assert.equal(f.state.commands.length,2);assert.equal(f.state.destroyed,2);}finally{f.close();}
});
test('outside a real second-argument invocation, no SDK request is sent',async()=>{
 const f=fixture();try{await refuses(f.source.read());assert.equal(f.state.commands.length,0);}finally{f.close();}
});
test('deadline aborts both parallel reads and destroys their clients',async()=>{
 const f=fixture({options:{timeoutMs:20},send:()=>new Promise(()=>{})});try{await refuses(f.run(()=>f.source.read()));assert.equal(f.state.commands.length,2);assert.equal(f.state.destroyed,2);}finally{f.close();}
});
test('close cancels pending reads, withholds late private values, and refuses future reads',async()=>{
 let ready;const started=new Promise(r=>ready=r);const f=fixture({send:()=>{ready();return new Promise(()=>{});}});
 const pending=f.run(()=>f.source.read());await started;f.source.close();await refuses(pending);await refuses(f.source.read());assert.equal(f.state.clients.length,2);assert.equal(f.state.destroyedClients.size,2);f.close();
});
