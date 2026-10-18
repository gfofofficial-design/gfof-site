// Imported only by the confirmed disposable TLS driver. Two fresh, independent
// local clusters; no hosted target, real account, key or provider operation.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {secondCreationFixture} from './creation-second-fixture.mjs';
import {createAccountHistoryStore,createAccountAckStore} from './account-store.mjs';
import {createAccountAcknowledgement} from './account-acknowledgement.mjs';
import {accountSubject,accountEvent,accountRecord,reviewAccountHistory} from './account-history.mjs';
import {accountRecoveryNative} from './account-recovery.native.mjs';
import {accountWitnessNative} from './account-witness.native.mjs';
import {accountResolutionNative} from './account-resolution.native.mjs';
import {accountContractNative} from './account-contract.native.mjs';
export async function accountStoreNative({secondOptions}){
 if(process.env.ALLIANCE_AVATAR_SERVER_TEST_CONFIRM!=='disposable_server_fixture')throw Error('Wrong account fixture');
 const domains=[],stores=[];let h,a;
 const scope={memberProjectRef:'abcdefghijklmnopqrst',journalProjectRef:'uvwxyzabcdefghijklmn',epoch:randomUUID()},controlProjectRef='opqrstuvwxyzabcdefgh',zero={sequence:0,sha256:'0'.repeat(64)};
 const subject=n=>accountSubject({memberProjectRef:scope.memberProjectRef,epoch:scope.epoch,authUserId:`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`});
 const event=(kind,n=1)=>accountEvent({kind,subject:subject(n)}),scopeJSON=JSON.stringify(scope),password='synthetic-account-'+randomUUID();
 const direct=async(domain,name,args,rollback=false)=>{const pool=['append','ack_advance'].includes(name)?domain.writer:domain.operator,client=await pool.connect();try{await client.query('BEGIN');const p=args.map((_,i)=>`$${i+1}`).join(',');const r=await client.query(`select alliance_account.${name}(${p}) as result`,args);await client.query(rollback?'ROLLBACK':'COMMIT');return r.rows[0].result;}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}};
 async function install(purpose,file){
  const d=await secondCreationFixture({...secondOptions,purpose});domains.push(d);
  const common=readFileSync(new URL('../../sql/alliance-account-protocol-candidate.sql',import.meta.url),'utf8'),specific=readFileSync(new URL('../../sql/'+file,import.meta.url),'utf8');
  d.admin('create role anon nologin;create role authenticated nologin;create role service_role nologin;begin;'+common+specific+'commit;');
  assert.match(d.admin("select count(*) from pg_roles where rolname like 'alliance_account_%' and not rolcanlogin and not rolsuper and not rolbypassrls and not rolinherit;"),/\n\s*4\s*\n/);
  assert.match(d.admin("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='alliance_account' and c.relkind='r' and (not c.relrowsecurity or not c.relforcerowsecurity);"),/\n\s*0\s*\n/);
  d.admin(`alter role alliance_account_reader login password '${password}';alter role alliance_account_writer login password '${password}';alter role alliance_account_operator login password '${password}';`);
  const config={host:d.connection.host,port:5432,database:'postgres',user:'alliance_account_operator',password,ssl:{ca:d.connection.ca,rejectUnauthorized:true,servername:d.connection.host}};d.operator=d.openPool(config);d.writer=d.openPool({...config,user:'alliance_account_writer'});
  return d;
 }
 const open=async(domain,ack=false,{loss=false,write=true,afterCommit}={})=>{
  const factory=ack?createAccountAckStore:createAccountHistoryStore;let dropped=false,changed=false;
  const store=await factory({enabled:true,writeEnabled:write,...scope,controlProjectRef,connection:{...domain.connection,password},openPool:config=>{
   const pool=domain.openPool(config);if(!loss&&!afterCommit)return pool;
   return {on:pool.on.bind(pool),end:pool.end.bind(pool),async connect(){const c=await pool.connect();let mutating=false;return {once:c.once.bind(c),removeListener:c.removeListener.bind(c),release:c.release.bind(c),async query(q){if(q.text.startsWith('SELECT alliance_account.append(')||q.text.startsWith('SELECT alliance_account.ack_advance('))mutating=true;const r=await c.query(q);if(q.text==='COMMIT'&&mutating){if(afterCommit&&!changed){changed=true;afterCommit();}if(loss&&!dropped){dropped=true;throw Error('synthetic_lost_commit_reply');}}return r;}};}};
  }});stores.push(store);return store;
 };
 try{
  h=await install('journal','alliance-account-history-store-candidate.sql');a=await install('control','alliance-account-ack-store-candidate.sql');
  assert.notEqual(h.admin('select system_identifier from pg_control_system();'),a.admin('select system_identifier from pg_control_system();'));
  const history=await open(h),ack=await open(a,true),reader=await open(h,false,{write:false});
  await assert.rejects(history.snapshot());await assert.rejects(ack.read());
  await direct(h,'history_bootstrap',[scopeJSON]);await direct(a,'ack_bootstrap',[scopeJSON]);
  await assert.rejects(direct(h,'history_bootstrap',[scopeJSON]));assert.equal((await history.snapshot()).enabled,false);assert.deepEqual(await ack.read(),zero);
  assert.equal((await history.append({event:event('account_admitted'),expected:zero})).state,'paused');
  console.log('PASS account history/ack install on distinct fresh clusters with four locked roles per domain, forced RLS, unconfigured default-off controls and explicit closed bootstrap');
  for(const [d,file] of [[h,'alliance-account-ack-store-candidate.sql'],[a,'alliance-account-history-store-candidate.sql']])assert.throws(()=>d.admin('begin;'+readFileSync(new URL('../../sql/'+file,import.meta.url),'utf8')+'rollback;'));
  await direct(h,'history_mode',[scopeJSON,true,true]);await direct(a,'ack_mode',[scopeJSON,true]);
  const first=await history.append({event:event('account_admitted'),expected:zero});assert.equal(first.record.sha256,accountRecord({scope,sequence:1,previous:zero.sha256,event:event('account_admitted')}).sha256);
  assert.deepEqual((await reader.snapshot()).records,[first.record]);await assert.rejects(reader.append({event:event('account_admitted',2),expected:first.head}),e=>e.outcome==='not_started');
  const restricted=h.openPool({host:h.connection.host,database:'postgres',user:'alliance_account_reader',password,ssl:{ca:h.connection.ca,rejectUnauthorized:true,servername:h.connection.host}});
  await assert.rejects(restricted.query('select * from alliance_account.entries'),e=>e.code==='42501');await assert.rejects(restricted.query('select alliance_account.history_mode($1,true,true)',[scopeJSON]),e=>e.code==='42501');
  console.log('PASS SQL hashes match account protocol; private reader sees only complete scoped snapshot, cannot read tables or change mode, and mixed-domain installation refuses');
  h.admin('grant select(sequence) on alliance_account.entries to alliance_account_reader;');await assert.rejects(reader.snapshot());h.admin('revoke select(sequence) on alliance_account.entries from alliance_account_reader;');assert.equal((await reader.snapshot()).head.sequence,1);
  const before=await history.snapshot(),losing=await open(h,false,{loss:true});await assert.rejects(losing.append({event:event('account_remove_requested'),expected:before.head}),e=>e.outcome==='unknown');
  const after=await history.snapshot();assert.equal(after.head.sequence,2);assert.equal(after.records[1].event.id,event('account_remove_requested').id);
  const bridge=createAccountAcknowledgement({enabled:true,scope,minimum:zero,history,acknowledgements:ack});
  assert.equal((await bridge.review()).check(subject(1)).state,'removal_pending');const proof=await bridge.acknowledge();assert.equal(proof.check(subject(1)).state,'removal_acknowledged');assert.equal(proof.check(subject(1)).erasure,'not_established');bridge.close();
  assert.equal((await history.append({event:event('account_admitted'),expected:zero})).state,'removed');
  assert.equal((await history.append({event:event('account_remove_requested'),expected:zero})).head.sequence,2);
  console.log('PASS actual committed removal with lost caller reply remains unknown; fresh read reconciles without append retry, then separate durable ack readback distinguishes pending/acknowledged and never erasure');
  const lossyAck=await open(a,true,{loss:true}),next=await history.append({event:event('account_admitted',2),expected:after.head});
  const b=createAccountAcknowledgement({enabled:true,scope,minimum:after.head,history,acknowledgements:lossyAck});assert.equal((await b.acknowledge()).state,'unknown');assert.equal((await b.review()).check(subject(2)).state,'admission_acknowledged');assert.equal((await b.acknowledge()).state,'unavailable');b.close();
  const checkpoint=await ack.read();assert.equal(checkpoint.sequence,3);
  await assert.rejects(ack.advance({records:[first.record],head:first.head,expected:checkpoint}),e=>e.outcome==='not_started');
  await assert.rejects(direct(a,'ack_advance',[scopeJSON,checkpoint.sequence,checkpoint.sha256,JSON.stringify([first.record])]),e=>e.code==='42501'&&e.message==='account_history_invalid');assert.deepEqual(await ack.read(),checkpoint);
  console.log('PASS lost ack COMMIT is independently readable without a second mutation; JavaScript and SQL both refuse history below the persisted floor');
  await accountRecoveryNative({historyDomain:h,ackDomain:a,scope,secondOptions});
  for(const d of domains)d.admin(`alter role alliance_account_reader login password '${password}';alter role alliance_account_writer login password '${password}';alter role alliance_account_operator login password '${password}';`);
  await direct(h,'history_mode',[scopeJSON,true,true]);await direct(a,'ack_mode',[scopeJSON,true]);
  await accountWitnessNative({history,ack,historyAdmin:h.admin,ackAdmin:a.admin,scope});
  await accountResolutionNative({history,ack,historyAdmin:h.admin,ackAdmin:a.admin,scope,lossyHistory:await open(h,false,{loss:true}),lossyAck:await open(a,true,{loss:true})});
  await accountContractNative({history,ack,historyAdmin:h.admin,ackAdmin:a.admin,scope,openAfterCommit:afterCommit=>open(h,false,{afterCommit})});
  // Snapshot rollback probe changes only this exact disposable history; the
  // independently committed ack remains current. No source backup is trusted.
  h.admin(`begin;set local role alliance_account_owner;truncate alliance_account.entries;insert into alliance_account.entries values(1,'${first.record.event.id}','${JSON.stringify(first.record)}'::jsonb);update alliance_account.history_control set sequence=1,sha256='${first.head.sha256}';commit;`);
  const restored=createAccountAcknowledgement({enabled:true,scope,minimum:checkpoint,history,acknowledgements:ack});assert.equal((await restored.review()).state,'unavailable');assert.equal((await restored.acknowledge()).state,'unavailable');restored.close();assert.deepEqual(await ack.read(),checkpoint);
  console.log('PASS actual old history rows restored in one domain cannot lower separate acknowledged floor or obtain a verified review; account access remains unimplemented/closed');
  // Clear only the owned fixture to exercise the full reservation bound.
  h.admin("begin;set local role alliance_account_owner;truncate alliance_account.entries;update alliance_account.history_control set sequence=0,sha256=repeat('0',64);commit;");
  for(let n=1;n<=127;n++)await direct(h,'append',[scopeJSON,n-1,(await history.snapshot()).head.sha256,JSON.stringify(event('account_admitted',n))]);
  const last=await history.snapshot(),other=await open(h);
  const race=await Promise.all([history.append({event:event('account_admitted',128),expected:last.head}),other.append({event:event('account_admitted',129),expected:last.head})]);
  assert.deepEqual(race.map(x=>x.state).sort(),['conflict','recorded']);let full=await history.snapshot();assert.equal(full.records.length,128);
  assert.equal((await history.append({event:event('account_admitted',130),expected:full.head})).state,'full');
  await direct(h,'history_mode',[scopeJSON,true,false]);
  for(const row of full.records){const tip=(await history.snapshot()).head;await history.append({event:accountEvent({kind:'account_remove_requested',subject:row.event.subject}),expected:tip});}
  full=await history.snapshot();assert.equal(full.head.sequence,256);const e=reviewAccountHistory({scope,records:full.records,head:full.head,acknowledged:zero,minimum:zero});assert.equal(e.capacity.reservedRemovals,0);
  console.log('PASS real competing final-slot admissions commit exactly one record; full admission budget still permits all128 reserved removals after admission closure, with no capacity refund');
  await direct(h,'history_mode',[scopeJSON,false,false]);assert.equal((await history.append({event:event('account_remove_requested'),expected:full.head})).state,'paused');
  await direct(a,'ack_mode',[scopeJSON,false]);assert.equal((await ack.advance({records:next.record?[first.record,after.records[1],next.record]:[],head:checkpoint,expected:checkpoint})).state,'paused');
  console.log('PASS master switches pause writes while scoped reads remain available for reconciliation; no hosted/Auth/provider/public feature is enabled');
 }finally{
  for(const s of stores)await s.close();
  for(const d of domains){try{d.admin("alter role alliance_account_reader nologin password null;alter role alliance_account_writer nologin password null;alter role alliance_account_operator nologin password null;");}finally{await d.close();}}
 }
 console.log('PASS exact two disposable account clusters, synthetic credentials, role/data directories and pools removed; no managed recovery or independent real custody claim');
}
