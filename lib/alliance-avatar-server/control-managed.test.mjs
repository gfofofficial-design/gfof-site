import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rootCertificates} from 'node:tls';
import {EventEmitter} from 'node:events';
import {controlDeploymentProfile,managedControlEnvironment,MANAGED_CONTROL_ISOLATION} from './control-managed.mjs';
import {managedControlInstallSql} from './control-managed-install.mjs';
import {createAllianceAnchorStore} from './control-store.mjs';
const scope={memberProjectRef:'abcdefghijklmnopqrst',journalProjectRef:'uvwxyzabcdefghijklmn',controlProjectRef:'opqrstuvwxyzabcdefgh',epoch:'11111111-1111-4111-8111-111111111111'};
const zero={sequence:0,sha256:'0'.repeat(64)},anchor={format:1,memberProjectRef:scope.memberProjectRef,journalProjectRef:scope.journalProjectRef,epoch:scope.epoch,...zero};
async function fixture({profile='supabase-managed',writer=false,driftAt=0,throwAt=0,enabled=true}={}){
 const calls=[],releases=[];let scans=0,opens=0;
 const role=writer?'alliance_control_anchor_writer':'alliance_control_reader';
 const client=Object.assign(new EventEmitter(),{release:v=>releases.push(v),async query(q){calls.push(q.text);
  if(q.text.startsWith('select current_database')){scans++;if(scans===throwAt)throw Error('PRIVATE');return {rows:[{database:'postgres',actor:role,login:role,tls:true,restricted:true,isolated:scans!==driftAt,limited:true,durable:true,dedicated:true}]};}
  if(q.text.startsWith('SELECT alliance_control.'))return {rows:[{result:writer?{state:'anchored',anchor}:anchor}]};
  return {command:q.text==='COMMIT'?'COMMIT':'SET'};
 }});
 const store=await createAllianceAnchorStore({enabled,writeEnabled:writer,deploymentProfile:profile,...scope,connection:{host:'db.opqrstuvwxyzabcdefgh.supabase.co',password:'synthetic-managed-control-fixture-only',ca:rootCertificates[0]},openPool:()=>({on(){},end(){},connect(){opens++;return client;}})});
 return {store,calls,releases,get scans(){return scans;},get opens(){return opens;}};
}
test('unknown managed profile is never silently enabled or treated as strict',async()=>{
 for(const profile of [null,true,'managed','SUPABASE-MANAGED',{}]){assert.throws(()=>controlDeploymentProfile(profile));await assert.rejects(fixture({profile,enabled:false}));}
});
test('managed profile remains disabled by default without a connection',async()=>{
 const f=await fixture({enabled:false});await assert.rejects(f.store.read());assert.equal(f.opens,0);await f.store.close();
});
test('managed path checks exact source environment before dispatch and after COMMIT',async()=>{
 const f=await fixture();assert.deepEqual(await f.store.read(),anchor);assert.equal(f.scans,2);assert.equal(f.calls[0],'BEGIN READ ONLY');assert.equal(f.calls.at(-2),'COMMIT');assert.ok(f.calls[2].includes(MANAGED_CONTROL_ISOLATION));assert.equal(f.calls[2],f.calls.at(-1));assert.deepEqual(f.releases,[false]);await f.store.close();
});
test('strict path keeps zero-membership predicate and its original query order',async()=>{
 const f=await fixture({profile:'strict'});await f.store.read();assert.equal(f.scans,1);assert.match(f.calls[2],/not exists\(select 1 from pg_catalog.pg_auth_members/);assert.ok(!f.calls[2].includes('supabase_admin'));assert.equal(f.calls.at(-1),'COMMIT');await f.store.close();
});
for(const writer of [false,true])for(const driftAt of [1,2])test(`managed ${writer?'write':'read'} refuses drift at catalogue scan ${driftAt}`,async()=>{
 const f=await fixture({writer,driftAt});try{
  await assert.rejects(writer?f.store.advance({expected:zero,through:zero,records:[]}):f.store.read(),e=>e.message==='alliance_control_unavailable'&&(!writer||e.outcome===(driftAt===1?'not_started':'unknown')));
  assert.equal(f.calls.filter(x=>x.startsWith('SELECT alliance_control.')).length,driftAt===1?0:1);assert.equal(f.calls.filter(x=>x==='COMMIT').length,driftAt===1?0:1);assert.deepEqual(f.releases,[true]);
 }finally{await f.store.close();}
});
test('failed post-COMMIT metadata query withholds write evidence and never retries',async()=>{
 const f=await fixture({writer:true,throwAt:2});await assert.rejects(f.store.advance({expected:zero,through:zero,records:[]}),e=>e.message==='alliance_control_unavailable'&&e.outcome==='unknown'&&!e.cause);assert.equal(f.calls.length,6);assert.deepEqual(f.releases,[true]);await f.store.close();
});
test('fixed managed allowlist includes all four roles and only bootstrap ADMIN edges',()=>{
 const expected=managedControlEnvironment();assert.equal(expected.memberships.length,4);assert.deepEqual(expected.memberships.map(x=>x[0]),['alliance_control_anchor_writer','alliance_control_operator','alliance_control_owner','alliance_control_reader']);
 for(const row of expected.memberships)assert.deepEqual(row.slice(1),['postgres','supabase_admin',true,false,false]);
 expected.memberships[0][5]=true;assert.equal(managedControlEnvironment().memberships[0][5],false);assert.ok(MANAGED_CONTROL_ISOLATION.includes(JSON.stringify(managedControlEnvironment())));
});
test('offline installer preserves both original semantic bodies and removes its own SET grant',()=>{
 const sql=managedControlInstallSql();assert.match(sql,/BEGIN;[\s\S]+COMMIT;\s*$/);assert.match(sql,/REVOKE alliance_control_owner FROM postgres GRANTED BY postgres/);assert.match(sql,/Managed control installed permissions refused/);assert.ok(!/\blogin\s+password|\balter\s+role\b/i.test(sql));
 for(const name of ['alliance-control-store-candidate.sql','alliance-control-removal-anchor-candidate.sql']){
  const source=readFileSync(new URL('../../sql/'+name,import.meta.url),'utf8').replace(/\r\n/g,'\n');
  const bodies=[...source.matchAll(/as \$\$([\s\S]*?)\$\$;/g)];assert.ok(bodies.length>0);for(const [,body] of bodies)assert.ok(sql.includes('as $$'+body+'$$;'));
 }
});
