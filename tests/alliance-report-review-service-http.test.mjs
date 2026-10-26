import test from 'node:test';
import assert from 'node:assert/strict';
import {createAllianceReportReviewService} from '../lib/alliance-avatar-server/report-review-service.mjs';
import {createAllianceReportReviewHttp} from '../lib/alliance-report-review-http.mjs';
import {createAllianceReportReviewClient} from '../assets/federation/fed-alliance-report-review-client.mjs';
const origin='https://deploy-preview-124--gfof.netlify.app',url='https://abcdefghijklmnopqrst.supabase.co';
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const owner=id(1),session=id(2),reporter=id(3),target=id(4),reportId=id(5);
const key='sb_publishable_'+'f'.repeat(24),createdAt='2026-10-01T12:00:00.000Z';
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(){
 const calls=[],ctx={actorId:owner,sessionId:session,expiresAt:Date.now()+300000};let permitted=true,validSession=true,blocked=null,writeWork;
 const record={id:reportId,kind:'member',target,contextState:'available',contextLoaded:true,targetTitle:'Fictional target',targetSummary:'A fictional member context for the owner review.',createdAt,reviewedAt:null,disposition:'unreviewed',expiresAt:'2026-12-30T12:00:00.000Z'};
 const evidence=loaded=>({record:{...record,contextLoaded:loaded,...(!loaded?{targetTitle:null,targetSummary:null}:{})},evidenceProfiles:[reporter,target]});
 const store={listEvidence:async()=>{calls.push('list');return {items:[evidence(false)],next:null};},readEvidence:async()=>{calls.push('read');return evidence(true);},reviewEvidence:async(a,s,v)=>{calls.push('write');await writeWork?.();record.disposition=v.disposition;record.reviewedAt??=new Date().toISOString();record.expiresAt=new Date(Date.parse(record.reviewedAt)+30*86400000).toISOString();return evidence(true);}};
 const options={enabled:true,reviewerActor:owner,store,ledger:{authorizeAccountSession:async(a,s)=>{calls.push('session');if(!validSession)throw Object.assign(Error(),{outcome:'rejected'});return {actorId:a,sessionId:s};}},journal:{review:async()=>({state:'verified_evidence',checkProfile({profileId}){return blocked===profileId?{state:'blocked',scope:'profile'}:{state:'not_listed'};},close(){}})},serving:{authorizeReportReview:async()=>{calls.push('permission');return permitted;}}};
 const service=createAllianceReportReviewService(options);
 const token='header.'+Buffer.from(JSON.stringify({sub:owner,session_id:session,exp:Math.floor(ctx.expiresAt/1000),iss:url+'/auth/v1',role:'authenticated',aud:'authenticated'})).toString('base64url')+'.signature';
 const http=createAllianceReportReviewHttp({enabled:true,origin,url,key,service,fetcher:async()=>{calls.push('auth');return new Response(JSON.stringify({id:owner,email_confirmed_at:createdAt,is_anonymous:false,user_metadata:{admin:true}}));}});
 const fetcher=(endpoint,init)=>http.handle(new Request(endpoint,{...init,headers:{...init.headers,origin,'sec-fetch-site':'same-origin',cookie:'__Host-gf-access='+token}}));
 const client=createAllianceReportReviewClient({enabled:true,origin,fetcher});
 return {ctx,store,options,service,http,client,token,calls,record,evidence,fetcher,set blocked(v){blocked=v;},set permitted(v){permitted=v;},set validSession(v){validSession=v;},set writeWork(v){writeWork=v;},close(){client.close();http.close();service.close();}};
}
test('default-off components perform no provider or database work',async()=>{
 const service=createAllianceReportReviewService(),http=createAllianceReportReviewHttp(),client=createAllianceReportReviewClient();
 assert.deepEqual(await service.list(null),{state:'unavailable'});assert.equal((await http.handle(null)).status,404);await assert.rejects(client.list(),e=>e.code==='closed');service.close();http.close();client.close();
});
test('cookie client completes metadata queue, selected read and confirmed owner review',async()=>{
 const f=fixture();try{
  const page=await f.client.list();assert.equal(page.items.length,1);assert.equal(page.items[0].contextLoaded,false);
  assert.equal((await f.client.read(reportId)).targetTitle,'Fictional target');
  const r=await f.client.review({id:reportId,expected:'unreviewed',disposition:'owner_follow_up'});assert.equal(r.disposition,'owner_follow_up');assert.ok(r.reviewedAt);
  assert.doesNotMatch(JSON.stringify([page,r]),new RegExp(reporter+'|evidenceProfiles|reporter_actor'));
 }finally{f.close();}
});
test('only the configured reviewer and a current session reach report storage',async()=>{
 const f=fixture();try{
  assert.deepEqual(await f.service.list({...f.ctx,actorId:reporter}),{state:'refused'});assert.equal(f.calls.length,0);
  f.validSession=false;assert.deepEqual(await f.service.read(f.ctx,reportId),{state:'refused'});assert.ok(!f.calls.includes('read'));
 }finally{f.close();}
});
test('pending removal of either source profile prevents report output and a review write',async()=>{
 for(const profile of [reporter,target]){const f=fixture();try{f.blocked=profile;assert.deepEqual(await f.service.read(f.ctx,reportId),{state:'unavailable'});assert.deepEqual(await f.service.review(f.ctx,{id:reportId,expected:'unreviewed',disposition:'no_action'}),{state:'unavailable'});assert.ok(!f.calls.includes('write'));}finally{f.close();}}
});
test('signed serving withdrawal refuses storage and cannot auto-reopen',async()=>{
 const f=fixture();try{f.permitted=false;assert.deepEqual(await f.service.list(f.ctx),{state:'unavailable'});f.permitted=true;assert.deepEqual(await f.service.list(f.ctx),{state:'unavailable'});assert.ok(!f.calls.includes('list'));}finally{f.close();}
});
test('cross-site, caller bearer headers, absent cookies and invalid bodies refuse',async()=>{
 const f=fixture();try{
  const path=origin+'/api/alliance-members/report-review';
  for(const headers of [{origin:'https://other.example'},{origin,authorization:'Bearer private'},{origin}]){
   const r=await f.http.handle(new Request(path+'/reports',{headers}));assert.equal(r.status,headers.authorization||headers.origin!==origin?403:401);
  }
  const r=await f.http.handle(new Request(path+'/review',{method:'POST',headers:{origin,cookie:'__Host-gf-access='+f.token,'content-type':'application/json'},body:JSON.stringify({id:reportId,expected:'unreviewed',disposition:'no_action',owner:true})}));assert.equal(r.status,400);assert.equal(f.calls.length,0);
 }finally{f.close();}
});
test('private envelope fields cannot escape a malicious service reply',async()=>{
 const f=fixture(),http=createAllianceReportReviewHttp({enabled:true,origin,url,key,fetcher:async()=>new Response(JSON.stringify({id:owner,email_confirmed_at:createdAt,is_anonymous:false})),service:{list:async()=>({state:'ready',page:{items:[{...f.evidence(false).record,reporter}],next:null}}),read(){},review(){}}});
 try{const r=await http.handle(new Request(origin+'/api/alliance-members/report-review/reports',{headers:{origin,cookie:'__Host-gf-access='+f.token}}));assert.equal(r.status,503);assert.doesNotMatch(await r.text(),new RegExp(reporter));}finally{http.close();f.close();}
});
test('unknown write reply pauses the client until an explicit read; no resend occurs',async()=>{
 const f=fixture();let writes=0;
 const client=createAllianceReportReviewClient({enabled:true,origin,fetcher:async(endpoint,init)=>{const r=await f.fetcher(endpoint,init);if(init.method==='POST'){writes++;throw Error('lost reply');}return r;}});
 try{
  const command={id:reportId,expected:'unreviewed',disposition:'no_action'};
  await assert.rejects(client.review(command),e=>e.code==='unknown');await assert.rejects(client.review(command),e=>e.code==='unknown');assert.equal(writes,1);
  assert.equal((await client.read(reportId)).disposition,'no_action');assert.equal(writes,1);
 }finally{client.close();f.close();}
});
test('cancelled late read cannot return private report context',async()=>{
 const f=fixture(),c=new AbortController();let release;const wait=new Promise(r=>release=r);
 const client=createAllianceReportReviewClient({enabled:true,origin,fetcher:async(endpoint,init)=>{await wait;return f.fetcher(endpoint,{...init,signal:undefined});}});
 try{const p=client.read(reportId,{signal:c.signal});await tick();c.abort();await assert.rejects(p,e=>e.code==='cancelled');release();await tick();await tick();}finally{release();client.close();f.close();}
});
