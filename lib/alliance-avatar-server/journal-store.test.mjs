import test from 'node:test';
import assert from 'node:assert/strict';
import {rootCertificates} from 'node:tls';
import {createDeletionJournalStore,createJournalAuthorityReader} from './journal-store.mjs';
import {chain,event,projectRef,epoch,other,zero} from './deletion-journal.fixture.mjs';
import {removalEvents} from './removal.mjs';
import {RECOVERY_TABLES} from './recovery-pair.mjs';
const connection={host:'db.uvwxyzabcdefghijklmn.supabase.co',password:'synthetic-journal-test-password-only',ca:rootCertificates[0]};
const who=()=>({database:'postgres',actor:'alliance_journal_executor',login:'alliance_journal_executor',tls:true,restricted:true,isolated:true,limited:true,durable:true,dedicated:true});
const row=()=>chain([event()])[0],tip=(n=0,h=zero)=>({projectRef,epoch,sequence:n,sha256:h,enabled:true});
const proof=()=>({state:'recorded',record:row(),tip:tip(1,row().sha256)}),input=()=>({event:event(),expected:{sequence:0,sha256:zero}});
async function fixture({reader=false,run,result=proof(),identity=reader?{...who(),actor:'alliance_journal_reader',login:'alliance_journal_reader'}:who(),acquire,end,timeoutMs=100,...options}={}){
  const calls=[],releases=[];let config,acquisitions=0,ends=0;
  const client={async query(q){calls.push(q);if(run)return run(q);if(q.text.startsWith('select current_database'))return {rows:[identity]};if(q.text.startsWith('SELECT alliance_journal.'))return {rows:[{result}]};return {command:q.text==='COMMIT'?'COMMIT':'SET'};},release:v=>releases.push(v)};
  const store=await (reader?createJournalAuthorityReader:createDeletionJournalStore)({enabled:true,projectRef,journalProjectRef:'uvwxyzabcdefghijklmn',epoch,connection,timeoutMs,openPool:c=>{config=c;return {connect:()=>{acquisitions++;return acquire?acquire(client):Promise.resolve(client);},on(){},end:()=>{ends++;return end?.();}};},...options});
  return {store,calls,releases,get config(){return config;},get acquisitions(){return acquisitions;},get ends(){return ends;}};
}
const rejected=(p,outcome)=>assert.rejects(p,e=>e.message==='alliance_journal_unavailable'&&e.outcome===outcome&&e.cause===undefined);
const tick=()=>new Promise(r=>setImmediate(r));
const admittedEvent=()=>removalEvents({format:1,kind:'profile',operationId:other,profileId:event().profileId,version:0,objectIds:[]})[0];

