// Guarded disposable fixture only; Auth/Storage responses are in memory.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createAvatarRecovery} from './recovery.mjs';
import {createAllianceAvatarStorage} from '../alliance-avatar-storage.mjs';
export async function recoveryNative({admin,ledger,actor,png,openLedger}){
  admin('begin;'+readFileSync(new URL('../../sql/alliance-avatar-recovery-candidate.sql',import.meta.url),'utf8')+'commit;');
  const reader=createAvatarRecovery({enabled:true,ledger}),third='30303030-3030-4030-8030-303030303030',fifth='90909090-9090-4090-8090-909090909090',sixth='a0a0a0a0-a0a0-40a0-80a0-a0a0a0a0a0a0';
  const pendingOp='80808080-8080-4080-8080-808080808080',queuedOp='c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c0c0';
  const missing='91919191-9191-4191-8191-919191919191';
  const fingerprint=()=>admin("select md5(coalesce(string_agg(t,chr(10) order by t),'')) from (select row_to_json(x)::text t from alliance_avatar.objects x union all select row_to_json(x)::text from alliance_avatar.operations x union all select row_to_json(x)::text from alliance_avatar.heads x union all select row_to_json(x)::text from alliance_avatar.cleanup_attempts x union all select row_to_json(x)::text from alliance_avatar.daily x union all select row_to_json(x)::text from alliance_avatar.control x) all_rows;");
  let previous=fingerprint();
  assert.equal((await reader.cleanup(third)).state,'deleted');assert.equal((await reader.cleanup(fifth)).state,'waiting');
  assert.deepEqual(await reader.cleanup(missing),{state:'missing'});assert.deepEqual(await reader.upload(missing),{state:'missing'});
  assert.equal(fingerprint(),previous);
  console.log('PASS read-only recovery distinguishes recorded deletion, waiting and missing IDs without changing any of six ledger tables');

  admin('update alliance_avatar.control set cleanup_enabled=true;');
  await ledger.beginCleanup(sixth);await ledger.unknownCleanup(sixth);
  previous=fingerprint();assert.equal((await reader.cleanup(sixth)).state,'unknown');assert.equal((await reader.upload(pendingOp)).state,'cleanup_pending');assert.equal(fingerprint(),previous);
  console.log('PASS missing deletion proof stays unknown while the distinct settled upload remains cleanup-pending');
  const url='https://abcdefghijklmnopqrst.supabase.co',key='sb_publishable_synthetic_fixture_only_12345';let calls=0;
  const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
  const gateway=receipt=>createAllianceAvatarStorage({enabled:true,origin:url,apiKey:key,bearerToken:'syntheticHeader.syntheticClaims.syntheticSignature',fetcher:async(_url,init)=>{calls++;return init.method==='DELETE'?json([{id:receipt.providerId,name:receipt.key}]):json({code:'NoSuchKey'},404);}});
  const dispatch=await ledger.beginCleanup(fifth),proof=await gateway(dispatch.receipt).remove(dispatch.receipt,{writeSettled:true,authorize:r=>ledger.authorizeCleanup(fifth,r)});
  assert.equal(proof.state,'deleted');
  // Simulate losing the caller acknowledgement AFTER the actual SQL commit.
  await assert.rejects((async()=>{await ledger.finishCleanup(fifth,proof);throw Error('simulated lost acknowledgement');})());
  const fresh=await openLedger();try{
    const recovered=createAvatarRecovery({enabled:true,ledger:fresh});previous=fingerprint();
    assert.equal((await recovered.cleanup(fifth)).state,'deleted');assert.equal((await recovered.upload(queuedOp)).state,'deleted');assert.equal(fingerprint(),previous);recovered.close();
  }finally{await fresh.close();}
  assert.equal(calls,2);
  console.log('PASS fresh TLS client recovers an already committed deletion after a simulated lost acknowledgement without another Storage request');

  const session='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',op='a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1';
  await ledger.reserveSession(actor,session,op,9);const uploadClaim=await ledger.claimUploadSession(actor,session,op,{bytes:png.length,width:1,height:1,mime:'image/png',sha256:createHash('sha256').update(png).digest('hex')});
  const uploader=createAllianceAvatarStorage({enabled:true,origin:url,apiKey:key,bearerToken:'syntheticHeader.syntheticClaims.syntheticSignature',fetcher:async(_url,init)=>init.method==='POST'?json({Key:'alliance-member-images-v1/'+uploadClaim.key,Id:'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'}):new Response(png,{headers:{'Content-Type':'image/png'}})});
  const uploaded=await uploader.upload({profileId:uploadClaim.key.split('/')[1],objectId:uploadClaim.objectId,derivative:{bytes:png,mime:'image/png',width:1,height:1}});
  await ledger.commitUploadSession(actor,session,op,uploaded);
  // Synthetic timestamp aging only; no clock, quota, state or proof reset.
  admin("update alliance_avatar.objects set created_at=clock_timestamp()-interval '90 days',settled_at=case when settled_at is null then null else clock_timestamp()-interval '80 days' end,deleted_at=case when deleted_at is null then null else clock_timestamp()-interval '70 days' end;update alliance_avatar.operations set created_at=clock_timestamp()-interval '90 days',expires_at=clock_timestamp()-interval '89 days';update alliance_avatar.cleanup_attempts set created_at=clock_timestamp()-interval '85 days',expires_at=clock_timestamp()-interval '84 days',dispatched_at=case when dispatched_at is null then null else clock_timestamp()-interval '83 days' end,finished_at=case when finished_at is null then null else clock_timestamp()-interval '82 days' end;");
  admin(`update alliance_avatar.objects set deleted_at=clock_timestamp() where id=(select object_id from alliance_avatar.cleanup_attempts where claim_id='${third}');`);
  const before=new Date(Date.now()-30*86400000).toISOString();
  const collect=async limit=>{const rows=[];let after='00000000-0000-0000-0000-000000000000';for(let n=0;n<20;n++){const page=await reader.retention({before,after,limit});assert.ok(Array.isArray(page.items));rows.push(...page.items);if(page.next===null)return rows;assert.ok(page.next>after);after=page.next;}assert.fail('unbounded fixture pagination');};
  previous=fingerprint();const rows=await collect(2);assert.equal(fingerprint(),previous);
  assert.equal(rows.find(x=>x.objectId===uploadClaim.objectId).reason,'keep_current');
  const ids=sql=>admin(sql).match(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/)[0];
  assert.equal(rows.find(x=>x.objectId===ids(`select object_id from alliance_avatar.cleanup_attempts where claim_id='${sixth}';`)).reason,'keep_open');
  assert.equal(rows.find(x=>x.objectId===ids(`select object_id from alliance_avatar.cleanup_attempts where claim_id='${fifth}';`)).reason,'review_deleted');
  assert.equal(rows.find(x=>x.objectId===ids(`select object_id from alliance_avatar.cleanup_attempts where claim_id='${third}';`)).reason,'keep_recent');
  assert.equal(calls,2);
  console.log('PASS paged retention review protects current/open/recent records and only labels old exact deletion evidence for human review');
  admin('update alliance_avatar.control set enabled=false,cleanup_enabled=false;');previous=fingerprint();
  assert.equal((await reader.upload(op)).state,'current');assert.equal((await reader.cleanup(fifth)).state,'deleted');assert.equal(fingerprint(),previous);
  console.log('PASS trusted recovery remains read-only with member/cleanup switches off and makes no provider call');

  admin('update alliance_avatar.control set enabled=true,cleanup_enabled=true;');
  await ledger.removeImageSession(actor,session,'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',10);
  const finalClaim='d1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1';await ledger.claimCleanup(finalClaim);const d=await ledger.beginCleanup(finalClaim);
  await ledger.finishCleanup(finalClaim,await gateway(d.receipt).remove(d.receipt,{writeSettled:true,authorize:r=>ledger.authorizeCleanup(finalClaim,r)}));
  const cancelled='e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1';await ledger.reserveSession(actor,session,cancelled,11);
  assert.equal((await reader.upload(cancelled)).state,'reserved');await ledger.cancelReservedSession(actor,session,cancelled);
  assert.equal((await reader.upload(cancelled)).state,'never_dispatched');
  const uncertain='f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f1f1';await ledger.reserveSession(actor,session,uncertain,11);await ledger.claimUploadSession(actor,session,uncertain,{bytes:png.length,width:1,height:1,mime:'image/png',sha256:createHash('sha256').update(png).digest('hex')});
  admin(`update alliance_avatar.operations set expires_at=clock_timestamp()-interval '1 second' where id='${uncertain}';`);await ledger.expireBatch(20);
  assert.equal((await reader.upload(uncertain)).state,'unsettled');
  console.log('PASS reserved/never-dispatched and genuinely unsettled upload histories are distinct without interpreting absence as proof');
  admin(`update alliance_avatar.objects set created_at=clock_timestamp()-interval '90 days',deleted_at=case when deleted_at is null then null else clock_timestamp()-interval '80 days' end where id in(select object_id from alliance_avatar.operations where id in('${cancelled}','${uncertain}'));update alliance_avatar.operations set created_at=clock_timestamp()-interval '90 days',expires_at=clock_timestamp()-interval '89 days' where id in('${cancelled}','${uncertain}');`);
  previous=fingerprint();const finalRows=await collect(20);assert.equal(fingerprint(),previous);
  assert.equal(finalRows.find(x=>x.objectId===ids(`select object_id from alliance_avatar.operations where id='${cancelled}';`)).reason,'review_never_dispatched');
  assert.equal(finalRows.find(x=>x.objectId===ids(`select object_id from alliance_avatar.operations where id='${uncertain}';`)).reason,'keep_uncertain');assert.equal(calls,4);
  console.log('PASS old never-dispatched metadata is reviewable but an old uncertain writer remains protected; preview never deletes rows');
  admin(`delete from auth.users where id='${actor}';`);previous=fingerprint();
  assert.equal((await reader.upload(uncertain)).state,'unsettled');assert.equal((await reader.cleanup(fifth)).state,'deleted');assert.equal(fingerprint(),previous);assert.equal(calls,4);
  console.log('PASS account deletion detaches access but trusted recovery retains unresolved/verified evidence without claiming Storage erasure');
  previous=fingerprint();const afterDeletion=await collect(20);assert.equal(fingerprint(),previous);
  assert.equal(afterDeletion.find(x=>x.objectId===ids(`select object_id from alliance_avatar.cleanup_attempts where claim_id='${fifth}';`)).reason,'keep_recent');
  console.log('PASS a fresh account-removal tombstone postpones review even when an image deletion receipt is old');
  const rights=admin("select has_function_privilege('authenticated','alliance_avatar.cleanup_recovery(uuid)','EXECUTE'),has_function_privilege('anon','alliance_avatar.retention_review(timestamptz,uuid,integer)','EXECUTE'),has_table_privilege('alliance_avatar_executor','alliance_avatar.objects','SELECT');");assert.match(rights,/f\s*\|\s*f\s*\|\s*f/);
  reader.close();
  console.log('PASS recovery functions remain private to the existing executor; no table, role, scheduler or purge permission added');
}
