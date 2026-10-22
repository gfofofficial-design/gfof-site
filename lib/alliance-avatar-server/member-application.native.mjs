// Complete text-profile journey against three disposable managed-role/TLS
// databases. Auth HTTP and signing transport remain fictional; never hosted.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateKeyPairSync,sign,randomUUID,createHash} from 'node:crypto';
import {secondCreationFixture} from './creation-second-fixture.mjs';
import {managedMemberInstallSql} from './member-managed-install.mjs';
import {managedJournalExtensionSql} from './journal-managed-install.mjs';
import {managedControlInstallSql} from './control-managed-install.mjs';
import {createAvatarLedger} from './ledger.mjs';
import {createDeletionJournalStore} from './journal-store.mjs';
import {createAllianceControlStore,createAllianceAnchorStore} from './control-store.mjs';
import {createAnchoredControlAuthority} from './control-authority.mjs';
import {createAnchoredJournalWitness} from './anchored-witness.mjs';
import {createNetlifyGatewaySigningRuntime} from './netlify-signing-runtime.mjs';
import {startupCheckpointSha256} from './startup-gate.mjs';
import {createAllianceMemberApplication} from '../alliance-member-application.mjs';
import {createMemberProfileClient} from '../../assets/federation/fed-alliance-member-client.mjs';
import {createProfileRemovalStatusClient} from '../../assets/federation/fed-alliance-profile-removal-status-client.mjs';
import {createProfileRemovalClient} from '../../assets/federation/fed-alliance-profile-removal-client.mjs';

