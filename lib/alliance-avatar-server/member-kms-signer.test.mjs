import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,verify} from 'node:crypto';
import {GetPublicKeyCommand,SignCommand} from '@aws-sdk/client-kms';
import {createMemberKmsSigner} from './member-kms-signer.mjs';
import {createLambdaInvocationRuntime} from './lambda-invocation-runtime.mjs';
import {createLambdaExecutionRoleProvider} from './aws-runtime-credentials.mjs';
import {startupDecisionBytes} from './startup-gate.mjs';
import {deletionWitnessBytes} from './deletion-journal.mjs';
import {createAnchoredControlAuthority} from './control-authority.mjs';
import {createAnchoredJournalWitness} from './anchored-witness.mjs';
import {controlPolicySha256} from './control-policy.mjs';
import {spawnSync} from 'node:child_process';
const zero={sequence:0,sha256:'0'.repeat(64)},scope={memberProjectRef:'abcdefghijklmnopqrst',journalProjectRef:'uvwxyzabcdefghijklmn',epoch:'11111111-1111-4111-8111-111111111111'};
const source={accountId:'123456789012',region:'us-east-2',functionName:'alliance-member-authority-synthetic',version:'7'};
const resource={accountId:source.accountId,region:source.region,keyArn:`arn:aws:kms:${source.region}:${source.accountId}:key/11111111-1111-4111-8111-111111111111`};
const context=()=>({functionName:source.functionName,functionVersion:source.version,invokedFunctionArn:`arn:aws:lambda:${source.region}:${source.accountId}:function:${source.functionName}:${source.version}`,getRemainingTimeInMillis:()=>10000});
const environment=()=>({AWS_REGION:source.region,AWS_EXECUTION_ENV:'AWS_Lambda_nodejs24.x',AWS_LAMBDA_FUNCTION_NAME:source.functionName,AWS_LAMBDA_FUNCTION_VERSION:source.version,AWS_LAMBDA_INITIALIZATION_TYPE:'on-demand',AWS_ACCESS_KEY_ID:'ASIA'+'K'.repeat(16),AWS_SECRET_ACCESS_KEY:'K'.repeat(40),AWS_SESSION_TOKEN:'synthetic-only-member-authority-session'});
const startup=()=>({format:1,...scope,bootId:'a'.repeat(64),challenge:'b'.repeat(64),revision:1,state:'review',freezeId:'22222222-2222-4222-8222-222222222222',frozenAt:new Date(Date.now()-1000).toISOString(),checkpointSha256:'c'.repeat(64),floor:zero,issuedAt:new Date().toISOString()});
const witness=()=>({format:1,projectRef:scope.memberProjectRef,epoch:scope.epoch,...zero,challenge:'b'.repeat(64),issuedAt:new Date().toISOString()});
const metadata=()=>({httpStatusCode:200,attempts:1,totalRetryDelay:0});
const refuses=p=>assert.rejects(p,e=>e.message==='alliance_member_signer_unavailable'&&!e.cause);
const tick=()=>new Promise(r=>setImmediate(r));
function fixture({purpose='control',publicChange,signChange,send,readEnvironment=environment,options={}}={}){
 const pair=generateKeyPairSync('ed25519'),hex=Buffer.from(pair.publicKey.export({format:'jwk'}).x,'base64url').toString('hex'),spki=pair.publicKey.export({format:'der',type:'spki'});
 const runtime=createLambdaInvocationRuntime({enabled:true,resource:source,readEnvironment});
 const credentials=createLambdaExecutionRoleProvider({enabled:true,kind:'member-authority',resource:source,readRuntime:runtime.readRuntime});
 const state={commands:[],configs:[],destroys:0};
 const openClient=config=>{state.configs.push(config);return {destroy(){state.destroys++;},async send(command,request){
  state.commands.push(command);if(send)return send(command,request);
  if(command instanceof GetPublicKeyCommand){const result={KeyId:resource.keyArn,KeySpec:'ECC_NIST_EDWARDS25519',KeyUsage:'SIGN_VERIFY',PublicKey:Buffer.from(spki),SigningAlgorithms:['ED25519_SHA_512','ED25519_PH_SHA_512'],$metadata:metadata()};return publicChange?publicChange(result):result;}
  assert.ok(command instanceof SignCommand);const result={KeyId:resource.keyArn,SigningAlgorithm:'ED25519_SHA_512',Signature:sign(null,command.input.Message,pair.privateKey),$metadata:metadata()};return signChange?signChange(result):result;
 }};};
 let signer;try{signer=createMemberKmsSigner({enabled:true,purpose,scope,resource,verificationKey:hex,credentials,credentialSource:source,openClient,...options});}catch(e){credentials.close();runtime.close();throw e;}
 // Preserve the inner signer's sanitized error for unit assertions; the outer
 // production invocation adapter deliberately replaces rejected operations.
 const run=async fn=>{const result=await runtime.run(context(),async()=>{try{return {value:await fn()};}catch(error){return {error};}});if(result.error)throw result.error;return result.value;};
 return {signer,pair,hex,state,run,close(){signer.close();credentials.close();runtime.close();}};
}
test('KMS signer defaults off without credential, SDK or environment lookup',async()=>{
 let calls=0;const signer=createMemberKmsSigner({openClient:()=>calls++,credentials:()=>calls++});
 await refuses(signer.signBytes(startupDecisionBytes(startup())));signer.close();assert.equal(calls,0);
 for(const enabled of ['true',1,null])assert.throws(()=>createMemberKmsSigner({enabled}));
});
test('module import and default-off calls read no actual credential/runtime environment fields in an isolated child',()=>{
 const code=`import {strict as assert} from 'node:assert';const original=process.env;let reads=0;const blocked=new Set(['AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','AWS_SESSION_TOKEN','AWS_REGION','AWS_EXECUTION_ENV','AWS_LAMBDA_FUNCTION_NAME','AWS_LAMBDA_FUNCTION_VERSION','AWS_LAMBDA_INITIALIZATION_TYPE','AWS_PROFILE']);process.env=new Proxy({}, {get(_,k){if(blocked.has(k)){reads++;throw Error('forbidden runtime lookup');}return undefined;}});try{const m=await import(${JSON.stringify(new URL('./member-kms-signer.mjs',import.meta.url).href)});const s=m.createMemberKmsSigner();await assert.rejects(s.signBytes(Buffer.from('invalid')));s.close();assert.equal(reads,0);}finally{process.env=original;}`;
 const r=spawnSync(process.execPath,['--input-type=module','-e',code],{env:{TZ:'UTC'},encoding:'utf8',timeout:15000});assert.equal(r.status,0,r.stderr);assert.equal(r.stdout,'');
});
for(const purpose of ['control','journal'])test(`${purpose} signs canonical RAW Ed25519 bytes with exact key/TLS/role and fresh clients`,async()=>{
 const f=fixture({purpose});try{
  const bytes=purpose==='control'?startupDecisionBytes(startup()):deletionWitnessBytes(witness());
  const signature=await f.run(()=>f.signer.signBytes(bytes));assert.ok(verify(null,bytes,f.pair.publicKey,signature));
  assert.equal(f.state.commands.length,2);assert.deepEqual(f.state.commands[0].input,{KeyId:resource.keyArn});
  assert.deepEqual(f.state.commands[1].input,{KeyId:resource.keyArn,Message:bytes,MessageType:'RAW',SigningAlgorithm:'ED25519_SHA_512'});
  assert.equal(f.state.configs.length,2);assert.equal(f.state.destroys,2);
  for(const config of f.state.configs){assert.equal(config.endpoint,'https://kms.us-east-2.amazonaws.com');assert.equal(config.maxAttempts,1);assert.equal(config.requestHandler.httpsAgent.options.minVersion,'TLSv1.2');assert.equal(config.requestHandler.httpsAgent.options.rejectUnauthorized,true);assert.equal(config.requestHandler.httpsAgent.options.maxSockets,1);assert.equal(config.credentials.accessKeyId,environment().AWS_ACCESS_KEY_ID);}
 }finally{f.close();}
});
test('bare credentials, account-checkpoint credentials, aliases and cross-region keys cannot configure the member signer',()=>{
 for(const options of [{credentials:async()=>environment()},{resource:{...resource,keyArn:'alias/live'}},{resource:{...resource,keyArn:resource.keyArn.replace('us-east-2','us-west-2')}},{resource:{...resource,accountId:'999999999999'}},{credentialSource:{...source,version:'$LATEST'}},{scope:{...scope,journalProjectRef:scope.memberProjectRef}},{verificationKey:'0'.repeat(64)},{purpose:'arbitrary'},{timeoutMs:1201}])assert.throws(()=>fixture({options}));
 const r={...source,functionName:'alliance-account-authority-synthetic'},credentials=createLambdaExecutionRoleProvider({enabled:true,kind:'authority',resource:r,readRuntime:()=>({})});
 try{assert.throws(()=>fixture({options:{credentials,credentialSource:r}}));}finally{credentials.close();}
});
test('no active trusted invocation or a wrong actual version refuses before SDK construction',async()=>{
 const f=fixture();try{await refuses(f.signer.signBytes(startupDecisionBytes(startup())));assert.equal(f.state.configs.length,0);}finally{f.close();}
 let secrets=0;const g=fixture({readEnvironment:()=>new Proxy({...environment(),AWS_LAMBDA_FUNCTION_VERSION:'8'},{get(t,k){if(['AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','AWS_SESSION_TOKEN'].includes(k))secrets++;return t[k];}})});
 try{await refuses(g.run(()=>g.signer.signBytes(startupDecisionBytes(startup()))));assert.equal(g.state.configs.length,0);assert.equal(secrets,0);}finally{g.close();}
});
test('purpose, scope, time, canonical encoding and byte bounds refuse before credential or SDK work',async()=>{
 const f=fixture();try{
  const good=startup(),prefix='GF-ALLIANCE-STARTUP-DECISION-V1\0';
  for(const bytes of [deletionWitnessBytes(witness()),startupDecisionBytes({...good,epoch:'22222222-2222-4222-8222-222222222222'}),startupDecisionBytes({...good,memberProjectRef:scope.journalProjectRef,journalProjectRef:scope.memberProjectRef}),startupDecisionBytes({...good,issuedAt:new Date(Date.now()-30001).toISOString()}),startupDecisionBytes({...good,issuedAt:new Date(Date.now()+5000).toISOString()}),Buffer.from(prefix+JSON.stringify({...good,private:'PRIVATE'})),Buffer.from(prefix+JSON.stringify(good,null,2)),Buffer.alloc(2049),Buffer.from([255])])await refuses(f.run(()=>f.signer.signBytes(bytes)));
  assert.equal(f.state.configs.length,0);assert.equal(f.state.commands.length,0);
  await f.run(()=>f.signer.signBytes(startupDecisionBytes(startup())));assert.equal(f.state.commands.length,2);
 }finally{f.close();}
});
for(const [name,change] of Object.entries({
 key:r=>({...r,KeyId:r.KeyId.replace('11111111-1111','22222222-2222')}),
 spec:r=>({...r,KeySpec:'ECC_NIST_P256'}),usage:r=>({...r,KeyUsage:'ENCRYPT_DECRYPT'}),
 publicKey:r=>({...r,PublicKey:generateKeyPairSync('ed25519').publicKey.export({format:'der',type:'spki'})}),
 missingRaw:r=>({...r,SigningAlgorithms:['ED25519_PH_SHA_512']}),
 retried:r=>({...r,$metadata:{...metadata(),attempts:2}}),
 unknownMetadata:r=>({...r,$metadata:undefined})
}))test(`wrong KMS public ${name} closes before Sign and cannot retry`,async()=>{
 const f=fixture({publicChange:change});try{await refuses(f.run(()=>f.signer.signBytes(startupDecisionBytes(startup()))));assert.equal(f.state.commands.length,1);await refuses(f.run(()=>f.signer.signBytes(startupDecisionBytes(startup()))));assert.equal(f.state.commands.length,1);}finally{f.close();}
});
for(const [name,change] of Object.entries({
 key:r=>({...r,KeyId:'alias/live'}),algorithm:r=>({...r,SigningAlgorithm:'ED25519_PH_SHA_512'}),
 malformed:r=>({...r,Signature:Buffer.alloc(63)}),wrongSignature:r=>({...r,Signature:Buffer.alloc(64)}),
 retry:r=>({...r,$metadata:{...metadata(),totalRetryDelay:1}})
}))test(`KMS Sign ${name} cannot return a signature or renew the signer`,async()=>{
 const f=fixture({signChange:change});try{await refuses(f.run(()=>f.signer.signBytes(startupDecisionBytes(startup()))));assert.equal(f.state.commands.length,2);await refuses(f.run(()=>f.signer.signBytes(startupDecisionBytes(startup()))));assert.equal(f.state.commands.length,2);}finally{f.close();}
});
test('late public-key response cannot dispatch Sign and quarantines the signer',async()=>{
 let release;const gate=new Promise(r=>release=r),f=fixture({options:{timeoutMs:20},send:async()=>{await gate;throw Error('PRIVATE-provider-details');}});
 try{await refuses(f.run(()=>f.signer.signBytes(startupDecisionBytes(startup()))));release();await tick();assert.equal(f.state.commands.length,1);await refuses(f.run(()=>f.signer.signBytes(startupDecisionBytes(startup()))));assert.equal(f.state.commands.length,1);}finally{release();f.close();}
});
test('concurrency, cancellation and closure do not queue or dispatch more managed work',async()=>{
 let enter,release;const ready=new Promise(r=>enter=r),gate=new Promise(r=>release=r),f=fixture({send:async()=>{enter();await gate;throw Error('PRIVATE');}});
 try{
  const aborter=new AbortController(),pending=f.run(async()=>{const first=f.signer.signBytes(startupDecisionBytes(startup()),{signal:aborter.signal});await ready;await refuses(f.signer.signBytes(startupDecisionBytes(startup())));aborter.abort();await refuses(first);});
  await pending;release();await tick();assert.equal(f.state.commands.length,1);f.signer.close();await refuses(f.run(()=>f.signer.signBytes(startupDecisionBytes(startup()))));
 }finally{release();f.close();}
});
test('actual anchored control and journal issuers verify signatures through managed SDK adapter fixtures',async()=>{
 const control=fixture(),journal=fixture({purpose:'journal'});
 const raw={format:1,...scope,revision:1,state:'review',changeId:'22222222-2222-4222-8222-222222222222',freezeId:'33333333-3333-4333-8333-333333333333',frozenAt:new Date().toISOString(),checkpointSha256:'c'.repeat(64),floor:zero};
 const policy={...raw,sha256:controlPolicySha256(raw)},anchor={format:1,...scope,...zero};
 const authority=createAnchoredControlAuthority({enabled:true,...scope,verificationKey:control.hex,minimum:{revision:1,sha256:policy.sha256,floor:zero},store:{read:async()=>policy},anchorStore:{read:async()=>anchor},signBytes:control.signer.signBytes});
 const witnessIssuer=createAnchoredJournalWitness({enabled:true,projectRef:scope.memberProjectRef,journalProjectRef:scope.journalProjectRef,epoch:scope.epoch,minimum:zero,verificationKey:journal.hex,anchorStore:{read:async()=>anchor},store:{tip:async()=>({projectRef:scope.memberProjectRef,epoch:scope.epoch,...zero,enabled:false}),records:async()=>[]},signBytes:journal.signer.signBytes});
 try{
  const request={format:1,...scope,bootId:'a'.repeat(64),challenge:'b'.repeat(64)};
  assert.equal((await control.run(()=>authority.issue(request))).state,'signed');
  assert.equal((await journal.run(()=>witnessIssuer.issue({challenge:'b'.repeat(64)}))).state,'signed');
  assert.equal(control.state.commands.length,2);assert.equal(journal.state.commands.length,2);
 }finally{authority.close();witnessIssuer.close();control.close();journal.close();}
});
