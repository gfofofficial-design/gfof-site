// Complete text-profile journey against three disposable managed-role/TLS
// databases. Auth HTTP and signing transport remain fictional; never hosted.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateKeyPairSync,sign,randomUUID,createHash} from 'node:crypto';
import {secondCreationFixture} from './creation-second-fixture.mjs';
import {managedMemberInstallSql} from './member-managed-install.mjs';
import {managedCommunityExtensionSql} from './community-managed-install.mjs';
import {managedFeedbackExtensionSql} from './feedback-managed-install.mjs';
import {managedReportReviewExtensionSql} from './report-review-install.mjs';
import {managedJournalExtensionSql,managedJournalReaderExtensionSql} from './journal-managed-install.mjs';
import {managedControlInstallSql} from './control-managed-install.mjs';
import {createAvatarLedger} from './ledger.mjs';
import {createDeletionJournalStore} from './journal-store.mjs';
import {createAllianceAnchorStore} from './control-store.mjs';
import {createNetlifyGatewaySigningRuntime} from './netlify-signing-runtime.mjs';
import {createMemberAuthorityTransport} from './member-authority-transport.mjs';
import {nativeMemberAwsRuntime} from './member-aws-runtime.fixture.mjs';
import {startupCheckpointSha256,createAllianceCommunityStartupGate} from './startup-gate.mjs';
import {communityCheckpointSha256} from './community-recovery.mjs';
import {createAllianceCommunityStore} from './community-store.mjs';
import {createAllianceFeedbackStore} from './feedback-store.mjs';
import {createAllianceReportReviewStore} from './report-review-store.mjs';
import {reportReviewCheckpointSha256} from './report-review-recovery.mjs';
import {createAllianceMemberApplication} from '../alliance-member-application.mjs';
import {createManagedAlliancePreviewBundle} from '../alliance-member-preview-bundle.mjs';
import {createAllianceReportReviewClient} from '../../assets/federation/fed-alliance-report-review-client.mjs';
import {createAllianceCollaborationClient} from '../../assets/federation/fed-alliance-collaboration-client.mjs';
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
  member.admin(managedCommunityExtensionSql());
  member.admin(managedFeedbackExtensionSql());
  member.admin(managedReportReviewExtensionSql());
  const base=sql('alliance-deletion-journal-store-candidate.sql').replace('create schema alliance_journal authorization alliance_journal_owner;','grant alliance_journal_owner to postgres with inherit false,set true;create schema alliance_journal authorization alliance_journal_owner;set local role alliance_journal_owner;');
  journal.admin('begin;'+base+'revoke alliance_journal_owner from postgres granted by postgres;commit;');journal.admin(managedJournalExtensionSql());journal.admin(managedJournalReaderExtensionSql());
  control.admin(managedControlInstallSql());
  // Fictional credentials exist only in these disposable clusters and memory.
  const password='synthetic-composed-'+randomUUID();
  mr(`alter role alliance_avatar_executor login password '${password}';`);
  jr(`alter role alliance_journal_executor login password '${password}';alter role alliance_journal_reader login password '${password}';update alliance_journal.control set project_ref='${scope.memberProjectRef}',epoch='${scope.epoch}';`);
  cr(`alter role alliance_control_reader login password '${password}';alter role alliance_control_operator login password '${password}';alter role alliance_control_anchor_writer login password '${password}';`);
  const ledger=own(await createAvatarLedger({enabled:true,deploymentProfile:'supabase-managed',connection:{...member.connection,password},openPool:member.openPool}));
  const journalStore=own(await createDeletionJournalStore({enabled:true,projectRef:scope.memberProjectRef,epoch:scope.epoch,connection:{...journal.connection,password},openPool:journal.openPool}));
  const common={enabled:true,deploymentProfile:'supabase-managed',...scope,connection:{...control.connection,password},openPool:control.openPool};
  const anchorReader=own(await createAllianceAnchorStore(common)),anchorWriter=own(await createAllianceAnchorStore({...common,writeEnabled:true}));
  const operator=control.openPool({user:'alliance_control_operator',database:'postgres',password,ssl:{ca:control.connection.ca,rejectUnauthorized:true,servername:control.connection.host},max:1});
  const initial=(await operator.query('select alliance_control.bootstrap($1,$2,$3,$4) as result',[scope.memberProjectRef,scope.journalProjectRef,scope.epoch,randomUUID()])).rows[0].result;
  const frozenAt=new Date().toISOString();
  const checkpoint={format:2,memberProjectRef:scope.memberProjectRef,journalProjectRef:scope.journalProjectRef,epoch:scope.epoch,freezeId:randomUUID(),capturedAt:new Date().toISOString(),member:await ledger.recoveryInventory(),journal:await journalStore.recoveryInventory()};
  const change=async(p,next,chain=[])=>{
   const result=await operator.query('select alliance_control.transition($1::text,$2::text,$3::uuid,$4::integer,$5::text,$6::uuid,$7::jsonb,$8::jsonb) as result',[scope.memberProjectRef,scope.journalProjectRef,scope.epoch,p.revision,p.sha256,randomUUID(),JSON.stringify(next),JSON.stringify(chain)]);
   return result.rows[0].result.policy;
  };
  const binding={freezeId:checkpoint.freezeId,frozenAt,checkpointSha256:startupCheckpointSha256(checkpoint),floor:zero};
  let policy=await change(initial,{state:'review',...binding});
  const expected={siteId:'11111111-2222-4333-8444-555555555555',deployId:'1234567890abcdef12345678',context:'deploy-preview'},context={site:{id:expected.siteId},deploy:{id:expected.deployId,context:expected.context}};
  const spki=caller.pair.publicKey.export({format:'der',type:'spki'});
  const signing=own(createNetlifyGatewaySigningRuntime({enabled:true,expectedInstallation:expected,callerKey:{keyId:createHash('sha256').update(spki).digest('hex'),spki:spki.toString('base64'),notBeforeUtc:new Date(Date.now()-10000).toISOString(),notAfterUtc:new Date(Date.now()+3600000).toISOString()},readSecret:()=>caller.pair.privateKey.export({format:'der',type:'pkcs8'}).toString('base64')}));
  const token='fixtureHeader.'+Buffer.from(JSON.stringify({sub:actor,session_id:session,iss:url+'/auth/v1',role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+300})).toString('base64url')+'.fixtureSignature';
  let authReads=0;
  const auth=async(endpoint,init)=>{authReads++;assert.equal(endpoint,url+'/auth/v1/user');assert.equal(init.headers.Authorization,'Bearer '+token);return new Response(JSON.stringify({id:actor,email:'fixture@example.invalid',email_confirmed_at:frozenAt,is_anonymous:false,user_metadata:{admin:true}}),{headers:{'content-type':'application/json'}});};
  // Synthetic API/Lambda/AWS responses; the composed control/anchor/Journal
  // readers below use the actual disposable managed-role TLS databases.
  const gateway={apiId:'abcdefghij',region:'us-east-2',stage:'preview'},resource={accountId:'123456789012',region:'us-east-2',functionName:'alliance-member-authority-synthetic',version:'7'};
  const authorityOptions={gateway,resource,scope,callerKey:{keyId:createHash('sha256').update(spki).digest('hex'),spki:spki.toString('base64'),notBeforeUtc:new Date(Date.now()-60000).toISOString(),notAfterUtc:new Date(Date.now()+3600000).toISOString()},controlVerificationKey:controlKey.publicKey,journalVerificationKey:witnessKey.publicKey};
  let authorityExchanges=0;
  const authorityHandler=own(await nativeMemberAwsRuntime({binding:authorityOptions,policy,control,journal,password,controlKey,witnessKey}));
  const authorityTransport=async(options,body)=>{
   authorityExchanges++;const headers={...options.headers,host:options.hostname};
   const result=await authorityHandler.handler({resource:'/member-authority',path:'/member-authority',httpMethod:'POST',headers,multiValueHeaders:Object.fromEntries(Object.entries(headers).map(([k,v])=>[k,[v]])),queryStringParameters:null,multiValueQueryStringParameters:null,pathParameters:null,stageVariables:null,isBase64Encoded:false,body:body.toString('utf8'),requestContext:{accountId:resource.accountId,apiId:gateway.apiId,stage:gateway.stage,domainName:options.hostname,resourcePath:'/member-authority',path:options.path,httpMethod:'POST'}},{functionName:resource.functionName,functionVersion:resource.version,invokedFunctionArn:`arn:aws:lambda:${resource.region}:${resource.accountId}:function:${resource.functionName}:${resource.version}`,getRemainingTimeInMillis:()=>10000});
   return {statusCode:result.statusCode,headers:{'content-type':result.headers['content-type']},body:Buffer.from(result.body)};
  };
  const authorityClient=own(createMemberAuthorityTransport({enabled:true,...authorityOptions,signingKey:signing.signingKey,transport:authorityTransport}));
  app=createAllianceMemberApplication({enabled:true,origin,url,key:'sb_publishable_synthetic_composed_fixture_only',scope:{memberProjectRef:scope.memberProjectRef,journalProjectRef:scope.journalProjectRef,epoch:scope.epoch},minimum:zero,minimumRevision:policy.revision,startupVerificationKey:controlKey.publicKey,journalVerificationKey:witnessKey.publicKey,expectedInstallation:expected,ledger,journalStore,anchorStore:anchorWriter,signingRuntime:signing,
   readDecision:authorityClient.readDecision,readWitness:authorityClient.readWitness,processor:{process(){throw Error('Image path not in this journey');}},storage:{upload(){throw Error('Image path not in this journey');}},fetcher:auth});
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
  mr('update alliance_avatar.control set enabled=false,creation_enabled=false,profile_revision_enabled=false,cleanup_enabled=false;');jr('update alliance_journal.control set enabled=false,admission_enabled=false;');
  const community=own(await createAllianceCommunityStore({enabled:true,deploymentProfile:'supabase-managed',connection:{...member.connection,password},openPool:member.openPool}));
  const combinedFrozen=new Date().toISOString(),combined={format:3,memberProjectRef:scope.memberProjectRef,journalProjectRef:scope.journalProjectRef,epoch:scope.epoch,freezeId:randomUUID(),capturedAt:new Date().toISOString(),member:await ledger.recoveryInventory(),journal:await journalStore.recoveryInventory(),community:await community.inventory()};
  const combinedBinding={freezeId:combined.freezeId,frozenAt:combinedFrozen,checkpointSha256:communityCheckpointSha256(combined),floor:{sequence:combined.journal.sequence,sha256:combined.journal.sha256}};
  policy=await change(policy,{state:'review',...combinedBinding},await journalStore.records(combinedBinding.floor));
  const communityGate=own(createAllianceCommunityStartupGate({enabled:true,memberProjectRef:scope.memberProjectRef,journalProjectRef:scope.journalProjectRef,epoch:scope.epoch,verificationKey:controlKey.publicKey,minimumRevision:policy.revision,minimum:combinedBinding.floor,readDecision:(input,options)=>signing.run(context,({signal})=>authorityClient.readDecision(input,{signal:AbortSignal.any([signal,options.signal])}),options),ledger,journal:journalStore,community}));
  assert.equal(typeof communityGate.authorize,'undefined');assert.equal(await communityGate.authorizeCommunity(),false);assert.deepEqual(await communityGate.prepare(combined),{state:'prepared',access:'closed'});
  policy=await change(policy,{state:'serve',...combinedBinding});assert.equal(await communityGate.authorizeCommunity(),true);
  assert.match(mr('select not enabled from alliance_community.control;'),/\bt\b/);
  policy=await change(policy,{state:'closed',...combinedBinding});assert.equal(await communityGate.authorizeCommunity(),false);
  console.log('PASS dedicated community startup binds real member9/community5/journal3 inventories and acknowledged deletion floor over three managed-role TLS domains; signed review cannot serve, separate serve/closure observed, SQL modes stay closed');
  // Fresh combined application, with two fictional current Auth sessions. The
  // old profile-only application and old gate remain retired; no shared bypass.
  const peers=[{actor:randomUUID(),session:randomUUID()},{actor:randomUUID(),session:randomUUID()}];
  for(const p of peers)mr(`insert into auth.users values('${p.actor}',clock_timestamp(),false,null,null);insert into auth.sessions values('${p.session}','${p.actor}',null);`);
  const feedback=own(await createAllianceFeedbackStore({enabled:true,deploymentProfile:'supabase-managed',connection:{...member.connection,password},openPool:member.openPool}));
  const reportReview=own(await createAllianceReportReviewStore({enabled:true,deploymentProfile:'supabase-managed',connection:{...member.connection,password},openPool:member.openPool}));
  const liveFrozen=new Date().toISOString();
  const liveCheckpoint={...combined,format:5,freezeId:randomUUID(),capturedAt:liveFrozen,feedback:await feedback.inventory(),reportReview:await reportReview.inventory()};
  liveCheckpoint.capturedAt=new Date().toISOString();
  const liveBinding={...combinedBinding,freezeId:liveCheckpoint.freezeId,frozenAt:liveFrozen,checkpointSha256:reportReviewCheckpointSha256(liveCheckpoint)};
  policy=await change(policy,{state:'review',...liveBinding},await journalStore.records(liveBinding.floor));
  app.close();
  const peerTokens=peers.map(p=>'fixtureHeader.'+Buffer.from(JSON.stringify({sub:p.actor,session_id:p.session,iss:url+'/auth/v1',role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+300})).toString('base64url')+'.fixtureSignature');
  let mediaClosed=false;
  const byHost=new Map(domains.map(d=>[d.connection.host,d]));
  const preview=own(await createManagedAlliancePreviewBundle({enabled:true,
   configuration:{origin,key:'sb_publishable_synthetic_composed_fixture_only',scope,minimum:liveBinding.floor,minimumRevision:policy.revision,expectedInstallation:expected,
    reviewerActor:actor,gateway,resource,callerKey:authorityOptions.callerKey,controlVerificationKey:controlKey.publicKey,journalVerificationKey:witnessKey.publicKey},
   connections:{member:{...member.connection,password},journal:{...journal.connection,password},anchor:{...control.connection,password}},
   openPool:config=>{const target=byHost.get(config.host);assert.ok(target);return target.openPool(config);},
   readCallerSecret:()=>caller.pair.privateKey.export({format:'der',type:'pkcs8'}).toString('base64'),transport:authorityTransport,
   openMedia:async()=>({processor:{process(){throw Error('No images');}},storage:{upload(){throw Error('No images');}},close(){mediaClosed=true;}}),
   fetcher:async(endpoint,init)=>{
    assert.equal(endpoint,url+'/auth/v1/user');
    if(init.headers.Authorization==='Bearer '+token)return new Response(JSON.stringify({id:actor,email_confirmed_at:frozenAt,is_anonymous:false}));
    const n=peerTokens.findIndex(t=>init.headers.Authorization==='Bearer '+t);assert.ok(n>=0);return new Response(JSON.stringify({id:peers[n].actor,email_confirmed_at:frozenAt,is_anonymous:false}));
   }}));
  app=preview.application;
  assert.deepEqual(await app.prepare(liveCheckpoint,context),{state:'prepared',access:'closed'});
  policy=await change(policy,{state:'serve',...liveBinding});mr('update alliance_avatar.control set enabled=true,creation_enabled=true,profile_revision_enabled=true;update alliance_community.control set enabled=true;');jr('update alliance_journal.control set enabled=true,admission_enabled=true;');
  mr(`update alliance_feedback.control set enabled=true;update alliance_report_review.control set enabled=true,reviewer_actor='${actor}';`);
  const call=async(n,path,body)=>{
   const r=await app.handle(new Request(origin+'/api/alliance-members'+path,{method:body===undefined?'GET':'POST',headers:{origin,'sec-fetch-site':'same-origin',cookie:'__Host-gf-access='+peerTokens[n],...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})}),context);
   return {status:r.status,body:await r.json()};
  };
  const profiles=[];for(let n=0;n<2;n++){const r=await call(n,'/me',{operationId:randomUUID(),revision:0,profile:{...fields,name:'Combined peer '+n}});assert.equal(r.status,200);profiles.push(r.body.profile);}
  const peerClients=peers.map((_,n)=>{const client=createAllianceCollaborationClient({enabled:true,origin,fetcher:(endpoint,init)=>app.handle(new Request(endpoint,{...init,headers:{...init.headers,origin,'sec-fetch-site':'same-origin',cookie:'__Host-gf-access='+peerTokens[n]}}),context)});own({close:()=>client.dispose()});return client;});
  assert.equal((await peerClients[0].list()).page.items.length,0);
  const invitation={operationId:randomUUID(),challengeId:null,revision:0,action:'invite',target:profiles[1].id,kit:'research',scope:'members',days:7,goal:1,note:'A fictional combined application research brief.',format:1};invitation.challengeId=invitation.operationId;
  assert.equal((await peerClients[0].change(invitation)).state,'applied');
  assert.equal((await peerClients[0].change(invitation)).state,'replayed');
  assert.equal((await peerClients[1].change({operationId:randomUUID(),challengeId:invitation.challengeId,revision:1,action:'accept'})).challenge.status,'active');
  const contribution=randomUUID();assert.equal((await peerClients[0].change({operationId:contribution,challengeId:invitation.challengeId,revision:2,action:'contribute',note:'A contribution through verified-cookie HTTP and real SQL.'})).challenge.proofs[0].id,contribution);
  assert.equal((await peerClients[1].change({operationId:randomUUID(),challengeId:invitation.challengeId,revision:3,action:'acknowledge',proofId:contribution})).challenge.status,'complete');
  assert.deepEqual((await peerClients[0].change(invitation)),{state:'conflict',revision:4});
  assert.equal((await peerClients[1].visibility({target:profiles[0].id,hidden:true})).state,'set');await assert.rejects(peerClients[0].read(invitation.challengeId),{code:'unavailable'});
  assert.equal((await peerClients[1].visibility({target:profiles[0].id,hidden:false})).state,'set');assert.equal((await peerClients[0].read(invitation.challengeId)).challenge.status,'complete');
  // One complete member-to-owner path through the same prepared application.
  // Use actual SQL stores and browser review client; Auth/provider replies remain
  // explicit stand-ins. No private IDs may cross the review HTTP boundary.
  const ideaId=randomUUID(),reportId=randomUUID(),post={action:'post',id:ideaId,title:'Readable evidence summaries',category:'accessibility',detail:'Include a short text summary beside each fictional chart.'};
  assert.equal((await call(0,'/feedback/change',post)).body.state,'applied');
  assert.equal((await call(1,'/feedback/change',{action:'support',id:ideaId,supported:true})).body.state,'set');
  assert.equal((await call(1,'/feedback/idea?id='+ideaId)).body.idea.supportCount,1);
  assert.deepEqual((await call(1,'/feedback/change',{action:'report',id:reportId,kind:'idea',target:ideaId})).body,{state:'recorded',id:reportId,kind:'idea',target:ideaId,removed:false});
  assert.equal((await call(0,'/report-review/reports')).status,403);
  const reviewClient=own(createAllianceReportReviewClient({enabled:true,origin,fetcher:async(endpoint,init)=>{
   const r=await app.handle(new Request(endpoint,{...init,headers:{...init.headers,origin,'sec-fetch-site':'same-origin',cookie:'__Host-gf-access='+token}}),context);
   assert.match(r.headers.get('cache-control'),/no-store/);
   const body=await r.clone().text();assert.equal(body.includes('evidenceProfiles'),false);assert.equal(body.includes('reporter'),false);
   for(const p of profiles)assert.equal(body.includes(p.id),false);
   return r;
  }}));
  const queue=await reviewClient.list();assert.equal(queue.items.length,1);assert.equal(queue.items[0].id,reportId);assert.equal(queue.items[0].contextLoaded,false);assert.equal(queue.items[0].targetTitle,null);
  const selected=await reviewClient.read(reportId);assert.equal(selected.targetTitle,post.title);assert.equal(selected.disposition,'unreviewed');
  const reviewed=await reviewClient.review({id:reportId,expected:'unreviewed',disposition:'owner_follow_up'});
  assert.equal(reviewed.disposition,'owner_follow_up');assert.equal(Date.parse(reviewed.expiresAt)-Date.parse(reviewed.reviewedAt),30*86400000);
  assert.equal((await reviewClient.read(reportId)).reviewedAt,reviewed.reviewedAt);
  assert.equal((await call(0,'/feedback/idea?id='+ideaId)).body.idea.title,post.title);
  console.log('PASS complete review-aware application: member idea/support/private report -> owner metadata queue -> selected context -> saved review through cookie HTTP, browser review client, signed checkpoint5 and real restricted SQL; private profile identifiers stay server-only, and review does not remove the idea');
  mr(`delete from auth.sessions where id='${session}';`);await assert.rejects(reviewClient.list(),{code:'refused'});
  mr(`insert into auth.sessions values('${session}','${actor}',null);`);assert.equal((await reviewClient.list()).items[0].disposition,'owner_follow_up');
  mr(`delete from auth.sessions where id='${peers[0].session}';`);await assert.rejects(peerClients[0].list(),{code:'refused'});
  policy=await change(policy,{state:'closed',...liveBinding});await assert.rejects(peerClients[1].list(),{code:'unavailable'});await assert.rejects(reviewClient.list(),{code:'unavailable'});assert.equal((await call(1,'/feedback/ideas')).status,503);assert.equal((await call(1,'/me')).status,503);
  mr('update alliance_avatar.control set enabled=false,creation_enabled=false,profile_revision_enabled=false,cleanup_enabled=false;update alliance_community.control set enabled=false;update alliance_feedback.control set enabled=false;update alliance_report_review.control set enabled=false;');jr('update alliance_journal.control set enabled=false,admission_enabled=false;');
  console.log('PASS current SQL owner-session revocation blocks the owner queue despite an accepted Auth cookie; restored fixture session can read again; withdrawn signed authority closes profile, community, feedback and private review together');
  assert.ok(authorityExchanges>20);assert.equal(authorityHandler.nonceCount(),authorityExchanges);
  assert.equal(authorityHandler.secretReadCount(),2*authorityExchanges);
  await preview.close();assert.equal(mediaClosed,true);
  assert.equal((await app.handle(request('/me'),context)).status,503);
  console.log('PASS owned preview bundle: actual combined application, browser collaboration clients/two verified-cookie peers, profile/idea/private-report/owner-review journeys through real managed SQL; bundle shutdown retires media and application. API/Lambda/AWS/Secrets Manager responses and Auth remain synthetic, not hosted acceptance.');

 }finally{
  editor?.dispose();status?.dispose();remover?.dispose();app?.close();
  const cleanupErrors=[];
  for(const h of handles.reverse())try{await h.close();}catch{cleanupErrors.push('handle');}
  for(const d of domains.reverse())try{await d.close();}catch{cleanupErrors.push('domain');}
  if(cleanupErrors.length)throw Error('Disposable composed fixture cleanup failed: '+cleanupErrors.join(','));
 }
 console.log('PASS complete managed application fixtures, pools and ephemeral keys retired; zero hosted provider, mail or wallet calls');
}
