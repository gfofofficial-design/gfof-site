import test from 'node:test';import assert from 'node:assert/strict';
import {createHash,X509Certificate} from 'node:crypto';
import {createWatchtowerServerHandler} from '../netlify/functions/_shared/watchtower-server.mjs';
import {WATCHTOWER_CA,WATCHTOWER_CA_SHA256} from '../netlify/functions/_shared/watchtower-public-ca.mjs';
import {WATCHTOWER_SOURCE_SHA256} from '../netlify/functions/_shared/watchtower-source-revision.mjs';
import config from '../config/watchtower-pilot.json' with {type:'json'};
import intakeHandler,{config as intakeConfig} from '../netlify/functions/watchtower-intake.mjs';
import workerHandler,{config as workerConfig} from '../netlify/functions/watchtower-process-one.mjs';
const time=Date.parse('2026-10-13T20:00:00.000Z');
const context={site:{id:'11111111-1111-4111-8111-111111111111'},deploy:{context:'branch-deploy',published:false,id:'1'.repeat(24)}};
const startup={additionalProviderSpendUsd:0,creditHeadroomChecked:true,automaticPurchasesDisabled:true,providerPauseReviewed:true,storageMigrationApproved:true,storageReady:true,limitsApproved:true,mainnetTransportReviewed:true,credentialProofReviewed:true,otherDatabaseScopeReviewed:true,providerWebhookCostsReviewed:true};
const record=()=>({schema:1,siteId:context.site.id,sourceSha256:WATCHTOWER_SOURCE_SHA256,startsAtUtc:new Date(time-1000).toISOString(),endsAtUtc:new Date(time+60000).toISOString(),startup:{...startup}});
const environment=()=>({WATCHTOWER_PILOT_ENABLED:'true',WATCHTOWER_INTAKE_AUTHORIZATION:'Bearer '+'a'.repeat(43),WATCHTOWER_WORKER_AUTHORIZATION:'Bearer '+'b'.repeat(43),
 WATCHTOWER_ACTIVATION:JSON.stringify(record()),WATCHTOWER_SUPABASE_PROJECT_REF:'abcdefghijklmnopqrst',WATCHTOWER_SUPABASE_POOLER_HOST:'aws-0-us-east-2.pooler.supabase.com',
 WATCHTOWER_INTAKE_DATABASE_PASSWORD:'synthetic-intake-password-24plus',WATCHTOWER_WORKER_DATABASE_PASSWORD:'synthetic-worker-password-24plus',WATCHTOWER_HELIUS_API_KEY:'synthetic-fixture-provider-key'});
