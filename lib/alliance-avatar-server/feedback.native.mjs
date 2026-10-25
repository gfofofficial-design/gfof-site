// Disposable PostgreSQL/TLS fixture only. Never accepts a provider or credential.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {secondCreationFixture} from './creation-second-fixture.mjs';
import {prepareCommunityMemberFixture} from './community-database.fixture.mjs';
import {managedCommunityExtensionSql} from './community-managed-install.mjs';
import {managedFeedbackExtensionSql,managedFeedbackClosedInspectionSql} from './feedback-managed-install.mjs';
import {createAllianceFeedbackStore} from './feedback-store.mjs';
import {createAllianceCommunityStore} from './community-store.mjs';
import {createAllianceFeedbackService} from './feedback-service.mjs';
import {createAvatarLedger} from './ledger.mjs';
import {journalFixture,event} from './deletion-journal.fixture.mjs';
import {deletionRecord} from './deletion-journal.mjs';
import {feedbackArchiveNative} from './feedback-archive.native.mjs';
export async function feedbackNative({secondOptions}){
 const d=await secondCreationFixture({...secondOptions,purpose:'control'}),root=q=>d.admin(q,'fixture_root'),stores=[];let pool,evidence,service;
 const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',o='33333333-3333-4333-8333-333333333333';
 const sa='44444444-4444-4444-8444-444444444444',sb='55555555-5555-4555-8555-555555555555',so='66666666-6666-4666-8666-666666666666';
 const id=n=>`${String(n).padStart(8,'0')}-7777-4777-8777-777777777777`;
 const post=n=>({action:'post',id:id(n),title:'A fictional practical tool',category:'tools',detail:'Compare public sources and record an explicit limitation.'});
 try{
  prepareCommunityMemberFixture(d);d.admin(managedCommunityExtensionSql());
  const install=managedFeedbackExtensionSql(),inspect=managedFeedbackClosedInspectionSql();
  const clean=()=>assert.match(d.admin("select to_regnamespace('alliance_feedback') is null and not pg_has_role('postgres','alliance_avatar_owner','SET') as clean;"),/\bt\b/);
  const marker='RESET ROLE;\nREVOKE alliance_avatar_owner FROM postgres GRANTED BY postgres;\nDO $feedback_verify$';
  assert.equal(install.split(marker).length,2);
  assert.throws(()=>d.admin(install.replace(marker,'grant select(detail) on alliance_feedback.ideas to alliance_avatar_executor;\n'+marker)),/Managed feedback verification refused/);clean();
  root('update alliance_community.control set enabled=true;');assert.throws(()=>d.admin(install),/Feedback requires a closed foundation/);clean();root('update alliance_community.control set enabled=false;');
  d.admin(install);d.admin(inspect);assert.throws(()=>d.admin(install),/Managed feedback preflight refused/);
  assert.match(d.admin("select not pg_has_role('postgres','alliance_avatar_owner','SET') as clean;"),/\bt\b/);
  for(const [actor,session,name]of [[a,sa,'Fictional author'],[b,sb,'Fictional supporter'],[o,so,'Fictional third member']])root(`insert into auth.users values('${actor}',clock_timestamp(),false,null,null);insert into auth.sessions values('${session}','${actor}',null);
   insert into public.alliance_member_owners(id,user_id) values('${actor}','${actor}');insert into public.alliance_profiles(id,display_name,bio,community,contribution_role,listed) values('${actor}','${name}','Disposable ideas acceptance only.','Fictional crew','builder',true);`);
  const password='synthetic-feedback-'+randomUUID();root(`alter role alliance_avatar_executor login password '${password}';`);
  const connection={...d.connection,password},open=async()=>{const s=await createAllianceFeedbackStore({enabled:true,deploymentProfile:'supabase-managed',connection,openPool:d.openPool});stores.push(s);return s;};
  let store=await open();const community=await createAllianceCommunityStore({enabled:true,deploymentProfile:'supabase-managed',connection,openPool:d.openPool});stores.push(community);
  pool=d.openPool({host:d.connection.host,user:'alliance_avatar_executor',database:'postgres',password,ssl:{ca:d.connection.ca,rejectUnauthorized:true,servername:d.connection.host},options:'-c search_path=pg_catalog',max:2,statement_timeout:2000,lock_timeout:750});
  const denied=work=>assert.rejects(work,e=>e.code==='42501'||['rejected','not_started'].includes(e.outcome));
  const change=(actor,session,v)=>store.change(actor,session,v),read=(actor,session,n)=>store.read(actor,session,id(n));
  await denied(()=>change(a,sa,post(1)));
  root('update alliance_avatar.control set enabled=true;update alliance_community.control set enabled=true;update alliance_feedback.control set enabled=true;');
  for(const role of ['anon','authenticated','service_role','alliance_avatar_executor'])for(const table of ['control','ideas','supports','reports'])assert.throws(()=>root(`set role ${role};select * from alliance_feedback.${table};`));
  for(const q of ['select * from auth.users','select alliance_feedback.snapshot(null,null)','select alliance_feedback.member(null,null,false)','set role alliance_avatar_owner'])await denied(()=>pool.query(q));
  console.log('PASS feedback atomic rollback, disabled install/inspection, forced RLS and restricted entry-point isolation');
  assert.equal((await change(a,sa,post(1))).state,'applied');assert.equal((await change(a,sa,post(1))).state,'replayed');
  await denied(()=>change(a,sa,{...post(1),title:'A changed earlier request'}));await denied(()=>change(b,sb,post(1)));
  await denied(()=>change(a,sa,{action:'support',id:id(1),supported:true}));
  const support={action:'support',id:id(1),supported:true};await change(b,sb,support);await change(b,sb,support);
  let r=await read(a,sa,1);assert.equal(r.idea.supportCount,1);assert.equal(r.idea.supported,false);assert.deepEqual(r.evidenceProfiles,[a,b]);assert.equal((await read(b,sb,1)).idea.supported,true);
  const report={action:'report',id:id(10),kind:'idea',target:id(1)};assert.deepEqual(await change(b,sb,report),{state:'recorded',id:id(10),kind:'idea',target:id(1),removed:false});
  await change(b,sb,report);assert.equal((await read(a,sa,1)).idea.title,post(1).title);await denied(()=>change(a,sa,{...report,id:id(11)}));await denied(()=>change(o,so,{...report,id:id(10)}));
  assert.match(root('select count(*)=1 from alliance_feedback.reports;'),/\bt\b/);
  await denied(()=>change(b,sb,{action:'remove',id:id(1)}));await change(a,sa,{action:'remove',id:id(1)});await change(a,sa,{action:'remove',id:id(1)});
  await denied(()=>read(a,sa,1));await denied(()=>change(a,sa,post(1)));
  assert.match(root(`select removed and title is null and category is null and detail is null from alliance_feedback.ideas where id='${id(1)}';select (select count(*) from alliance_feedback.supports)=0 and (select count(*) from alliance_feedback.reports)=0;`),/\bt\b/);
  console.log('PASS author ownership, exact replay/no resurrection, explicit idempotent support, private reports without takedown and content-erasing removal');
  await change(a,sa,post(2));await change(a,sa,post(3));await change(b,sb,{action:'support',id:id(2),supported:true});
  const first=await store.list(a,sa,{after:null,limit:1});assert.equal(first.items[0].idea.id,id(2));assert.equal(first.next,id(2));assert.equal((await store.list(a,sa,{after:first.next,limit:1})).items[0].idea.id,id(3));
  await community.block(b,sb,{target:a,hidden:true});
  await denied(()=>read(b,sb,2));assert.equal((await read(a,sa,2)).idea.supportCount,0);await denied(()=>change(b,sb,{action:'report',id:id(12),kind:'member',target:a}));
  await change(b,sb,{action:'support',id:id(2),supported:false});await community.block(b,sb,{target:a,hidden:false});
  root(`delete from auth.sessions where id='${sb}';`);await denied(()=>read(b,sb,2));root(`insert into auth.sessions values('${sb}','${b}',null);`);
  // Direct SQL input is checked independently of the JavaScript contract.
  for(const value of [null,{}, {action:null,id:id(20)},{action:'support',id:id(2),supported:null},{...post(20),category:null}])await denied(async()=>{
   const c=await pool.connect();try{await c.query('begin');await c.query("set local synchronous_commit='on'");await c.query('select alliance_feedback.change_session($1::uuid,$2::uuid,$3::jsonb)',[a,sa,JSON.stringify(value)]);}finally{await c.query('rollback');c.release();}
  });
  await store.close();store=await open();assert.equal((await read(a,sa,2)).idea.id,id(2));
  for(const [drift,restore]of [
   ['grant select(detail) on alliance_feedback.ideas to alliance_avatar_executor;','revoke select(detail) on alliance_feedback.ideas from alliance_avatar_executor;'],
   ['alter table alliance_feedback.reports disable row level security;','alter table alliance_feedback.reports enable row level security;'],
   ['alter function alliance_feedback.change_session(uuid,uuid,jsonb) security invoker;','alter function alliance_feedback.change_session(uuid,uuid,jsonb) security definer;'],
  ]){const s=await open();root(drift);try{await assert.rejects(s.read(a,sa,id(2)),{outcome:'not_started'});}finally{root(restore);}await assert.rejects(s.read(a,sa,id(2)),{outcome:'not_started'});}
  const ledger=await createAvatarLedger({enabled:true,deploymentProfile:'supabase-managed',connection,openPool:d.openPool});stores.push(ledger);
  evidence=journalFixture({events:[]});service=createAllianceFeedbackService({enabled:true,ledger,store,community,journal:evidence.client,serving:{authorizeFeedback:async()=>true}});
  await change(b,sb,{action:'support',id:id(2),supported:true});
  evidence.history.push(deletionRecord({projectRef:'abcdefghijklmnopqrst',epoch:'11111111-1111-4111-8111-111111111111',sequence:1,previous:'0'.repeat(64),event:event({profileId:b})}));
  assert.equal((await read(a,sa,2)).idea.supportCount,1);assert.deepEqual(await service.read({actorId:a,sessionId:sa,expiresAt:Date.now()+60000},id(2)),{state:'unavailable'});
  root('update alliance_feedback.control set ideas_created=128;');await denied(()=>change(a,sa,post(21)));await change(a,sa,{action:'remove',id:id(3)});await denied(()=>change(a,sa,post(22)));
  root('update alliance_avatar.control set enabled=false;update alliance_community.control set enabled=false;update alliance_feedback.control set enabled=false;');
  // Preserve nonempty private reports as well as ideas/support in recovery.
  root('update alliance_avatar.control set enabled=true;update alliance_community.control set enabled=true;update alliance_feedback.control set enabled=true;');
  await change(o,so,{action:'report',id:id(30),kind:'idea',target:id(2)});const saved=await read(a,sa,2);
  root('update alliance_avatar.control set enabled=false;update alliance_community.control set enabled=false;update alliance_feedback.control set enabled=false;');
  await feedbackArchiveNative({source:d,ledger,community,store,secondOptions,participants:[{actor:a,session:sa},{actor:b,session:sb},{actor:o,session:so}],saved,evidence:evidence.client});
  const before=await store.inventory();assert.equal(before.tables.length,4);root(`update alliance_feedback.ideas set detail='A changed fictional detail, with the same row count.' where id='${id(2)}';`);
  const changed=await store.inventory();assert.equal(changed.tables[1].rows,before.tables[1].rows);assert.notEqual(changed.tables[1].sha256,before.tables[1].sha256);
  root(`delete from public.alliance_member_owners where id='${a}';`);const after=await store.inventory();for(const t of after.tables)assert.equal(t.rows,t.table.endsWith('.control')?1:0);
  console.log('PASS fresh-connection durability, hiding and revoked SQL session, malformed SQL/ACL drift refusals, independent deletion evidence, nonrefundable caps, complete closed hashes and profile cascade');
 }finally{try{service?.close();evidence?.client.close();for(const s of stores)await s.close();if(pool&&!pool.ended)await pool.end();}finally{await d.close();}}
 console.log('PASS fictional feedback fixture removed; no hosted schema, permissions or data changed');
}