test('authority reader defaults closed and exposes no write, lookup or recovery-inventory capability',async()=>{
 const f=await fixture({reader:true,enabled:false});assert.deepEqual(Object.keys(f.store).sort(),['close','records','tip']);
 await rejected(f.store.tip(),'not_started');assert.equal(f.acquisitions,0);await f.store.close();
});
test('authority reader pins its separate exact host, role and short bounds before connection',async()=>{
 for(const options of [{journalProjectRef:undefined},{journalProjectRef:projectRef},{journalProjectRef:'abcdefghijklmnopqrss'},{timeoutMs:1501}])await assert.rejects(fixture({reader:true,...options}));
 const f=await fixture({reader:true,result:tip()});assert.equal(f.config.user,'alliance_journal_reader');assert.equal(f.config.ssl.rejectUnauthorized,true);assert.equal(f.config.statement_timeout,750);
 assert.deepEqual(await f.store.tip(),tip());assert.equal(f.calls[0].text,'BEGIN READ ONLY');assert.equal(f.calls.at(-1).text,'COMMIT');await f.store.close();
});
test('authority reader refuses executor identity and any failed effective permission/isolation check before journal dispatch',async()=>{
 for(const change of [{actor:'alliance_journal_executor'},{login:'alliance_journal_executor'},{isolated:false},{limited:false},{tls:false},{restricted:false},{durable:false}]){
  const f=await fixture({reader:true,identity:{...who(),actor:'alliance_journal_reader',login:'alliance_journal_reader',...change}});
  await rejected(f.store.tip(),'not_started');assert.equal(f.calls.length,3);assert.deepEqual(f.releases,[true]);await f.store.close();
 }
});
test('authority reader retains complete canonical prefix and scope checks',async()=>{
 const f=await fixture({reader:true,result:[row()]});assert.deepEqual(await f.store.records({sequence:1,sha256:row().sha256}),[row()]);await f.store.close();
 for(const result of [[],[{...row(),epoch:other}],[{...row(),sha256:zero}]]){
  const g=await fixture({reader:true,result});await rejected(g.store.records({sequence:1,sha256:row().sha256}),'not_started');assert.equal(g.calls.length,4);await g.store.close();
 }
});
test('authority reader does not commit or retry a late read or expose provider diagnostics',async()=>{
 let release;const gate=new Promise(r=>release=r),f=await fixture({reader:true,timeoutMs:15,result:tip(),run:async q=>{
  if(q.text.startsWith('select current_database'))return {rows:[{...who(),actor:'alliance_journal_reader',login:'alliance_journal_reader'}]};
  if(q.text.startsWith('SELECT alliance_journal.')){await gate;return {rows:[{result:tip()}]};}return {};
 }});
 await rejected(f.store.tip(),'not_started');release();await tick();assert.equal(f.calls.length,4);assert.deepEqual(f.releases,[true]);await f.store.close();
});
test('independent recovery inventory is fixed, scope-bound and rejects private or wrong-epoch data',async()=>{
  const value={format:2,domain:'journal',closed:true,projectRef,epoch,sequence:0,sha256:zero,tables:RECOVERY_TABLES.journal.map(table=>({table,rows:table.endsWith('.control')?1:0,sha256:'a'.repeat(64)}))};
  const f=await fixture({result:value});assert.deepEqual(await f.store.recoveryInventory(),value);assert.deepEqual(f.calls[3],{text:'SELECT alliance_journal.recovery_inventory($1::text,$2::uuid) AS result',values:[projectRef,epoch]});await f.store.close();
  for(const result of [{...value,epoch:other},{...value,private:'PRIVATE'}]){const g=await fixture({result});await rejected(g.store.recoveryInventory(),'not_started');assert.equal(g.calls.length,4);await g.store.close();}
});
test('admission uses fixed bound event and confirmed COMMIT; caller cannot replace it',async()=>{
  const e=admittedEvent(),f=await fixture({result:{state:'admitted',event:e}});assert.deepEqual(await f.store.admit(e),{state:'admitted',event:e});assert.deepEqual(f.calls[3],{text:'SELECT alliance_journal.admit($1::text,$2::uuid,$3::jsonb) AS result',values:[projectRef,epoch,JSON.stringify(e)]});assert.equal(f.calls.at(-1).text,'COMMIT');await f.store.close();
});
test('noncanonical intent IDs and extra admission metadata fail before acquisition',async()=>{
  const f=await fixture();for(const e of [event(),{...admittedEvent(),subject:'PRIVATE'},{...admittedEvent(),profileId:other}])await rejected(f.store.admit(e),'not_started');assert.equal(f.acquisitions,0);await f.store.close();
});
test('paused/full/removed admission never retries and read-only missing remains missing',async()=>{
  for(const state of ['paused','full','removed','profile_required','history_full']){const f=await fixture({result:{state}});assert.deepEqual(await f.store.admit(admittedEvent()),{state});assert.equal(f.calls.length,5);await f.store.close();}
  for(const state of ['missing','removed']){const f=await fixture({result:{state}});assert.deepEqual(await f.store.admission(admittedEvent()),{state});assert.match(f.calls[3].text,/alliance_journal.admission/);await f.store.close();}
});
test('admission acknowledgements bind complete canonical intent and exclude private fields',async()=>{
  for(const result of [{state:'admitted',event:admittedEvent(),private:'PRIVATE'},{state:'admitted',event:removalEvents({format:1,kind:'profile',operationId:other,profileId:other,version:0,objectIds:[]})[0]},{state:'missing'}]){const f=await fixture({result});await rejected(f.store.admit(admittedEvent()),'unknown');assert.equal(f.calls.length,4);await f.store.close();}
});
test('lost admission or COMMIT acknowledgement remains unknown with no automatic recovery',async()=>{
  for(const at of ['SELECT alliance_journal.','COMMIT']){const f=await fixture({run:q=>{if(q.text.startsWith('select current_database'))return {rows:[who()]};if(q.text.startsWith(at))throw Error('PRIVATE');if(q.text.startsWith('SELECT alliance_journal.'))return {rows:[{result:{state:'admitted',event:admittedEvent()}}]};return {};}});await rejected(f.store.admit(admittedEvent()),'unknown');assert.equal(f.calls.filter(q=>q.text.startsWith('SELECT alliance_journal.')).length,1);await f.store.close();}
});
test('late admission response cannot send COMMIT, retry or refund after its deadline',async()=>{
  let release;const gate=new Promise(r=>release=r),f=await fixture({timeoutMs:15,run:async q=>{if(q.text.startsWith('select current_database'))return {rows:[who()]};if(q.text.startsWith('SELECT alliance_journal.')){await gate;return {rows:[{result:{state:'admitted',event:admittedEvent()}}]};}return {};}});
  await rejected(f.store.admit(admittedEvent()),'unknown');release();await tick();assert.equal(f.calls.length,4);assert.deepEqual(f.releases,[true]);await f.store.close();
});
test('journal store defaults closed without pool or credential lookup',async()=>{for(const enabled of [undefined,false,'true']){const f=await fixture({enabled});await rejected(f.store.append(input()),'not_started');assert.equal(f.acquisitions,0);await f.store.close();}});
test('fixed TLS/role/database/pool and synchronous commit settings cannot be overridden',async()=>{
  const f=await fixture();assert.equal(f.config.user,'alliance_journal_executor');assert.equal(f.config.database,'postgres');assert.equal(f.config.port,5432);assert.equal(f.config.ssl.rejectUnauthorized,true);assert.equal(f.config.ssl.servername,connection.host);assert.equal(f.config.max,2);assert.equal(f.config.enableChannelBinding,true);await f.store.append(input());assert.match(f.calls[1].text,/synchronous_commit='on'/);await f.store.close();
});
test('member project host is refused before opening an independent journal connection',async()=>{
  let opened=0;await assert.rejects(createDeletionJournalStore({enabled:true,projectRef,epoch,connection:{...connection,host:`db.${projectRef}.supabase.co`},openPool:()=>opened++}),/alliance_journal_unavailable/);assert.equal(opened,0);
});
test('foreign hosts, connection strings, extra connection keys and private-key prose refuse',async()=>{
  for(const c of [{...connection,host:'postgres://secret@host'},{...connection,host:connection.host+'.evil.example'},{...connection,user:'postgres'},{...connection,password:'short'},{...connection,ca:connection.ca+'\nPRIVATE KEY'}])await assert.rejects(createDeletionJournalStore({enabled:true,projectRef,epoch,connection:c}),/alliance_journal_unavailable/);
  for(const timeoutMs of [0,4501,1.5])await assert.rejects(createDeletionJournalStore({timeoutMs}));
});
test('append copies the exact event and returns only after a confirmed COMMIT',async()=>{
  const f=await fixture();assert.deepEqual(await f.store.append(input()),proof());assert.deepEqual(f.calls[3],{text:'SELECT alliance_journal.append($1::text,$2::uuid,$3::integer,$4::text,$5::jsonb) AS result',values:[projectRef,epoch,0,zero,JSON.stringify(event())]});assert.equal(f.calls.at(-1).text,'COMMIT');assert.deepEqual(f.releases,[false]);await f.store.close();
});
test('read-only tip/lookup/prefix use fixed signatures and explicit missing stays missing',async()=>{
  for(const [method,arg,result]of [['tip',undefined,tip()],['lookup',event(),{state:'missing'}],['records',{sequence:1,sha256:row().sha256},[row()]]]){const f=await fixture({result});assert.deepEqual(await f.store[method](arg),result);assert.equal(f.calls.at(-1).text,'COMMIT');assert.deepEqual(f.calls[3].values.slice(0,2),[projectRef,epoch]);await f.store.close();}
});
test('conflict/full/paused responses do not cause automatic append retries',async()=>{
  for(const result of [{state:'conflict',tip:tip(1,row().sha256)},{state:'full',tip:tip(256,'a'.repeat(64))},{state:'paused',tip:{...tip(),enabled:false}}]){const f=await fixture({result});assert.deepEqual(await f.store.append(input()),result);assert.equal(f.calls.filter(q=>q.text.startsWith('SELECT alliance_journal.')).length,1);await f.store.close();}
});
test('malformed/private/wrong-event or incorrectly hashed receipts cannot COMMIT',async()=>{
  for(const result of [{...proof(),secret:'PRIVATE'},{...proof(),record:{...row(),sha256:zero}},{...proof(),record:chain([event({id:other})])[0]}, {...proof(),tip:{...proof().tip,epoch:other}},{state:'full',tip:tip()}]){const f=await fixture({result});await rejected(f.store.append(input()),'unknown');assert.equal(f.calls.length,4);await f.store.close();}
});
test('records never accept a truncated, duplicated or wrongly anchored prefix',async()=>{
  for(const result of [[],[row(),row()],[{...row(),previous:'a'.repeat(64)}]]){const f=await fixture({result});await rejected(f.store.records({sequence:1,sha256:row().sha256}),'not_started');assert.equal(f.calls.length,4);await f.store.close();}
});
test('unsafe IDs, event metadata and tip bounds refuse before acquiring a connection',async()=>{
  const f=await fixture();for(const v of [{...input(),event:{...event(),receipt:'PRIVATE'}},{...input(),expected:{sequence:257,sha256:zero}},{...input(),expected:{sequence:0,sha256:'a'.repeat(64)}}])await rejected(f.store.append(v),'not_started');await rejected(f.store.lookup('bad'),'not_started');assert.equal(f.acquisitions,0);await f.store.close();
});
test('identity/durability/member-co-location mismatch prevents any function call',async()=>{
  for(const k of Object.keys(who())){const identity={...who(),[k]:typeof who()[k]==='boolean'?false:'other'},f=await fixture({identity});await rejected(f.store.append(input()),'not_started');assert.equal(f.calls.length,3);await f.store.close();}
});
test('caller changes cannot replace an event after asynchronous acquisition starts',async()=>{
  let release;const gate=new Promise(r=>release=r),f=await fixture({acquire:async c=>{await gate;return c;}}),v=input(),pending=f.store.append(v);v.event.profileId=other;release();await pending;assert.equal(JSON.parse(f.calls[3].values[4]).profileId,event().profileId);await f.store.close();
});
test('definite SQL rejection is sanitized and never retried',async()=>{
  const f=await fixture({run:q=>{if(q.text.startsWith('select current_database'))return {rows:[who()]};if(q.text.startsWith('SELECT alliance_journal.'))throw Object.assign(Error('PRIVATE'),{code:'42501'});return {};}});await rejected(f.store.append(input()),'rejected');assert.equal(f.calls.length,4);await f.store.close();
});
test('lost append or COMMIT response is unknown without automatic retry or lookup',async()=>{
  for(const at of ['SELECT alliance_journal.','COMMIT']){const f=await fixture({run:q=>{if(q.text.startsWith('select current_database'))return {rows:[who()]};if(q.text.startsWith(at))throw Error('PRIVATE');if(q.text.startsWith('SELECT alliance_journal.'))return {rows:[{result:proof()}]};return {};}});await rejected(f.store.append(input()),'unknown');assert.equal(f.calls.filter(q=>q.text.startsWith('SELECT alliance_journal.')).length,1);await f.store.close();}
});
test('failed lookup remains unavailable rather than falsely missing or recorded',async()=>{
  const f=await fixture({run:q=>{if(q.text.startsWith('select current_database'))return {rows:[who()]};if(q.text.startsWith('SELECT alliance_journal.'))throw Error('PRIVATE');return {};}});await rejected(f.store.lookup(event()),'not_started');assert.equal(f.calls.length,4);await f.store.close();
});
test('recovery binds the entire original intent, not only a matching event UUID',async()=>{
  const f=await fixture();await rejected(f.store.lookup({...event(),profileId:other}),'not_started');assert.equal(f.calls.length,4);await f.store.close();
});
test('a COMMIT that actually rolled back cannot produce recorded success',async()=>{
  const f=await fixture({run:q=>q.text.startsWith('select current_database')?{rows:[who()]}:q.text.startsWith('SELECT alliance_journal.')?{rows:[{result:proof()}]}:{command:q.text==='COMMIT'?'ROLLBACK':'SET'}});await rejected(f.store.append(input()),'unknown');await f.store.close();
});
test('pre-cancelled requests and two occupied slots refuse more work',async()=>{
  const f=await fixture({acquire:()=>new Promise(()=>{}),timeoutMs:15});await rejected(f.store.append(input(),{signal:AbortSignal.abort()}),'not_started');assert.equal(f.acquisitions,0);const a=f.store.append(input()).catch(e=>e),b=f.store.append(input()).catch(e=>e);await rejected(f.store.append(input()),'not_started');await Promise.all([a,b]);assert.equal(f.acquisitions,2);await f.store.close();
});
test('late append response cannot issue COMMIT after the deadline',async()=>{
  let release;const gate=new Promise(r=>release=r),f=await fixture({timeoutMs:15,run:async q=>{if(q.text.startsWith('select current_database'))return {rows:[who()]};if(q.text.startsWith('SELECT alliance_journal.')){await gate;return {rows:[{result:proof()}]};}return {};}});await rejected(f.store.append(input()),'unknown');release();await tick();assert.equal(f.calls.length,4);await f.store.close();
});
test('late connection acquisition is destroyed without a transaction',async()=>{
  let release;const gate=new Promise(r=>release=r),f=await fixture({timeoutMs:15,acquire:async c=>{await gate;return c;}});await rejected(f.store.append(input()),'not_started');release();await tick();assert.equal(f.calls.length,0);assert.deepEqual(f.releases,[true]);await f.store.close();
});
test('close cancels active work and bounds a stalled pool shutdown',async()=>{
  const f=await fixture({acquire:()=>new Promise(()=>{}),end:()=>new Promise(()=>{})}),pending=f.store.append(input()).catch(e=>e);await f.store.close();assert.equal((await pending).outcome,'not_started');await rejected(f.store.lookup(event()),'not_started');assert.equal(f.ends,1);
});
