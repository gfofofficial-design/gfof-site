import test from 'node:test';
import assert from 'node:assert/strict';
import {rootCertificates} from 'node:tls';
import {createAvatarLedger} from './ledger.mjs';
import {RECOVERY_TABLES} from './recovery-pair.mjs';
const actor='11111111-1111-4111-8111-111111111111',operation='22222222-2222-4222-8222-222222222222',objectId='33333333-3333-4333-8333-333333333333';
const connection={host:'db.abcdefghijklmnopqrst.supabase.co',password:'synthetic-test-password-only-123456',ca:rootCertificates[0]};
const identity=()=>({database:'postgres',actor:'alliance_avatar_executor',login:'alliance_avatar_executor',tls:true,restricted:true,isolated:true,limited:true});
const descriptor=()=>({bytes:1024,width:1,height:1,mime:'image/png',sha256:'a'.repeat(64)});
const receipt=()=>({...descriptor(),profileId:actor,objectId,key:`v1/${actor}/${objectId}.png`,providerId:objectId});
const proof=()=>({state:'stored',writeSettled:true,verified:true,receipt:receipt()});
const creation=()=>({kind:'image',profileId:actor,objectId,operationId:operation,version:0});
const tick=()=>new Promise(r=>setImmediate(r));
async function fixture({run,who=identity(),result={dispatch:true,state:'reserved',objectId},timeoutMs=100,acquire,end}={}){
  const calls=[],releases=[],pools=[];let config,acquisitions=0,ended=0;
  const client={async query(q){calls.push(q);if(run)return run(q,calls.length);
    if(q.text.startsWith('select current_database'))return {rows:[who]};
    if(q.text==='COMMIT')return {command:'COMMIT'};
    if(q.text.startsWith('SELECT alliance_avatar.'))return {rows:[{result}]};return {command:'SET',rows:[]};},release(destroy){releases.push(destroy);}};
  const pool={connect(){acquisitions++;return acquire?acquire(client):Promise.resolve(client);},on(name,callback){pools.push({name,callback});},async end(){ended++;if(end)return end();}};
  const ledger=await createAvatarLedger({enabled:true,connection,timeoutMs,openPool:c=>{config=c;return pool;}});
  return {ledger,calls,releases,pools,client,get config(){return config;},get acquisitions(){return acquisitions;},get ended(){return ended;}};
}
async function rejected(promise,outcome){await assert.rejects(promise,e=>e.message==='avatar_ledger_unavailable'&&e.outcome===outcome&&e.cause===undefined);}

test('complete member recovery inventory uses one fixed readonly function and excludes row content',async()=>{
  const inventory={format:2,domain:'member',closed:true,tables:RECOVERY_TABLES.member.map(table=>({table,rows:table.endsWith('.control')?1:0,sha256:'a'.repeat(64)}))};
  const f=await fixture({result:inventory});assert.deepEqual(await f.ledger.recoveryInventory(),inventory);assert.deepEqual(f.calls[3],{text:'SELECT alliance_avatar.recovery_inventory() AS result',values:[]});await f.ledger.close();
  const g=await fixture({result:{...inventory,rows:'PRIVATE'}});await rejected(g.ledger.recoveryInventory(),'not_started');assert.equal(g.calls.length,4);await g.ledger.close();
});

test('creation preparation and readonly lookup use fixed session-bound statements and validated plans',async()=>{
  const f=await fixture({result:creation()});assert.deepEqual(await f.ledger.prepareImageSession(actor,operation,operation,0),creation());assert.deepEqual(f.calls[3],{text:'SELECT alliance_avatar.prepare_image_session($1::uuid,$2::uuid,$3::uuid,$4::bigint) AS result',values:[actor,operation,operation,'0']});await f.ledger.close();
  const g=await fixture({result:null});assert.equal(await g.ledger.creationStatusSession(actor,operation,'profile','00000000-0000-0000-0000-000000000000'),null);assert.match(g.calls[3].text,/creation_status_session/);await g.ledger.close();
});
test('malformed or lost preparation reply remains unknown and cannot claim COMMIT',async()=>{
  const f=await fixture({result:{...creation(),private:'PRIVATE'}});await rejected(f.ledger.prepareImageSession(actor,operation,operation,0),'unknown');assert.equal(f.calls.length,4);await f.ledger.close();
});

