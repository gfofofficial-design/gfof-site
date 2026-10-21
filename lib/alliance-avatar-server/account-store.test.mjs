import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {rootCertificates} from 'node:tls';
import {accountSubject,accountEvent,accountRecord} from './account-history.mjs';
import {createAccountHistoryStore,createAccountAckStore} from './account-store.mjs';
import {createAccountAcknowledgement} from './account-acknowledgement.mjs';
import {ACCOUNT_CONTRACT_SQL} from './account-contract.mjs';
import {accountContractFixture} from './account-contract.fixture.mjs';
const scope={memberProjectRef:'abcdefghijklmnopqrst',journalProjectRef:'uvwxyzabcdefghijklmn',epoch:'11111111-1111-4111-8111-111111111111'},controlProjectRef='opqrstuvwxyzabcdefgh';
const zero={sequence:0,sha256:'0'.repeat(64)},subject=accountSubject({memberProjectRef:scope.memberProjectRef,epoch:scope.epoch,authUserId:'22222222-2222-4222-8222-222222222222'});
const event=kind=>accountEvent({kind,subject}),one=accountRecord({scope,sequence:1,previous:zero.sha256,event:event('account_admitted')}),two=accountRecord({scope,sequence:2,previous:one.sha256,event:event('account_remove_requested')});
const tip=r=>({sequence:r.sequence,sha256:r.sha256}),snap=(rows=[one])=>({scope:{...scope},enabled:true,admissionsOpen:true,head:rows.length?tip(rows.at(-1)):zero,records:rows});
const connection=domain=>({host:`db.${domain==='history'?scope.journalProjectRef:controlProjectRef}.supabase.co`,password:'synthetic-account-unit-password-only',ca:rootCertificates[0]});
const failure=(promise,outcome)=>assert.rejects(promise,e=>e.message==='alliance_account_store_unavailable'&&e.outcome===outcome&&!e.cause);
async function fixture({domain='history',writeEnabled=false,enabled=true,result=snap(),who,run,acquire,...extra}={}){
 const calls=[],releases=[];let config,opens=0;
 const identity=()=>({database:'postgres',actor:writeEnabled?'alliance_account_writer':'alliance_account_reader',login:writeEnabled?'alliance_account_writer':'alliance_account_reader',tls:true,restricted:true,isolated:true,limited:true,durable:true,dedicated:true,...who});
 const client=Object.assign(new EventEmitter(),{async query(q){calls.push(q);if(q.text===ACCOUNT_CONTRACT_SQL)return {rows:[{contract:accountContractFixture(domain)}]};if(run)return run(q,identity());if(q.text.startsWith('select current_database'))return {rows:[identity()]};if(q.text.startsWith('SELECT alliance_account.'))return {rows:[{result}]};return {command:q.text==='COMMIT'?'COMMIT':'SET'};},release(v){releases.push(v);}});
 const factory=domain==='history'?createAccountHistoryStore:createAccountAckStore;
 const store=await factory({enabled,writeEnabled,...scope,controlProjectRef,connection:connection(domain),timeoutMs:100,openPool:c=>{config=c;return {on(){},connect(){opens++;return acquire?acquire(client):client;},end(){}};},...extra});
 return {store,calls,releases,client,get config(){return config;},get opens(){return opens;}};
}
test('account stores default closed, choose exact separate hosts and finite verified TLS pools',async()=>{
 const closed=await createAccountHistoryStore();await failure(closed.snapshot(),'not_started');await closed.close();
 for(const enabled of [false,'true',1]){const f=await fixture({enabled});await failure(f.store.snapshot(),'not_started');assert.equal(f.config,undefined);await f.store.close();}
 for(const domain of ['history','ack']){const f=await fixture({domain,result:domain==='history'?snap():zero});assert.equal(f.config.host,connection(domain).host);assert.equal(f.config.user,'alliance_account_reader');assert.equal(f.config.ssl.rejectUnauthorized,true);assert.equal(f.config.max,2);assert.equal(f.config.enableChannelBinding,true);assert.equal(f.config.options,'-c search_path=pg_catalog');await f.store.close();}
});
test('foreign domains, scope collision, connection extras and invalid certificate refuse before driver access',async()=>{
 for(const extra of [{controlProjectRef:scope.memberProjectRef},{connection:{...connection('history'),host:connection('ack').host}},{connection:{...connection('history'),ca:'bad'}},{connection:{...connection('history'),ssl:{rejectUnauthorized:false}}},{writeEnabled:'true'},{timeoutMs:4501}])await failure(fixture(extra),'not_started');
});
test('read-only stores validate exact full chain and COMMIT before returning evidence',async()=>{
 const f=await fixture();assert.deepEqual(await f.store.snapshot(),snap());assert.equal(f.calls[0].text,'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');assert.equal(f.calls.at(-2).text,'COMMIT');assert.equal(f.calls.at(-1).text,ACCOUNT_CONTRACT_SQL);assert.deepEqual(f.releases,[false]);await f.store.close();
 for(const result of [{...snap(),records:[]},{...snap(),extra:'PRIVATE'},snap([{...one,sha256:'f'.repeat(64)}])]){const g=await fixture({result});await failure(g.store.snapshot(),'not_started');assert.ok(!g.calls.some(q=>q.text==='COMMIT'));await g.store.close();}
});
test('reader cannot mutate and role, rights, durability or domain drift refuses before function dispatch',async()=>{
 const r=await fixture();await failure(r.store.append({event:event('account_admitted'),expected:zero}),'not_started');assert.equal(r.opens,0);await r.store.close();
 for(const who of [{actor:'postgres'},{login:'postgres'},...['tls','restricted','isolated','limited','durable','dedicated'].map(k=>({[k]:false}))]){const f=await fixture({who});await failure(f.store.snapshot(),'not_started');assert.equal(f.calls.length,3);await f.store.close();}
});
test('writer uses fixed parameterized append and independently validates the returned record',async()=>{
 const f=await fixture({writeEnabled:true,result:{state:'recorded',record:one,head:tip(one)}});
 assert.equal((await f.store.append({event:event('account_admitted'),expected:zero})).record.sha256,one.sha256);
 assert.deepEqual(f.calls[4],{text:'SELECT alliance_account.append($1::jsonb,$2::integer,$3::text,$4::jsonb) AS result',values:[JSON.stringify(scope),0,zero.sha256,JSON.stringify(event('account_admitted'))]});await f.store.close();
 const g=await fixture({writeEnabled:true,result:{state:'recorded',record:two,head:tip(two)}});await failure(g.store.append({event:event('account_admitted'),expected:zero}),'unknown');await g.store.close();
});
test('lost COMMIT and cancellation after dispatch remain unknown without retry or late COMMIT',async()=>{
 const f=await fixture({writeEnabled:true,run:async(q,who)=>{if(q.text.startsWith('select current_database'))return {rows:[who]};if(q.text.startsWith('SELECT alliance_account.'))return {rows:[{result:{state:'recorded',record:one,head:tip(one)}}]};if(q.text==='COMMIT')throw Error('private transport detail');return {command:'SET'};}});
 await failure(f.store.append({event:event('account_admitted'),expected:zero}),'unknown');assert.equal(f.calls.filter(q=>q.text==='COMMIT').length,1);await f.store.close();
 let resume;const c=new AbortController(),g=await fixture({writeEnabled:true,run:async(q,who)=>{if(q.text.startsWith('select current_database'))return {rows:[who]};if(q.text.startsWith('SELECT alliance_account.')){c.abort();return new Promise(r=>{resume=()=>r({rows:[{result:{state:'recorded',record:one,head:tip(one)}}]});});}return {command:'SET'};}});
 await failure(g.store.append({event:event('account_admitted'),expected:zero},{signal:c.signal}),'unknown');resume();await new Promise(r=>setImmediate(r));assert.ok(!g.calls.some(q=>q.text==='COMMIT'));await g.store.close();
});
test('SQL rejection is sanitized; ack adapter checks supplied prefix and exact acknowledged head',async()=>{
 const f=await fixture({writeEnabled:true,run:async(q,who)=>{if(q.text.startsWith('select current_database'))return {rows:[who]};if(q.text.startsWith('SELECT alliance_account.'))throw Object.assign(Error('PRIVATE'),{code:'42501'});return {command:'SET'};}});await failure(f.store.append({event:event('account_admitted'),expected:zero}),'rejected');await f.store.close();
 const g=await fixture({domain:'ack',writeEnabled:true,result:{state:'acknowledged',point:tip(two)}});
 assert.equal((await g.store.advance({records:[one,two],head:tip(two),expected:tip(one)})).state,'acknowledged');
 await failure(g.store.advance({records:[one],head:tip(one),expected:tip(two)}),'not_started');await g.store.close();
 const h=await fixture({domain:'ack',writeEnabled:true,result:{state:'acknowledged',point:zero}});await failure(h.store.advance({records:[one],head:tip(one),expected:zero}),'unknown');await h.store.close();
});
function bridge({rows=[one,two],floor=tip(one),minimum=zero,advance,read,snapshot,...options}={}){
 const calls=[];let current=floor;
 const value=createAccountAcknowledgement({enabled:true,scope,minimum,history:{snapshot:async o=>{calls.push('snapshot');return snapshot?snapshot(o,calls):snap(rows);}},acknowledgements:{read:async o=>{calls.push('read');return read?read(o,calls):current;},advance:async(v,o)=>{calls.push('advance');if(advance)return advance(v,o);current=v.head;return {state:'acknowledged',point:current};}},...options});
 return {value,calls};
}
test('bridge defaults closed and returns pending-removal evidence without mutation',async()=>{
 const a=createAccountAcknowledgement();assert.deepEqual(await a.acknowledge(),{state:'unavailable'});
 const b=bridge();assert.equal((await b.value.review()).check(subject).state,'removal_pending');assert.deepEqual(b.calls,['snapshot','read']);b.value.close();
});
test('bridge rereads both stores after COMMIT; acknowledged intent never claims erasure',async()=>{
 const b=bridge();const v=await b.value.acknowledge();assert.deepEqual(b.calls,['snapshot','read','advance','snapshot','read']);assert.deepEqual(v.check(subject),{state:'removal_acknowledged',authorization:'not_established',erasure:'not_established'});b.value.close();
});
test('a new removal arriving during acknowledgement remains pending rather than falsely acknowledged',async()=>{
 let n=0;const b=bridge({rows:[one],floor:zero,snapshot:()=>snap(++n===1?[one]:[one,two])});assert.equal((await b.value.acknowledge()).check(subject).state,'removal_pending');b.value.close();
});
test('rollback/fork or unavailable inputs latch closed without any advance',async()=>{
 for(const options of [{minimum:tip(two),floor:tip(one)},{floor:{sequence:1,sha256:'f'.repeat(64)}},{snapshot:()=>{throw Error('PRIVATE');}}]){const b=bridge(options);assert.equal((await b.value.acknowledge()).state,'unavailable');assert.equal((await b.value.review()).state,'unavailable');assert.ok(!b.calls.includes('advance'));b.value.close();}
});
test('lost acknowledgement reply remains unknown, allows read reconciliation but blocks another write',async()=>{
 const b=bridge({floor:tip(two),advance:()=>{throw Object.assign(Error('PRIVATE'),{outcome:'unknown'});}});
 assert.equal((await b.value.acknowledge()).state,'unknown');assert.equal((await b.value.review()).check(subject).state,'removal_acknowledged');assert.equal((await b.value.acknowledge()).state,'unavailable');assert.equal(b.calls.filter(x=>x==='advance').length,1);b.value.close();
});
test('pause/conflict makes no completion claim and cancellation produces no mutation',async()=>{
 for(const state of ['paused','conflict']){const b=bridge({advance:()=>({state,point:tip(one)})});assert.deepEqual(await b.value.acknowledge(),{state});b.value.close();}
 const b=bridge(),c=new AbortController();c.abort();assert.equal((await b.value.acknowledge({signal:c.signal})).state,'cancelled');assert.equal(b.calls.length,0);b.value.close();
});