const request=(kind,env,options={})=>new Request('https://fixture.invalid/api/watchtower/'+(kind==='intake'?'intake':'process-one'),{method:'POST',headers:{authorization:env[kind==='intake'?'WATCHTOWER_INTAKE_AUTHORIZATION':'WATCHTOWER_WORKER_AUTHORIZATION']},...options});
const code=async response=>(await response.json()).code;
test('closed handlers read no credentials or body and export no schedule',async()=>{
 const read=[];const handler=createWatchtowerServerHandler({kind:'intake',readEnv:name=>{read.push(name);return undefined;},bindingsFactory:()=>{throw Error('must not construct');}});
 assert.equal(await code(await handler(new Request('https://fixture.invalid'),{})),'WATCHTOWER_DISABLED');assert.deepEqual(read,['WATCHTOWER_PILOT_ENABLED']);
 assert.equal((await intakeHandler(new Request('https://fixture.invalid'),{})).status,503);assert.equal((await workerHandler(new Request('https://fixture.invalid'),{})).status,503);
 assert.deepEqual(intakeConfig,{path:'/api/watchtower/intake'});assert.deepEqual(workerConfig,{path:'/api/watchtower/process-one'});
});
test('method, query credentials, wrong or swapped headers and worker bodies never open storage',async()=>{
 const env=environment();let pools=0,privateReads=0;
 const handler=createWatchtowerServerHandler({kind:'worker',now:()=>time,readEnv:name=>{if(name.includes('DATABASE')||name.includes('HELIUS'))privateReads++;return env[name];},bindingsFactory:()=>{pools++;throw Error();}});
 for(const req of [request('worker',env,{method:'GET'}),new Request('https://fixture.invalid/api/watchtower/process-one?token=test',{method:'POST'}),
  request('worker',env,{headers:{authorization:env.WATCHTOWER_INTAKE_AUTHORIZATION}}),request('worker',env,{headers:{authorization:'Bearer wrong'}}),
  request('worker',env,{body:'{}'}),request('worker',env,{headers:{authorization:env.WATCHTOWER_WORKER_AUTHORIZATION,'content-encoding':'gzip'}})])assert.ok((await handler(req,context)).status>=400);
 assert.equal(pools,0);assert.equal(privateReads,0);
});
test('deployment, source version, prerequisites and absolute time gates refuse before database credentials',async()=>{
 let attempts=0;
 const variants=[{record:{sourceSha256:'0'.repeat(64)}},{record:{siteId:'22222222-2222-4222-8222-222222222222'}},
  {record:{endsAtUtc:new Date(time).toISOString()}},{record:{startsAtUtc:new Date(time+1000).toISOString()}},
  {record:{endsAtUtc:new Date(time+600000).toISOString()}},{record:{startup:{...startup,otherDatabaseScopeReviewed:false}}},
  {record:{startup:{...startup,additionalProviderSpendUsd:25}}},{context:{...context,deploy:{...context.deploy,context:'production'}}},
  {context:{...context,deploy:{...context.deploy,published:true}}},{context:{}},{text:'invalid json'},{env:{WATCHTOWER_WORKER_AUTHORIZATION:'Bearer '+'a'.repeat(43)}}];
 for(const changed of variants){const env={...environment(),...changed.env};env.WATCHTOWER_ACTIVATION=changed.text??JSON.stringify({...record(),...changed.record});
  const handler=createWatchtowerServerHandler({kind:'intake',now:()=>time,readEnv:name=>{if(name.includes('DATABASE'))attempts++;return env[name];},bindingsFactory:()=>{attempts++;throw Error();}});
  assert.equal((await handler(request('intake',env),changed.context??context)).status,503);
 }assert.equal(attempts,0);
});
test('bundled public CA has its reviewed digest and is a CA',()=>{
 assert.equal(createHash('sha256').update(WATCHTOWER_CA).digest('hex'),WATCHTOWER_CA_SHA256);assert.equal(new X509Certificate(WATCHTOWER_CA).ca,true);
});
test('authenticated HTTP composition projects intake, reserves both calls and saves one corroboration',async()=>{
 const env=environment(),order=[];let stored,closes=0;
 const account=config.accounts[0].address,signature='1'.repeat(64);
 const bindingsFactory=({connection})=>{assert.equal(connection.intakePassword,env.WATCHTOWER_INTAKE_DATABASE_PASSWORD);assert.notEqual(connection.intakePassword,connection.workerPassword);
  return {intakeQuery:async(sql,args)=>{assert.ok(sql.includes('enqueue_'));order.push('receipt');stored=JSON.parse(args[0])[0];assert.deepEqual(Object.keys(stored).sort(),['matchedAccounts','signature','slot']);return {rowCount:1,rows:[{accepted:1}]};},
   workerQuery:async(sql,args)=>{if(sql.includes('claim_')){order.push('claim');return {rowCount:1,rows:[{signature:stored.signature,slot:123,lease_version:1,state:'leased',matched_accounts:stored.matchedAccounts}]};}
    if(sql.includes('watchtower_rpc_allowance')){order.push('allowance');return {rowCount:1};}
    assert.ok(sql.includes('finish_'));order.push('finish');assert.equal(JSON.parse(args[2]).emitsFinding,false);return {rowCount:1,rows:[{finished:true}]};},close:async()=>{closes++;}};};
 const fetcher=async(_,options)=>{order.push('rpc');const req=JSON.parse(options.body);return new Response(JSON.stringify({jsonrpc:'2.0',id:req.id,result:req.id===1?
  {slot:123,version:'legacy',meta:{err:null},transaction:{signatures:[signature],message:{accountKeys:[account]}}}:{context:{slot:125},value:[null]}}),{headers:{'content-type':'application/json'}});};
 const settings={readEnv:name=>env[name],now:()=>time,bindingsFactory,fetcher};
 const intake=createWatchtowerServerHandler({kind:'intake',...settings}),worker=createWatchtowerServerHandler({kind:'worker',...settings});
 const response=await intake(request('intake',env,{headers:{authorization:env.WATCHTOWER_INTAKE_AUTHORIZATION,'content-type':'application/json'},body:JSON.stringify([{signature,slot:123,accountData:[{account}],rawPrivateExtra:'not retained'}])}),context);
 assert.equal(await code(response),'RECEIPT_ACCEPTED');assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('access-control-allow-origin'),null);
 assert.equal(await code(await worker(request('worker',env),context)),'CORROBORATION_SAVED');assert.equal(closes,2);
 assert.deepEqual(order,['receipt','claim','allowance','rpc','allowance','rpc','finish']);
});
test('storage failures close both bindings and never echo credentials or exception details',async()=>{
 const env=environment();let closes=0;
 const handler=createWatchtowerServerHandler({kind:'worker',readEnv:name=>env[name],now:()=>time,bindingsFactory:()=>({intakeQuery:async()=>{},workerQuery:async()=>{throw Error(env.WATCHTOWER_WORKER_DATABASE_PASSWORD);},close:async()=>{closes++;}})});
 const response=await handler(request('worker',env),context);assert.equal(response.status,503);assert.equal(await code(response),'WORKER_NOT_COMPLETED');assert.equal(closes,1);
});
test('an already cancelled request reads no database credentials',async()=>{
 const env=environment(),controller=new AbortController();controller.abort();let reads=0;
 const handler=createWatchtowerServerHandler({kind:'worker',now:()=>time,readEnv:name=>{if(name.includes('DATABASE'))reads++;return env[name];}});
 assert.equal(await code(await handler(request('worker',env,{signal:controller.signal}),context)),'REQUEST_STOPPED');assert.equal(reads,0);
});
test('window expiry cancels an outstanding source read and forbids second reserve or completion',async()=>{
 const env=environment(),start=Date.now();env.WATCHTOWER_ACTIVATION=JSON.stringify({...record(),startsAtUtc:new Date(start-1000).toISOString(),endsAtUtc:new Date(start+150).toISOString()});
 const account=config.accounts[0].address,signature='1'.repeat(64);let calls=0,reservations=0,finished=0,closes=0,aborted=false;
 const handler=createWatchtowerServerHandler({kind:'worker',readEnv:name=>env[name],bindingsFactory:()=>({intakeQuery:async()=>{},
  workerQuery:async sql=>{if(sql.includes('claim_'))return {rowCount:1,rows:[{signature,slot:123,lease_version:1,state:'leased',matched_accounts:[account]}]};if(sql.includes('watchtower_rpc_allowance')){reservations++;return {rowCount:1};}finished++;throw Error();},close:async()=>{closes++;}}),
  fetcher:async(_,options)=>{calls++;return new Promise((_,reject)=>options.signal.addEventListener('abort',()=>{aborted=true;reject(Error('fixture cancelled'));},{once:true}));}});
 const response=await handler(request('worker',env),context);assert.equal(response.status,503);assert.equal(aborted,true);assert.equal(calls,1);assert.equal(reservations,1);assert.equal(finished,0);assert.equal(closes,1);
});
test('absolute expiry cannot be extended by a second invocation',async()=>{
 const env=environment();let clock=time,pools=0;
 const handler=createWatchtowerServerHandler({kind:'worker',readEnv:name=>env[name],now:()=>clock,bindingsFactory:()=>{pools++;return {intakeQuery:async()=>{},workerQuery:async()=>({rowCount:0}),close:async()=>{}};}});
 assert.equal(await code(await handler(request('worker',env),context)),'NO_CANDIDATE');clock=time+60000;
 assert.equal((await handler(request('worker',env),context)).status,503);assert.equal(pools,1);
});