test('disabled or non-boolean activation imports no driver or opens a pool',async()=>{
  let opened=0;for(const enabled of [undefined,false,'true',1]){const l=await createAvatarLedger({enabled,openPool:()=>opened++});await rejected(l.reserve(actor,operation,0),'not_started');await l.close();}assert.equal(opened,0);
});
test('configuration pins direct host, role, database, CA validation and finite pool/time limits',async()=>{
  const f=await fixture(),c=f.config;assert.equal(c.host,connection.host);assert.equal(c.database,'postgres');assert.equal(c.user,'alliance_avatar_executor');assert.equal(c.port,5432);assert.equal(c.ssl.rejectUnauthorized,true);assert.equal(c.ssl.minVersion,'TLSv1.2');assert.equal(c.ssl.servername,connection.host);assert.equal(c.enableChannelBinding,true);assert.equal(c.max,2);assert.equal(c.min,0);assert.equal(c.connectionTimeoutMillis,2500);assert.equal(c.statement_timeout,2000);assert.equal(c.lock_timeout,750);assert.equal(c.options,'-c search_path=pg_catalog');assert.equal(f.acquisitions,0);await f.ledger.close();
});
test('connection strings, SSL overrides, foreign hosts, missing credentials and invalid CA refuse',async()=>{
  for(const value of [undefined,{}, {...connection,host:'postgres://secret@host'}, {...connection,host:'db.abcdefghijklmnopqrst.supabase.co.evil.example'}, {...connection,ssl:{rejectUnauthorized:false}},{...connection,password:'short'},{...connection,ca:'not a certificate'},{...connection,user:'postgres'}])await assert.rejects(createAvatarLedger({enabled:true,connection:value,openPool:()=>{throw Error('must not open');}}),/avatar_ledger_unavailable/);
  for(const timeoutMs of [0,-1,4501,1.5,NaN])await assert.rejects(createAvatarLedger({timeoutMs}));
});
test('an asynchronous pool factory cannot stall initialization',async()=>{
  await assert.rejects(createAvatarLedger({enabled:true,connection,openPool:()=>new Promise(()=>{})}),/avatar_ledger_unavailable/);
});
test('CA input accepts certificates only, never private-key text or diagnostic prose',async()=>{
  for(const ca of [connection.ca+'\nPRIVATE KEY SHOULD NOT BE HERE', 'diagnostic text\n'+connection.ca])await assert.rejects(createAvatarLedger({enabled:true,connection:{...connection,ca},openPool:()=>{throw Error('must not open');}}),/avatar_ledger_unavailable/);
});
test('reserve uses one client, fixed SQL, bound values and confirmed COMMIT before returning dispatch',async()=>{
  const f=await fixture();assert.equal((await f.ledger.reserve(actor,operation,0)).dispatch,true);
  assert.equal(f.acquisitions,1);assert.deepEqual(f.calls[3],{text:'SELECT alliance_avatar.reserve($1::uuid,$2::uuid,$3::bigint) AS result',values:[actor,operation,'0']});assert.equal(f.calls.at(-1).text,'COMMIT');assert.deepEqual(f.releases,[false]);await f.ledger.close();
});
test('all operations use fixed parameterized signatures and independent transactions',async()=>{
  const cases=[['mine',[actor],{version:0,objectId:null,pending:[]}],['claimUpload',[actor,operation,descriptor()],{dispatch:true,objectId,key:receipt().key}],['commitUpload',[actor,operation,proof()],{state:'committed',version:1,objectId}],['cancelReserved',[actor,operation],{state:'cancelled'}],['removeImage',[actor,operation,1],{state:'committed',version:2}],['operationReceipt',[actor,operation],{state:'uploading',profileId:actor,objectId,key:receipt().key,writeSettled:false,verified:false,receipt:null,descriptor:descriptor(),deletionReceipt:null}],['settleUnpublished',[operation,proof()],null],['cleanupBatch',[1],[{objectId,key:receipt().key,writeSettled:true,receipt:receipt()}]],['ackDeleted',[objectId,{state:'deleted',writeSettled:true,receipt:receipt()}],null],['expireBatch',[20],1]];
  for(const [method,args,result] of cases){const f=await fixture({result});assert.deepEqual(await f.ledger[method](...args),result);assert.equal(f.calls.length,5);assert.equal(f.calls.at(-1).text,'COMMIT');assert.ok(f.calls[3].values.length>0);await f.ledger.close();}
});
test('only known PostgreSQL void functions normalize the real driver empty string',async()=>{
  for(const [name,args] of [['ackDeleted',[objectId,{state:'deleted',writeSettled:true,receipt:receipt()}]],['settleUnpublished',[operation,proof()]]]){const f=await fixture({result:''});assert.equal(await f.ledger[name](...args),null);assert.equal(f.calls.at(-1).text,'COMMIT');await f.ledger.close();}
  const f=await fixture({result:''});await rejected(f.ledger.reserve(actor,operation,0),'unknown');assert.equal(f.calls.length,4);await f.ledger.close();
});