export async function memberApplicationNative({secondOptions}){
 const domains=[],handles=[];
 const own=v=>{handles.push(v);return v;},sql=name=>readFileSync(new URL('../../sql/'+name,import.meta.url),'utf8');
 const scope={memberProjectRef:'abcdefghijklmnopqrst',journalProjectRef:'uvwxyzabcdefghijklmn',controlProjectRef:'opqrstuvwxyzabcdefgh',epoch:'11111111-1111-4111-8111-111111111111'};
 const actor='11111111-1111-4111-8111-111111111111',session='22222222-2222-4222-8222-222222222222';
 const zero={sequence:0,sha256:'0'.repeat(64)},origin='https://deploy-preview-124--gfof.netlify.app',url=`https://${scope.memberProjectRef}.supabase.co`;
 const keys=()=>{const pair=generateKeyPairSync('ed25519');return {pair,publicKey:Buffer.from(pair.publicKey.export({format:'jwk'}).x,'base64url').toString('hex'),signBytes:bytes=>sign(null,bytes,pair.privateKey)};};
 const controlKey=keys(),witnessKey=keys(),caller=keys();
 let app,editor,status,remover;
 try{
  for(const purpose of ['replacement-member','replacement-journal','replacement-control'])domains.push(await secondCreationFixture({...secondOptions,purpose}));
  const [member,journal,control]=domains,root=d=>q=>d.admin(q,'fixture_root'),mr=root(member),jr=root(journal),cr=root(control);
  for(const d of domains){
   d.admin('create role fixture_root login superuser;set session authorization fixture_root;alter role postgres rename to supabase_admin;create role postgres login inherit nosuperuser createdb createrole noreplication bypassrls;grant create on database postgres to postgres;');
   root(d)(`create role anon nologin;create role authenticated nologin;create role service_role nologin;
    create schema auth authorization supabase_admin;create schema storage authorization supabase_admin;
    create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean,deleted_at timestamptz,banned_until timestamptz);
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);
    create table auth.identities(id uuid);create table storage.objects(id uuid);create table storage.buckets(id text);
    grant usage on schema auth,storage to postgres;grant select on auth.users,auth.sessions,auth.identities,storage.objects,storage.buckets to postgres;grant references(id) on auth.users to postgres;
    grant usage,create on schema public to postgres with grant option;revoke create on schema public from public;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    set role supabase_admin;grant pg_read_all_data to postgres with admin true,inherit true,set true;reset role;`);
  }
  mr(`insert into auth.users values('${actor}',clock_timestamp(),false,null,null);insert into auth.sessions values('${session}','${actor}',null);`);
  member.admin('alter default privileges in schema public grant all on tables to anon,authenticated,service_role;alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;');
  member.admin(managedMemberInstallSql());
  const base=sql('alliance-deletion-journal-store-candidate.sql').replace('create schema alliance_journal authorization alliance_journal_owner;','grant alliance_journal_owner to postgres with inherit false,set true;create schema alliance_journal authorization alliance_journal_owner;set local role alliance_journal_owner;');
  journal.admin('begin;'+base+'revoke alliance_journal_owner from postgres granted by postgres;commit;');journal.admin(managedJournalExtensionSql());
  control.admin(managedControlInstallSql());
  // Fictional credentials exist only in these disposable clusters and memory.
  const password='synthetic-composed-'+randomUUID();
  mr(`alter role alliance_avatar_executor login password '${password}';`);
  jr(`alter role alliance_journal_executor login password '${password}';update alliance_journal.control set project_ref='${scope.memberProjectRef}',epoch='${scope.epoch}';`);
  cr(`alter role alliance_control_reader login password '${password}';alter role alliance_control_operator login password '${password}';alter role alliance_control_anchor_writer login password '${password}';`);
  const ledger=own(await createAvatarLedger({enabled:true,deploymentProfile:'supabase-managed',connection:{...member.connection,password},openPool:member.openPool}));
  const journalStore=own(await createDeletionJournalStore({enabled:true,projectRef:scope.memberProjectRef,epoch:scope.epoch,connection:{...journal.connection,password},openPool:journal.openPool}));
  const common={enabled:true,deploymentProfile:'supabase-managed',...scope,connection:{...control.connection,password},openPool:control.openPool};
  const policyReader=own(await createAllianceControlStore(common)),anchorReader=own(await createAllianceAnchorStore(common)),anchorWriter=own(await createAllianceAnchorStore({...common,writeEnabled:true}));
  const operator=control.openPool({user:'alliance_control_operator',database:'postgres',password,ssl:{ca:control.connection.ca,rejectUnauthorized:true,servername:control.connection.host},max:1});
  const initial=(await operator.query('select alliance_control.bootstrap($1,$2,$3,$4) as result',[scope.memberProjectRef,scope.journalProjectRef,scope.epoch,randomUUID()])).rows[0].result;
  const frozenAt=new Date().toISOString();
  const checkpoint={format:2,memberProjectRef:scope.memberProjectRef,journalProjectRef:scope.journalProjectRef,epoch:scope.epoch,freezeId:randomUUID(),capturedAt:new Date().toISOString(),member:await ledger.recoveryInventory(),journal:await journalStore.recoveryInventory()};
  const change=async(p,next)=>{
   const result=await operator.query('select alliance_control.transition($1::text,$2::text,$3::uuid,$4::integer,$5::text,$6::uuid,$7::jsonb,$8::jsonb) as result',[scope.memberProjectRef,scope.journalProjectRef,scope.epoch,p.revision,p.sha256,randomUUID(),JSON.stringify(next),JSON.stringify([])]);
   return result.rows[0].result.policy;
  };
  const binding={freezeId:checkpoint.freezeId,frozenAt,checkpointSha256:startupCheckpointSha256(checkpoint),floor:zero};
  let policy=await change(initial,{state:'review',...binding});
  const authority=own(createAnchoredControlAuthority({enabled:true,...scope,verificationKey:controlKey.publicKey,minimum:{revision:policy.revision,sha256:policy.sha256,floor:zero},store:policyReader,anchorStore:anchorReader,signBytes:controlKey.signBytes}));
  const witness=own(createAnchoredJournalWitness({enabled:true,projectRef:scope.memberProjectRef,journalProjectRef:scope.journalProjectRef,epoch:scope.epoch,minimum:zero,verificationKey:witnessKey.publicKey,signBytes:witnessKey.signBytes,store:journalStore,anchorStore:anchorReader}));
  const expected={siteId:'11111111-2222-4333-8444-555555555555',deployId:'1234567890abcdef12345678',context:'deploy-preview'},context={site:{id:expected.siteId},deploy:{id:expected.deployId,context:expected.context}};
  const spki=caller.pair.publicKey.export({format:'der',type:'spki'});
  const signing=own(createNetlifyGatewaySigningRuntime({enabled:true,expectedInstallation:expected,callerKey:{keyId:createHash('sha256').update(spki).digest('hex'),spki:spki.toString('base64'),notBeforeUtc:new Date(Date.now()-10000).toISOString(),notAfterUtc:new Date(Date.now()+3600000).toISOString()},readSecret:()=>caller.pair.privateKey.export({format:'der',type:'pkcs8'}).toString('base64')}));
  const token='fixtureHeader.'+Buffer.from(JSON.stringify({sub:actor,session_id:session,iss:url+'/auth/v1',role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+300})).toString('base64url')+'.fixtureSignature';
  let authReads=0;
  const auth=async(endpoint,init)=>{authReads++;assert.equal(endpoint,url+'/auth/v1/user');assert.equal(init.headers.Authorization,'Bearer '+token);return new Response(JSON.stringify({id:actor,email:'fixture@example.invalid',email_confirmed_at:frozenAt,is_anonymous:false,user_metadata:{admin:true}}),{headers:{'content-type':'application/json'}});};
  const issue=async(signer,input,options)=>{await signing.signingKey();const r=await signer.issue(input,options);assert.equal(r.state,'signed');return r.bytes;};
  app=createAllianceMemberApplication({enabled:true,origin,url,key:'sb_publishable_synthetic_composed_fixture_only',scope:{memberProjectRef:scope.memberProjectRef,journalProjectRef:scope.journalProjectRef,epoch:scope.epoch},minimum:zero,minimumRevision:policy.revision,startupVerificationKey:controlKey.publicKey,journalVerificationKey:witnessKey.publicKey,expectedInstallation:expected,ledger,journalStore,anchorStore:anchorWriter,signingRuntime:signing,
   readDecision:(input,options)=>issue(authority,input,options),readWitness:({challenge,signal})=>issue(witness,{challenge},{signal}),processor:{process(){throw Error('Image path not in this journey');}},storage:{upload(){throw Error('Image path not in this journey');}},fetcher:auth});
  const request=(path,init={})=>new Request(origin+'/api/alliance-members'+path,{...init,headers:{...init.headers,origin,'sec-fetch-site':'same-origin',cookie:'__Host-gf-access='+token}});
  const transport=(endpoint,init)=>app.handle(request(new URL(endpoint).pathname.slice('/api/alliance-members'.length)+new URL(endpoint).search,init),context);
  assert.equal((await app.handle(request('/me'),context)).status,503);assert.equal(authReads,0);
  assert.deepEqual(await app.prepare(checkpoint,context),{state:'prepared',access:'closed'});
  mr('update alliance_avatar.control set enabled=true,creation_enabled=true,profile_revision_enabled=true;');jr('update alliance_journal.control set enabled=true,admission_enabled=true;');policy=await change(policy,{state:'serve',...binding});
  editor=createMemberProfileClient({enabled:true,profileRevisions:true,origin,fetcher:transport,newOperationId:randomUUID});
  status=createProfileRemovalStatusClient({enabled:true,origin,fetcher:transport});remover=createProfileRemovalClient({enabled:true,profileBinding:true,origin,fetcher:transport,newOperationId:randomUUID});
  assert.equal((await editor.load()).profile,null);
  const fields={name:'Composed fixture',community:'Fictional crew',bio:'Disposable managed-database journey only.',role:'builder',listed:true};
  const first=await editor.save(fields);assert.equal(first.revision,1);
  assert.equal((await editor.save({...fields,name:'Second ordinary edit'})).revision,2);
  assert.equal((await editor.directory()).items.length,1);
  assert.equal((await editor.save({...fields,listed:false})).revision,3);
  assert.equal((await editor.directory()).items.length,0);
  // Auth still returns the same apparently valid token: the real SQL-session
  // guard must withhold the profile. The API deliberately reports generic
  // unavailability for a SQL refusal, not an Auth-server rejection/401.
  assert.deepEqual(await ledger.authorizeAccountSession(actor,session),{actorId:actor,sessionId:session});
  const beforeRevoked=authReads;mr('delete from auth.sessions;');
  await assert.rejects(ledger.authorizeAccountSession(actor,session),e=>e.outcome==='rejected');
  const denied=await app.handle(request('/me'),context);assert.equal(denied.status,503);assert.equal((await denied.json()).error.code,'profile_unavailable');assert.equal(authReads,beforeRevoked+1);
  mr(`insert into auth.sessions values('${session}','${actor}',null);`);
  assert.equal((await editor.load()).revision,3);
  const bound=await status.read();assert.equal(bound.profileId,first.profile.id);
  assert.equal((await remover.confirm({...bound,confirm:'remove_my_profile'})).state,'committed');
  assert.equal((await journalStore.tip()).sequence,1);assert.equal((await anchorReader.read()).sequence,1);
  assert.match(mr(`select not exists(select 1 from public.alliance_profiles) and not exists(select 1 from public.alliance_member_owners) and not exists(select 1 from alliance_avatar.creation_plans where profile_last_result is not null) as removed;`),/\bt\b/);
  console.log('PASS complete application over three managed-role TLS databases: signed closed startup, create, second edit, listed directory, unlist and journal/anchor-first removal; no routine owner approval');
  const before=authReads;policy=await change(policy,{state:'closed',...binding});assert.equal((await app.handle(request('/me'),context)).status,503);assert.equal(authReads,before);
  console.log('PASS actual SQL session revocation refuses an otherwise accepted Auth cookie; withdrawn signed serving authority prevents further Auth/profile work');
 }finally{
  editor?.dispose();status?.dispose();remover?.dispose();app?.close();
  const cleanupErrors=[];
  for(const h of handles.reverse())try{await h.close();}catch{cleanupErrors.push('handle');}
  for(const d of domains.reverse())try{await d.close();}catch{cleanupErrors.push('domain');}
  if(cleanupErrors.length)throw Error('Disposable composed fixture cleanup failed: '+cleanupErrors.join(','));
 }
 console.log('PASS complete managed application fixtures, pools and ephemeral keys retired; zero hosted provider, mail or wallet calls');
}
