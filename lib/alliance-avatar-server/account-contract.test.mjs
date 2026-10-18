import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {EventEmitter} from 'node:events';
import {rootCertificates} from 'node:tls';
import manifest from './account-contract-data.mjs';
import {ACCOUNT_CONTRACT_SQL,verifyAccountContract} from './account-contract.mjs';
import {accountContractFixture} from './account-contract.fixture.mjs';
import {createAccountHistoryStore,createAccountAckStore} from './account-store.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),clone=v=>structuredClone(v),zero={sequence:0,sha256:'0'.repeat(64)},scope={memberProjectRef:'abcdefghijklmnopqrst',journalProjectRef:'uvwxyzabcdefghijklmn',epoch:'11111111-1111-4111-8111-111111111111'},controlProjectRef='opqrstuvwxyzabcdefgh';
test('fixed function manifests correspond exactly to all reviewed SQL bodies with only CRLF normalization',()=>{
 const common=readFileSync(new URL('../../sql/alliance-account-protocol-candidate.sql',import.meta.url),'utf8');
 for(const domain of ['history','ack']){const source=(common+readFileSync(new URL(`../../sql/alliance-account-${domain}-store-candidate.sql`,import.meta.url),'utf8')).replace(/\r\n/g,'\n');
  const re=/create function alliance_account\.(\w+)\(([^)]*)\) returns (\w+) language (\w+)(?: (immutable|stable|volatile))? security (definer|invoker) set search_path='' as \$\$([\s\S]*?)\$\$;/g;
  const found=[...source.matchAll(re)].map(([,name,args,returns,language,volatility,security,body])=>{const parts=args.split(',').map(x=>x.trim().split(/\s+/));return {name,args:parts.map(x=>x[1]).join(', '),names:parts.map(x=>x[0]),returns,language,definer:security==='definer',volatility:({immutable:'i',stable:'s',volatile:'v'})[volatility]??'v',sha256:sha(body)};}).sort((a,b)=>a.name.localeCompare(b.name)||a.args.localeCompare(b.args));
  assert.equal(found.length,8);assert.deepEqual(found,manifest[domain]);
 }
});
test('exact history and acknowledgement catalogue contracts accept only reviewed PostgreSQL versions',()=>{
 for(const d of ['history','ack'])for(const version of [17,18])assert.equal(verifyAccountContract({...accountContractFixture(d),version},d),true);
 for(const version of [16,19,undefined,'17'])assert.throws(()=>verifyAccountContract({...accountContractFixture('history'),version},'history'));
 for(const path of ['public, pg_catalog','"$user", public','',undefined])assert.throws(()=>verifyAccountContract({...accountContractFixture('history'),path},'history'));
});
test('changed main or helper source digest, argument names/signature or return type refuses',()=>{
 for(const domain of ['history','ack'])for(const name of [domain==='history'?'append':'ack_advance','check_chain','scope_ok'])for(const patch of [{sha256:'f'.repeat(64)},{args:'text'},{names:['unreviewed']},{returns:'text'}]){const value=accountContractFixture(domain);Object.assign(value.functions.find(f=>f.name===name),patch);assert.throws(()=>verifyAccountContract(value,domain));}
});
test('missing, duplicate, extra or reordered functions and unknown fields refuse',()=>{
 for(const mutate of [v=>v.functions.pop(),v=>v.functions.push(clone(v.functions[0])),v=>v.functions.reverse(),v=>v.functions[0].extra=true,v=>v.extra=true]){const value=accountContractFixture('history');mutate(value);assert.throws(()=>verifyAccountContract(value,'history'));}
});
test('owner, definer/invoker, volatility, language, search path and function execution settings are pinned',()=>{
 for(const patch of [{owner:'postgres'},{definer:false},{volatility:'i'},{language:'sql'},{config:['search_path=public']},{kind:'p'},{parallel:'s'},{strict:true},{leakproof:true},{set:true},{plain:false}]){const value=accountContractFixture('history');Object.assign(value.functions.find(f=>f.name==='append'),patch);assert.throws(()=>verifyAccountContract(value,'history'));}
});
test('PUBLIC, wrong grantor, grant option, operator helper access and reader write access refuse',()=>{
 for(const row of [['PUBLIC','alliance_account_owner',false],['alliance_account_reader','postgres',false],['alliance_account_reader','alliance_account_owner',true],['alliance_account_operator','alliance_account_owner',false],['alliance_account_reader','alliance_account_owner',false]]){const value=accountContractFixture('history');value.functions.find(f=>f.name==='append').acl.push(row);assert.throws(()=>verifyAccountContract(value,'history'));}
 const v=accountContractFixture('ack');v.functions.find(f=>f.name==='check_chain').acl.push(['alliance_account_writer','alliance_account_owner',false]);assert.throws(()=>verifyAccountContract(v,'ack'));
});
test('schema ownership/ACL and all four role isolation/privilege results must match',()=>{
 for(const mutate of [v=>v.schemaOwner='postgres',v=>v.schemaAcl.push(['PUBLIC','alliance_account_owner','USAGE',false]),v=>v.schemaAcl.push(['alliance_account_reader','alliance_account_owner','CREATE',false]),v=>v.roles[1][1]=false,v=>v.roles.pop(),v=>v.roles.push(['extra',true])]){const value=accountContractFixture('history');mutate(value);assert.throws(()=>verifyAccountContract(value,'history'));}
});
test('table ownership/kind, RLS, direct/column rights and user triggers refuse unexpected state',()=>{
 for(const patch of [{owner:'postgres'},{kind:'v'},{rls:false},{force:false},{private:false},{triggers:false}]){const value=accountContractFixture('history');Object.assign(value.tables[0],patch);assert.throws(()=>verifyAccountContract(value,'history'));}
 const v=accountContractFixture('ack');v.tables.push({...v.tables[0],name:'unreviewed'});assert.throws(()=>verifyAccountContract(v,'ack'));
});
test('caller mutation of exported source manifest cannot alter verifier private expected state',()=>{
 assert.equal(Object.isFrozen(manifest),true);assert.equal(Object.isFrozen(manifest.history[0].names),true);assert.throws(()=>{manifest.history[0].sha256='f'.repeat(64);});assert.equal(verifyAccountContract(accountContractFixture('history'),'history'),true);const copy=structuredClone(manifest);copy.history[0].sha256='f'.repeat(64);assert.notEqual(copy.history[0].sha256,manifest.history[0].sha256);
});
async function adapter({domain='history',writer=false,contract,post,postRead,run}={}){
 const calls=[],releases=[],actor=writer?'alliance_account_writer':'alliance_account_reader';let scans=0;
 const client=Object.assign(new EventEmitter(),{async query(q){calls.push(q.text);if(q.text.startsWith('select current_database'))return {rows:[{database:'postgres',actor,login:actor,tls:true,restricted:true,isolated:true,limited:true,durable:true,dedicated:true}]};if(q.text===ACCOUNT_CONTRACT_SQL){scans++;if(scans>1&&postRead)return postRead();return {rows:[{contract:clone(scans===1?(contract===undefined?accountContractFixture(domain):contract):(post===undefined?accountContractFixture(domain):post))}]};}if(run)return run(q);if(q.text.startsWith('SELECT alliance_account.'))return {rows:[{result:domain==='ack'?zero:{scope,enabled:true,admissionsOpen:true,head:zero,records:[]}}]};return {command:q.text==='COMMIT'?'COMMIT':'SET'};},release(value){releases.push(value);}});
 const factory=domain==='history'?createAccountHistoryStore:createAccountAckStore,store=await factory({enabled:true,writeEnabled:writer,...scope,controlProjectRef,connection:{host:`db.${domain==='history'?scope.journalProjectRef:controlProjectRef}.supabase.co`,password:'synthetic-unit-account-contract-only',ca:rootCertificates[0]},openPool:()=>({on(){},connect:async()=>client,end(){}}),timeoutMs:100});
 return {store,calls,releases};
}
test('pre-dispatch contract drift refuses readers and writers before any private function or COMMIT',async()=>{
 for(const writer of [false,true]){const contract=accountContractFixture('ack');contract.functions[0].sha256='f'.repeat(64);const f=await adapter({domain:'ack',writer,contract});try{await assert.rejects(writer?f.store.advance({records:[],head:zero,expected:zero}):f.store.read(),e=>e.message==='alliance_account_store_unavailable'&&e.outcome==='not_started'&&!e.cause);assert.ok(!f.calls.some(x=>x.startsWith('SELECT alliance_account.')));assert.ok(!f.calls.includes('COMMIT'));}finally{await f.store.close();}}
});
test('fresh post-COMMIT drift withholds read evidence and marks dispatched write outcomes unknown',async()=>{
 for(const writer of [false,true]){const post=accountContractFixture('ack');post.functions[0].volatility='i';const f=await adapter({domain:'ack',writer,post,run:async q=>q.text.startsWith('SELECT alliance_account.')?{rows:[{result:writer?{state:'acknowledged',point:zero}:zero}]}:{command:q.text==='COMMIT'?'COMMIT':'SET'}});try{await assert.rejects(writer?f.store.advance({records:[],head:zero,expected:zero}):f.store.read(),e=>e.outcome===(writer?'unknown':'not_started'));assert.equal(f.calls.filter(x=>x==='COMMIT').length,1);assert.equal(f.calls.at(-1),ACCOUNT_CONTRACT_SQL);}finally{await f.store.close();}}
});
test('successful adapters verify once inside their transaction and once in fresh autocommit',async()=>{
 for(const domain of ['history','ack']){const f=await adapter({domain});try{await (domain==='history'?f.store.snapshot():f.store.read());const indexes=f.calls.map((q,i)=>q===ACCOUNT_CONTRACT_SQL?i:-1).filter(i=>i>=0),commit=f.calls.indexOf('COMMIT');assert.equal(indexes.length,2);assert.ok(indexes[0]<commit&&indexes[1]>commit);}finally{await f.store.close();}}
});
test('bad or oversized catalogue envelopes never expose source details or dispatch a function',async()=>{
 for(const contract of [null,{}, {...accountContractFixture('history'),extra:'PRIVATE'.repeat(6000)}]){const f=await adapter({contract});try{await assert.rejects(f.store.snapshot(),e=>e.message==='alliance_account_store_unavailable'&&!e.cause);assert.ok(!f.calls.some(x=>x.startsWith('SELECT alliance_account.')));}finally{await f.store.close();}}
});
test('a post-COMMIT timeout destroys the still-busy client and a late catalogue reply cannot return evidence',async()=>{
 let entered,resume;const ready=new Promise(r=>entered=r),f=await adapter({domain:'ack',writer:true,run:async q=>q.text.startsWith('SELECT alliance_account.')?{rows:[{result:{state:'acknowledged',point:zero}}]}:{command:q.text==='COMMIT'?'COMMIT':'SET'},postRead:()=>{entered();return new Promise(r=>resume=r);}});
 try{const pending=f.store.advance({records:[],head:zero,expected:zero});await ready;await assert.rejects(pending,e=>e.outcome==='unknown');assert.deepEqual(f.releases,[true]);resume({rows:[{contract:accountContractFixture('ack')}]});await new Promise(r=>setImmediate(r));assert.deepEqual(f.releases,[true]);assert.equal(f.calls.filter(x=>x==='COMMIT').length,1);}finally{await f.store.close();}
});
