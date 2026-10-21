import test from 'node:test';
import assert from 'node:assert/strict';
import {accountContractSQL,ACCOUNT_CONTRACT_SQL,verifyAccountContract} from './account-contract.mjs';
import {managedAccountEnvironment} from './account-managed.mjs';
import {managedAccountInstallSql} from './account-managed-install.mjs';
import {accountContractFixture} from './account-contract.fixture.mjs';
import {createAccountHistoryStore,createAccountAckStore} from './account-store.mjs';
import {rootCertificates} from 'node:tls';
import {EventEmitter} from 'node:events';
import {createHash} from 'node:crypto';
import manifest from './account-contract-data.mjs';
const value=d=>({...accountContractFixture(d),managed:managedAccountEnvironment()});
test('managed profile is explicit and strict SQL/contracts remain the default',async()=>{
 assert.equal(accountContractSQL(),ACCOUNT_CONTRACT_SQL);assert.notEqual(accountContractSQL('supabase-managed'),ACCOUNT_CONTRACT_SQL);
 for(const profile of [null,true,'managed','SUPABASE-MANAGED',{}]){assert.throws(()=>accountContractSQL(profile));await assert.rejects(createAccountHistoryStore({deploymentProfile:profile}));}
 for(const domain of ['history','ack']){assert.equal(verifyAccountContract(value(domain),domain,'supabase-managed'),true);assert.throws(()=>verifyAccountContract(value(domain),domain));assert.throws(()=>verifyAccountContract(accountContractFixture(domain),domain,'supabase-managed'));}
});
test('exact four provider creator edges required; missing, extra, outgoing and changed grantor/options refuse',()=>{
 for(const change of [v=>v.memberships.pop(),v=>v.memberships.push(v.memberships[0]),v=>v.memberships[0][0]='unreviewed',v=>v.memberships[0][1]='anon',v=>v.memberships[0][2]='postgres',v=>v.memberships[0][3]=false,v=>v.memberships[0][4]=true,v=>v.memberships[0][5]=true,v=>v.memberships.reverse()]){const c=value('history');change(c.managed);assert.throws(()=>verifyAccountContract(c,'history','supabase-managed'));}
});
test('managed schemas must have fixed owners and account roles cannot access them or coexist with public application objects',()=>{
 for(const key of ['bootstrap','schemas','private','publicEmpty']){const c=value('ack');c.managed[key]=false;assert.throws(()=>verifyAccountContract(c,'ack','supabase-managed'));}
 const c=value('ack');c.managed.extra=true;assert.throws(()=>verifyAccountContract(c,'ack','supabase-managed'));
 const copy=managedAccountEnvironment();copy.memberships[0][5]=true;assert.equal(verifyAccountContract(value('ack'),'ack','supabase-managed'),true);
});
test('managed profile preserves all source/table/role/ACL checks',()=>{
 for(const change of [v=>v.roles[0][1]=false,v=>v.tables[0].force=false,v=>v.functions[0].sha256='f'.repeat(64),v=>v.schemaAcl.push(['anon','alliance_account_owner','USAGE',false])]){const c=value('history');change(c);assert.throws(()=>verifyAccountContract(c,'history','supabase-managed'));}
});
test('offline installer keeps canonical function bodies, one transaction and exact temporary-grant teardown',()=>{
 for(const domain of ['history','ack']){const sql=managedAccountInstallSql(domain);assert.match(sql,/BEGIN;[\s\S]+COMMIT;\s*$/);assert.match(sql,/REVOKE alliance_account_owner FROM postgres GRANTED BY postgres/);assert.ok(!sql.includes("or to_regnamespace('auth') is not null"));assert.ok(sql.includes("to_regnamespace('alliance_avatar') is not null"));assert.ok(!/\blogin\s+password/i.test(sql));assert.equal((sql.match(/grant alliance_account_owner to postgres with inherit false, set true;/g)||[]).length,1);
  const bodies=[...sql.matchAll(/create function alliance_account\.(\w+)\([^)]*\)[^$]+as \$\$([\s\S]*?)\$\$;/g)].map(([,name,body])=>({name,sha256:createHash('sha256').update(body).digest('hex')})).sort((a,b)=>a.name.localeCompare(b.name));assert.deepEqual(bodies,manifest[domain].map(({name,sha256})=>({name,sha256})));
 }
 for(const domain of [null,'member',{}])assert.throws(()=>managedAccountInstallSql(domain));
});
test('managed runtime refuses pre-dispatch drift and post-COMMIT drift without dispatch retry',async()=>{
 for(const driftAt of [1,2])for(const writer of [false,true]){
  const calls=[],releases=[];let scans=0;
  const client=Object.assign(new EventEmitter(),{release(v){releases.push(v);},async query(q){calls.push(q.text);if(q.text.startsWith('select current_database'))return {rows:[{database:'postgres',actor:writer?'alliance_account_writer':'alliance_account_reader',login:writer?'alliance_account_writer':'alliance_account_reader',tls:true,restricted:true,isolated:true,limited:true,durable:true,dedicated:true}]};if(q.text===accountContractSQL('supabase-managed')){const c=value('ack');if(++scans===driftAt)c.managed.memberships[0][5]=true;return {rows:[{contract:c}]};}if(q.text.startsWith('SELECT alliance_account.'))return {rows:[{result:writer?{state:'acknowledged',point:{sequence:0,sha256:'0'.repeat(64)}}:{sequence:0,sha256:'0'.repeat(64)}}]};return {command:q.text==='COMMIT'?'COMMIT':'SET'};}});
  const store=await createAccountAckStore({enabled:true,writeEnabled:writer,deploymentProfile:'supabase-managed',memberProjectRef:'abcdefghijklmnopqrst',journalProjectRef:'uvwxyzabcdefghijklmn',controlProjectRef:'opqrstuvwxyzabcdefgh',epoch:'11111111-1111-4111-8111-111111111111',connection:{host:'db.opqrstuvwxyzabcdefgh.supabase.co',password:'synthetic-managed-unit-password-only',ca:rootCertificates[0]},openPool:()=>({on(){},connect:async()=>client,end(){}})});
  try{await assert.rejects(writer?store.advance({records:[],head:{sequence:0,sha256:'0'.repeat(64)},expected:{sequence:0,sha256:'0'.repeat(64)}}):store.read(),e=>e.outcome===(writer&&driftAt===2?'unknown':'not_started'));assert.equal(calls.filter(q=>q.startsWith('SELECT alliance_account.')).length,driftAt===1?0:1);assert.equal(calls.filter(q=>q==='COMMIT').length,driftAt===1?0:1);assert.deepEqual(releases,[true]);}finally{await store.close();}
 }
});
