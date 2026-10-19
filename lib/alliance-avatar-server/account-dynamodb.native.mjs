// Confirmed fixture only: real local data API, NO AWS IAM/provider acceptance.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,realpathSync} from 'node:fs';
import {dirname} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {createHash,randomUUID} from 'node:crypto';
import {DynamoDBClient,CreateTableCommand,DescribeTableCommand,DeleteTableCommand,UpdateTableCommand,UpdateTimeToLiveCommand,GetItemCommand,PutItemCommand,DeleteItemCommand} from '@aws-sdk/client-dynamodb';
import {createDynamoAccountCheckpointStore} from './account-dynamodb-store.mjs';
import {runGatewayNonceFixture} from './account-gateway-nonce.native.mjs';
import {createAccountCheckpointAuthority} from './account-checkpoint-authority.mjs';
import {createAccountCheckpoint} from './account-checkpoint.mjs';
import {accountHandoffBytes} from './account-handoff.mjs';
import {accountEvent,accountRecord} from './account-history.mjs';
if(process.env.ALLIANCE_DYNAMO_TEST_CONFIRM!=='synthetic_account_dynamodb'||process.getuid?.()!==0)throw Error('Confirmed disposable fixture required');
const links=JSON.parse(execFileSync('ip',['-j','link','show'],{encoding:'utf8'}));if(links.length!==1||links[0].ifname!=='lo')throw Error('Isolated loopback-only network required');
const tools=JSON.parse(readFileSync(0,'utf8'));
if(!/^\/tmp\/alliance-dynamo-[a-z0-9_]+$/.test(tools.scratch)||realpathSync(tools.scratch)!==tools.scratch||![tools.java,tools.jar].every(p=>p.startsWith(tools.scratch+'/')&&realpathSync(p)===p))throw Error('Wrong official fixture tools');
const scope={memberProjectRef:'abcdefghijklmnopqrst',journalProjectRef:'uvwxyzabcdefghijklmn',controlProjectRef:'opqrstuvwxyzabcdefgh',epoch:randomUUID()},hs={memberProjectRef:scope.memberProjectRef,journalProjectRef:scope.journalProjectRef,epoch:scope.epoch};
const zero={sequence:0,sha256:'0'.repeat(64)},key='b'.repeat(64),tag='a'.repeat(64),sha=b=>createHash('sha256').update(b).digest('hex'),receipt=b=>({generation:JSON.parse(b).generation,sha256:sha(b)});
const event=kind=>accountEvent({kind,subject:tag}),one=accountRecord({scope:hs,sequence:1,previous:zero.sha256,event:event('account_admitted')}),two=accountRecord({scope:hs,sequence:2,previous:one.sha256,event:event('account_remove_requested')}),tip=r=>({sequence:r.sequence,sha256:r.sha256});
const base={format:1,scope,generation:1,previousSha256:zero.sha256,verificationKey:key,minimum:{head:tip(one),acknowledged:zero},pending:null},initialBytes=accountHandoffBytes(base),initial=receipt(initialBytes);
const resource={accountId:'000000000000',region:'us-east-2',tableName:'alliance-account-authority-fixture-'+randomUUID().replaceAll('-','').slice(0,16),tableId:randomUUID(),rootKey:'c'.repeat(64),custodyId:'d'.repeat(64)};
const config={region:resource.region,endpoint:'http://127.0.0.1:8557',credentials:{accessKeyId:'LOCALONLY',secretAccessKey:'LOCALONLY'},maxAttempts:1,requestHandler:{connectionTimeout:300,requestTimeout:800,throwOnRequestTimeout:true}};
const admin=new DynamoDBClient(config),stores=[],authorities=[];let child,created=false,lostReply=false,badIdentity=false,putCalls=0;
const stop=async()=>{if(!child)return;const current=child;child=undefined;if(current.exitCode!==null)return;const exited=once(current,'exit');current.kill('SIGTERM');const timer=setTimeout(()=>current.kill('SIGKILL'),4000);try{await exited;}finally{clearTimeout(timer);}};
async function start(){
 child=spawn(tools.java,['-Djava.library.path='+dirname(tools.jar)+'/DynamoDBLocal_lib','-jar',tools.jar,'-sharedDb','-dbPath',tools.scratch+'/data','-port','8557'],{cwd:tools.scratch,stdio:['ignore','ignore','ignore']});
 for(let n=0;n<40;n++){
  try{await admin.send(new DescribeTableCommand({TableName:resource.tableName}));return;}catch(e){if(e.name==='ResourceNotFoundException')return;if(child.exitCode!==null)throw Error('Local emulator exited');await new Promise(r=>setTimeout(r,150));}
 }throw Error('Local emulator readiness expired');
}
function store(){
 const s=createDynamoAccountCheckpointStore({enabled:true,scope,verificationKey:key,resource,timeoutMs:2500,credentials:async()=>config.credentials,openClient:()=>{
  const c=new DynamoDBClient(config);return {destroy:()=>c.destroy(),async send(command,options){
   if(!['DescribeTableCommand','DescribeTimeToLiveCommand','GetItemCommand','PutItemCommand'].includes(command.constructor.name))throw Error('Unexpected runtime privilege');
   const result=await c.send(command,options);
   if(command.constructor.name==='DescribeTableCommand'){
    // Local3.3.2 has ddblocal ARN and NO TableId. Only these two metadata
    // fields are projected; do not claim AWS identity/IAM checks were hosted.
    assert.equal(result.Table.TableArn,`arn:aws:dynamodb:ddblocal:000000000000:table/${resource.tableName}`);assert.equal(result.Table.TableId,undefined);
    result.Table.TableArn=`arn:aws:dynamodb:us-east-2:000000000000:table/${resource.tableName}`;result.Table.TableId=badIdentity?randomUUID():resource.tableId;
   }
   if(command.constructor.name==='PutItemCommand'){putCalls++;if(lostReply){lostReply=false;throw Error('Synthetic lost reply AFTER real commit');}}
   return result;
  }};
 }});stores.push(s);return s;
}
const authority=(s,minimum=initial)=>{const a=createAccountCheckpointAuthority({enabled:true,scope,verificationKey:key,minimum,store:s});authorities.push(a);return a;};
const item=bytes=>({rootKey:{S:resource.rootKey},custodyId:{S:resource.custodyId},generation:{N:String(receipt(bytes).generation)},sha256:{S:sha(bytes)},bytes:{B:bytes}});
const current=async()=>Buffer.from((await admin.send(new GetItemCommand({TableName:resource.tableName,Key:{rootKey:{S:resource.rootKey}},ConsistentRead:true}))).Item.bytes.B);
const request=(before,patch,records)=>{const bytes=accountHandoffBytes({...JSON.parse(before),generation:receipt(before).generation+1,previousSha256:sha(before),...patch});return {expected:receipt(before),next:receipt(bytes),bytes,records,kind:'ordinary'};};
try{
 mkdirSync(tools.scratch+'/data',{mode:0o700});await start();
 await admin.send(new CreateTableCommand({TableName:resource.tableName,KeySchema:[{AttributeName:'rootKey',KeyType:'HASH'}],AttributeDefinitions:[{AttributeName:'rootKey',AttributeType:'S'}],BillingMode:'PAY_PER_REQUEST',DeletionProtectionEnabled:true}));created=true;
 await admin.send(new PutItemCommand({TableName:resource.tableName,Item:item(initialBytes),ConditionExpression:'attribute_not_exists(rootKey)'}));
 const s=store(),a=authority(s);assert.deepEqual(await a.read(),initial);
 console.log('PASS actual DynamoDB Local3.3.2 canonical strong read; ARN/TableId projection is TEST ONLY, not AWS identity proof');
 const t=store(),b=authority(t),q=request(initialBytes,{},[one]),race=await Promise.all([a.advance(q),b.advance(q)]);
 assert.equal(race.filter(v=>v.state==='committed').length,1);assert.equal(race.filter(v=>v.state==='conflict').length,1);assert.deepEqual(await current(),q.bytes);
 console.log('PASS two independent service/SDK clients race through REAL conditional PutItem: one commit, one conflict, no retry');
 const bad=request(q.bytes,{minimum:{head:zero,acknowledged:zero}},[one]),writesBefore=putCalls;assert.deepEqual(await a.advance(bad),{state:'invalid'});assert.equal(putCalls,writesBefore);
 console.log('PASS increasing generation cannot lower retained history through the real backing-store composition');
 await admin.send(new DeleteItemCommand({TableName:resource.tableName,Key:{rootKey:{S:resource.rootKey}}}));await assert.rejects(s.compareAndSet({expected:q.next,bytes:request(q.bytes,{},[one]).bytes}));
 assert.equal((await admin.send(new GetItemCommand({TableName:resource.tableName,Key:{rootKey:{S:resource.rootKey}},ConsistentRead:true}))).Item,undefined);
 await admin.send(new PutItemCommand({TableName:resource.tableName,Item:item(q.bytes),ConditionExpression:'attribute_not_exists(rootKey)'}));
 console.log('PASS missing real emulator item refuses without automatic bootstrap; restoration here is privileged SYNTHETIC fixture injection only');
 let slotBytes=Buffer.from(q.bytes),rows=[one],dispatches=0;
 const anchor=authority(store(),q.next),slot={read:async()=>({bytes:Buffer.from(slotBytes),receipt:receipt(slotBytes)}),compareAndSet:async v=>{if(sha(slotBytes)!==v.expected.sha256)return {state:'conflict',receipt:receipt(slotBytes)};slotBytes=Buffer.from(v.bytes);return {state:'committed',receipt:receipt(slotBytes)};}};
 const c=createAccountCheckpoint({enabled:true,reconciliationEnabled:true,scope,verificationKey:key,minimum:q.next,slot,anchor,history:{snapshot:async()=>({scope:hs,enabled:true,admissionsOpen:true,head:tip(rows.at(-1)),records:structuredClone(rows)}),append:async()=>{dispatches++;rows=[one,two];return {state:'recorded'};}},acknowledgements:{read:async()=>zero,advance:async()=>{throw Error('Unexpected');}}});
 try{assert.equal((await c.execute({id:'e'.repeat(64),kind:'history_append',event:event('account_remove_requested'),expected:tip(one),target:null})).outcome,'reported_commit');assert.equal((await c.reconcile()).state,'resolved');assert.equal(dispatches,1);assert.deepEqual(await current(),slotBytes);}finally{c.close();}
 console.log('PASS coordinator stages pending then conditionally resolves against REAL DynamoDB state with one synthetic business dispatch');
 for(const x of authorities)x.close();for(const x of stores)x.close();await stop();await start();const recovered=store(),fresh=authority(recovered,receipt(slotBytes));assert.deepEqual(await fresh.read(),receipt(slotBytes));
 console.log('PASS committed local emulator disk state survives process stop/restart and fresh service construction; no AWS/power-loss claim');
 const intent={id:'f'.repeat(64),kind:'acknowledgement_advance',event:null,expected:zero,target:tip(two)},lost=request(slotBytes,{pending:intent},[one,two]);lostReply=true;
 assert.deepEqual(await fresh.advance(lost),{state:'unknown'});const afterLost=authority(store(),receipt(slotBytes));assert.deepEqual(await afterLost.read(),lost.next);assert.deepEqual(JSON.parse(await current()).pending,intent);
 assert.deepEqual(await afterLost.advance(request(lost.bytes,{pending:null},[one,two])),{state:'invalid'});
 console.log('PASS simulated lost SDK response AFTER a REAL write preserves pending across a fresh service and never guesses a clear outcome');
 await admin.send(new UpdateTimeToLiveCommand({TableName:resource.tableName,TimeToLiveSpecification:{Enabled:true,AttributeName:'expires'}}));await assert.rejects(recovered.read());await admin.send(new UpdateTimeToLiveCommand({TableName:resource.tableName,TimeToLiveSpecification:{Enabled:false,AttributeName:'expires'}}));assert.deepEqual((await recovered.read()).receipt,lost.next);
 console.log('PASS actual emulator TTL enablement refuses before item evidence; exact disable restores the original accepted policy');
 await admin.send(new UpdateTableCommand({TableName:resource.tableName,DeletionProtectionEnabled:false}));await assert.rejects(recovered.read());await admin.send(new UpdateTableCommand({TableName:resource.tableName,DeletionProtectionEnabled:true}));assert.deepEqual((await recovered.read()).receipt,lost.next);
 console.log('PASS actual deletion-protection drift refuses; exact fixture repair preserves current canonical state');
 badIdentity=true;await assert.rejects(recovered.read());badIdentity=false;assert.deepEqual((await recovered.read()).receipt,lost.next);
 console.log('PASS projected TableId mismatch refuses; real AWS resource identity/IAM/fleet/restore exclusion remain untested');
 for(const x of authorities)x.close();for(const x of stores)x.close();
 await runGatewayNonceFixture({admin,config,restart:async()=>{await stop();await start();}});
}finally{
 for(const x of authorities)x.close();for(const x of stores)x.close();
 try{if(created){await admin.send(new UpdateTableCommand({TableName:resource.tableName,DeletionProtectionEnabled:false}));await admin.send(new DeleteTableCommand({TableName:resource.tableName}));await assert.rejects(admin.send(new DescribeTableCommand({TableName:resource.tableName})),e=>e.name==='ResourceNotFoundException');}}finally{admin.destroy();await stop();}
}
console.log('PASS exact synthetic table and owned Java process removed; zero AWS account calls or real credentials');