test('session-aware methods bind the verified actor/session before operation arguments',async()=>{
  const session='44444444-4444-4444-8444-444444444444';
  for(const [method,args,result] of [
    ['authorizeSession',[actor,session],{actorId:actor,sessionId:session,profileId:objectId}],
    ['mineSession',[actor,session],{version:0,objectId:null,pending:[]}],
    ['reserveSession',[actor,session,operation,0],{dispatch:true,state:'reserved',objectId}],
    ['claimUploadSession',[actor,session,operation,descriptor()],{dispatch:true,objectId,key:receipt().key}],
    ['commitUploadSession',[actor,session,operation,proof()],{state:'committed',version:1,objectId}],
    ['cancelReservedSession',[actor,session,operation],{state:'cancelled'}],
    ['removeImageSession',[actor,session,operation,1],{state:'committed',version:2}],
    ['operationReceiptSession',[actor,session,operation],{state:'uploading',profileId:actor,objectId,key:receipt().key,writeSettled:false,verified:false,receipt:null,descriptor:descriptor(),deletionReceipt:null}]
  ]){const f=await fixture({result});assert.deepEqual(await f.ledger[method](...args),result);assert.deepEqual(f.calls[3].values.slice(0,2),[actor,session]);assert.match(f.calls[3].text,/_session\(/);assert.equal(f.calls.at(-1).text,'COMMIT');await f.ledger.close();}
});
test('malformed session contexts fail before commit and never return private fields',async()=>{
  for(const result of [{actorId:actor,sessionId:operation,profileId:objectId,private:'SECRET'},{actorId:actor,sessionId:'bad',profileId:objectId}]){const f=await fixture({result});await rejected(f.ledger.authorizeSession(actor,operation),'not_started');assert.equal(f.calls.length,4);await f.ledger.close();}
});
test('cleanup claim/dispatch/policy/unknown/finish use fixed signatures and committed strict results',async()=>{
  const claimId=operation;
  for(const [name,args,result] of [
    ['claimCleanup',[claimId],{granted:true,claimId,objectId,receipt:receipt(),expiresAt:'2026-10-17T23:00:00Z'}],
    ['beginCleanup',[claimId],{dispatch:true,claimId,objectId,receipt:receipt()}],
    ['authorizeCleanup',[claimId,receipt()],true],['unknownCleanup',[claimId],''],
    ['finishCleanup',[claimId,{state:'deleted',writeSettled:true,receipt:receipt()}],'']
  ]){const f=await fixture({result});assert.deepEqual(await f.ledger[name](...args),result===''?null:result);assert.equal(f.calls[3].values[0],claimId);assert.equal(f.calls.at(-1).text,'COMMIT');await f.ledger.close();}
});
test('malformed cleanup grants, policies and evidence refuse before COMMIT',async()=>{
  for(const [name,result] of [['claimCleanup',{granted:true,claimId:operation,objectId,receipt:{...receipt(),objectId:actor},expiresAt:'bad'}],['beginCleanup',{dispatch:true,claimId:operation,objectId,receipt:receipt(),private:'secret'}],['authorizeCleanup','true'],['finishCleanup',{}]]){
    const f=await fixture({result});await rejected(f.ledger[name](operation,receipt()),name==='authorizeCleanup'?'not_started':'unknown');assert.equal(f.calls.length,4);await f.ledger.close();
  }
});
test('read-only recovery uses fixed bound queries and confirmed COMMIT without provider dispatch',async()=>{
  for(const [name,args,result] of [
    ['cleanupRecovery',[operation],{state:'missing'}],['uploadRecovery',[operation],{state:'missing'}],
    ['retentionReview',['2026-01-01T00:00:00.000Z','00000000-0000-0000-0000-000000000000',1],{before:'2026-01-01T00:00:00+00:00',items:[],next:null}]
  ]){const f=await fixture({result});const value=await f.ledger[name](...args);assert.equal(value.state||value.before,result.state||args[0]);assert.equal(f.calls.at(-1).text,'COMMIT');assert.equal(f.calls[3].values[0],args[0]);await f.ledger.close();}
});
test('invalid recovery windows refuse before connecting and malformed evidence cannot commit',async()=>{
  const f=await fixture();for(const before of ['bad','2026-01-01','2099-01-01T00:00:00.000Z'])await rejected(f.ledger.retentionReview(before,actor,1),'not_started');await rejected(f.ledger.retentionReview('2026-01-01T00:00:00.000Z',actor,0),'not_started');assert.equal(f.acquisitions,0);await f.ledger.close();
  const g=await fixture({result:{state:'deleted',claimState:'deleted',objectState:'deleted',writeSettled:true,proofRecorded:false,dispatchRecorded:true}});await rejected(g.ledger.cleanupRecovery(operation),'not_started');assert.equal(g.calls.length,4);await g.ledger.close();
});

test('restore inventory uses one fixed read-only function and requires a confirmed COMMIT',async()=>{
  const result={format:1,closed:true,tables:['control','heads','operations','objects','daily','cleanup_attempts'].map((table,i)=>({table,rows:i===0?1:0,sha256:'a'.repeat(64)}))};
  const f=await fixture({result});assert.deepEqual(await f.ledger.restoreInventory(),result);assert.deepEqual(f.calls[3],{text:'SELECT alliance_avatar.restore_inventory() AS result',values:[]});assert.equal(f.calls.at(-1).text,'COMMIT');await f.ledger.close();
  const g=await fixture({result:{...result,privateRows:'PRIVATE'}});await rejected(g.ledger.restoreInventory(),'not_started');assert.equal(g.calls.length,4);await g.ledger.close();
});
test('invalid UUIDs, versions, limits and JSON stop before connecting',async()=>{
  const f=await fixture();for(const args of [['x',operation,0],[actor,"x'); drop schema public; --",0],[actor,operation,-1],[actor,operation,Number.MAX_SAFE_INTEGER+1]])await rejected(f.ledger.reserve(...args),'not_started');
  for(const n of [0,21,1.5])await rejected(f.ledger.cleanupBatch(n),'not_started');
  await rejected(f.ledger.claimUpload(actor,operation,{huge:'x'.repeat(4096)}),'not_started');
  const cyclic={};cyclic.self=cyclic;await rejected(f.ledger.claimUpload(actor,operation,cyclic),'not_started');assert.equal(f.acquisitions,0);await f.ledger.close();
});
test('identity/TLS/privilege mismatches destroy the connection before any ledger function',async()=>{
  for(const field of ['database','actor','login','tls','restricted','isolated','limited']){const f=await fixture({who:{...identity(),[field]:typeof identity()[field]==='boolean'?false:'other'}});await rejected(f.ledger.reserve(actor,operation,0),'not_started');assert.equal(f.calls.length,3);assert.deepEqual(f.releases,[true]);await f.ledger.close();}
});
test('JSON parameters are copied before a delayed acquisition can observe caller mutation',async()=>{
  let release;const wait=new Promise(r=>release=r);const f=await fixture({result:{dispatch:true,objectId,key:receipt().key},acquire:async c=>{await wait;return c;}});
  const value=descriptor();const pending=f.ledger.claimUpload(actor,operation,value);value.sha256='b'.repeat(64);release();await pending;assert.equal(JSON.parse(f.calls[3].values[2]).sha256,'a'.repeat(64));await f.ledger.close();
});
test('malformed dispatch, excessive results and unexpected private fields never reach COMMIT',async()=>{
  for(const result of [null,{}, {dispatch:true,state:'committed',objectId},{dispatch:true,state:'reserved',objectId:'bad'},{dispatch:true,state:'reserved',objectId,secret:'must not return'},{dispatch:true,state:'reserved',objectId,huge:'x'.repeat(65536)}]){const f=await fixture({result});await rejected(f.ledger.reserve(actor,operation,0),'unknown');assert.equal(f.calls.length,4);assert.deepEqual(f.releases,[true]);await f.ledger.close();}
});
test('a committed response without a usable version is refused before COMMIT',async()=>{
  for(const result of [{state:'committed'},{state:'committed',version:0},{state:'committed',version:1,dispatch:true}]){const f=await fixture({result});await rejected(f.ledger.commitUpload(actor,operation,proof()),'unknown');assert.equal(f.calls.length,4);await f.ledger.close();}
});
test('inconsistent recovery and duplicate cleanup records cannot become accepted state',async()=>{
  const value={state:'committed',profileId:actor,objectId,key:receipt().key,writeSettled:true,verified:true,receipt:receipt(),descriptor:descriptor(),deletionReceipt:null};
  for(const result of [{...value,writeSettled:false},{...value,descriptor:{...descriptor(),sha256:'b'.repeat(64)}},{...value,descriptor:{...descriptor(),privateField:'no'}}]){const f=await fixture({result});await rejected(f.ledger.operationReceipt(actor,operation),'not_started');assert.equal(f.calls.length,4);await f.ledger.close();}
  const row={objectId,key:receipt().key,writeSettled:true,receipt:receipt()},f=await fixture({result:[row,row]});await rejected(f.ledger.cleanupBatch(2),'not_started');await f.ledger.close();
});
test('confirmed database rejection is sanitized and never retried',async()=>{
  const f=await fixture({run:async q=>{if(q.text.startsWith('select current_database'))return {rows:[identity()]};if(q.text.startsWith('SELECT alliance_avatar.'))throw Object.assign(Error('PRIVATE password=do-not-return'),{code:'42501'});return {};}});
  await rejected(f.ledger.reserve(actor,operation,0),'rejected');assert.equal(f.calls.length,4);assert.deepEqual(f.releases,[true]);await f.ledger.close();
});
test('lost mutation response is unknown; no COMMIT, rollback retry or second function call is sent',async()=>{
  const f=await fixture({run:async q=>{if(q.text.startsWith('select current_database'))return {rows:[identity()]};if(q.text.startsWith('SELECT alliance_avatar.'))throw Error('private URL');return {};}});await rejected(f.ledger.reserve(actor,operation,0),'unknown');assert.equal(f.calls.length,4);assert.deepEqual(f.releases,[true]);await f.ledger.close();
});
test('lost or rolled-back COMMIT acknowledgement cannot enable provider dispatch',async()=>{
  for(const commit of [()=>{throw Error('socket');},()=>({command:'ROLLBACK'})]){
    const f=await fixture({run:async q=>{if(q.text.startsWith('select current_database'))return {rows:[identity()]};if(q.text.startsWith('SELECT alliance_avatar.'))return {rows:[{result:{dispatch:true,state:'reserved',objectId}}]};if(q.text==='COMMIT')return commit();return {};}});
    await rejected(f.ledger.reserve(actor,operation,0),'unknown');assert.equal(f.calls.length,5);assert.deepEqual(f.releases,[true]);await f.ledger.close();
  }
});
test('pre-cancellation performs no acquisition',async()=>{const f=await fixture(),c=new AbortController();c.abort();await rejected(f.ledger.reserve(actor,operation,0,{signal:c.signal}),'not_started');assert.equal(f.acquisitions,0);await f.ledger.close();});
test('non-cooperative late acquisition is destroyed and cannot start a transaction',async()=>{
  let release;const wait=new Promise(r=>release=r);const f=await fixture({timeoutMs:15,acquire:async c=>{await wait;return c;}});await rejected(f.ledger.reserve(actor,operation,0),'not_started');release();await tick();assert.equal(f.calls.length,0);assert.deepEqual(f.releases,[true]);await f.ledger.close();
});
test('timeout in a ledger query is bounded and its late response cannot send COMMIT',async()=>{
  let release;const wait=new Promise(r=>release=r);const f=await fixture({timeoutMs:15,run:async q=>{if(q.text.startsWith('select current_database'))return {rows:[identity()]};if(q.text.startsWith('SELECT alliance_avatar.')){await wait;return {rows:[{result:{dispatch:true,state:'reserved',objectId}}]};}return {};}});
  await rejected(f.ledger.reserve(actor,operation,0),'unknown');release();await tick();assert.equal(f.calls.length,4);assert.deepEqual(f.releases,[true]);await f.ledger.close();
});
test('cancellation after acquisition but before dispatch never calls a ledger function',async()=>{
  const c=new AbortController();const f=await fixture({run:async q=>{if(q.text.startsWith('select current_database')){c.abort();return {rows:[identity()]};}return {};}});await rejected(f.ledger.reserve(actor,operation,0,{signal:c.signal}),'not_started');assert.equal(f.calls.length,3);assert.deepEqual(f.releases,[true]);await f.ledger.close();
});
test('an in-flight COMMIT timeout remains unknown even when it resolves later',async()=>{
  let release;const wait=new Promise(r=>release=r);const f=await fixture({timeoutMs:15,run:async q=>{if(q.text.startsWith('select current_database'))return {rows:[identity()]};if(q.text.startsWith('SELECT alliance_avatar.'))return {rows:[{result:{dispatch:true,state:'reserved',objectId}}]};if(q.text==='COMMIT'){await wait;return {command:'COMMIT'};}return {};}});
  await rejected(f.ledger.reserve(actor,operation,0),'unknown');release();await tick();assert.equal(f.calls.length,5);assert.deepEqual(f.releases,[true]);await f.ledger.close();
});
test('two active calls refuse an unbounded third queue',async()=>{
  const f=await fixture({timeoutMs:15,acquire:()=>new Promise(()=>{})});const a=f.ledger.reserve(actor,operation,0).catch(e=>e),b=f.ledger.reserve(actor,operation,0).catch(e=>e);await rejected(f.ledger.reserve(actor,operation,0),'not_started');assert.equal(f.acquisitions,2);await Promise.all([a,b]);await f.ledger.close();
});
test('close aborts active work, refuses future calls and bounds a stalled pool shutdown',async()=>{
  const f=await fixture({acquire:()=>new Promise(()=>{}),end:()=>new Promise(()=>{})});const pending=f.ledger.mine(actor).catch(e=>e);await f.ledger.close();assert.equal((await pending).outcome,'not_started');await rejected(f.ledger.mine(actor),'not_started');assert.equal(f.ended,1);
});
test('idle driver errors do not escape or disclose raw diagnostics',async()=>{const f=await fixture();assert.equal(f.pools[0].name,'error');assert.doesNotThrow(()=>f.pools[0].callback(Error('secret')));await f.ledger.close();});
