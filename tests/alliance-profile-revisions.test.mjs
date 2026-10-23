import test from 'node:test';
import assert from 'node:assert/strict';
import {profileRevisionRequest,profileRevisionSnapshot,profileRevisionResult} from '../assets/federation/fed-alliance-profile-revision-contract.mjs';
import {createMemberProfileClient} from '../assets/federation/fed-alliance-member-client.mjs';
import {createAllianceProfileApi} from '../lib/alliance-profile-api.mjs';
import {createAllianceCreation} from '../lib/alliance-avatar-server/creation.mjs';
import {journalFixture,event,chain} from '../lib/alliance-avatar-server/deletion-journal.fixture.mjs';
const origin='https://deploy-preview-124--gfof.netlify.app',url='https://abcdefghijklmnopqrst.supabase.co',key='sb_publishable_synthetic_profile_revision_fixture';
const actor='11111111-1111-4111-8111-111111111111',session='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333';
const op=n=>`${String(n).padStart(8,'0')}-5555-4555-8555-555555555555`;
const fields=()=>({name:'Revision Member',community:'',bio:'Synthetic member profile revision example.',role:'builder',listed:false});
const profile=()=>({id,...fields(),publication:'private',updatedAt:'2026-10-20T12:00:00Z'});
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
const tick=()=>new Promise(r=>setImmediate(r));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function system({afterFinish,wrap,authorize}={}){
 let stored=null,revision=0,next=0,mutations=0,finishes=0;const requests=[],creators=[],apis=[],clients=[],auth=[];
 const signed=journalFixture({events:[]}),serving={authorize:()=>true};
 const plan={kind:'profile',profileId:id,objectId:null,operationId:null,version:0};
 const ledger={
  authorizeAccountSession:async(a,s)=>authorize?authorize(a,s):({actorId:a,sessionId:s}),
  profileRevisionReadSession:async(a,s)=>{assert.deepEqual([a,s],[actor,session]);return structuredClone({profile:stored,revision});},
  prepareProfileSession:async()=>plan,prepareImageSession:async()=>{throw Error('unused');},creationStatusSession:async()=>plan,
  finishProfileSession:async()=>{throw Error('legacy path must stay unused');},finishImageSession:async()=>{throw Error('unused');},
  finishProfileRevisionSession:async(a,s,p,input,e,operationId,expected)=>{
   assert.deepEqual([a,s],[actor,session]);assert.deepEqual(p,plan);assert.equal(e.profileId,id);finishes++;
   if(expected!==revision)return {state:'conflict',revision};
   revision++;mutations++;stored={id,...input,publication:input.listed?'listed':'private',updatedAt:new Date(Date.UTC(2026,9,20,12,0,revision)).toISOString()};
   const out=structuredClone({state:'saved',profile:stored,revision,operationId});await afterFinish?.({signed,id});return out;
  },
 };
 const token='fixture.'+Buffer.from(JSON.stringify({sub:actor,session_id:session,iss:url+'/auth/v1',role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+120})).toString('base64url')+'.signature';
 function client(){
  const creator=createAllianceCreation({enabled:true,profileRevisions:true,ledger,journal:{admit:async e=>({state:'admitted',event:e}),admission:async e=>({state:'admitted',event:e})},serving});creators.push(creator);
  const api=createAllianceProfileApi({enabled:true,profileRevisions:true,origin,url,key,ledger,creation:creator,journal:signed.client,serving,fetcher:async(endpoint)=>{auth.push(endpoint);assert.equal(endpoint,url+'/auth/v1/user');return json({id:actor,email_confirmed_at:'2026-10-20T12:00:00Z',is_anonymous:false,user_metadata:{admin:true}});}});apis.push(api);
  const states=[];
  const c=createMemberProfileClient({enabled:true,profileRevisions:true,origin,newOperationId:()=>op(++next),onState:s=>states.push(s),fetcher:async(endpoint,init)=>{
   requests.push({endpoint,init});assert.equal(init.headers.Authorization,undefined);
   const dispatch=()=>api(new Request(endpoint,{...init,headers:{...init.headers,Origin:origin,'Sec-Fetch-Site':'same-origin',Cookie:'__Host-gf-access='+token}}));
   return wrap?wrap(dispatch,init):dispatch();
  }});clients.push(c);return {client:c,states,api};
 }
 return {client,requests,ledger,auth,get revision(){return revision;},get stored(){return stored;},get mutations(){return mutations;},get finishes(){return finishes;},close(){for(const c of clients)c.dispose();for(const c of creators)c.close();for(const a of apis)a.close();signed.client.close();}};
}

test('revision contracts reject ambiguous shapes and strip private fields from profile DTOs',()=>{
 const request={operationId:op(1),revision:0,profile:fields()};assert.deepEqual(profileRevisionRequest(request),request);
 for(const v of [{...request,actorId:actor},{...request,revision:-1},{...request,revision:Number.MAX_SAFE_INTEGER},{...request,operationId:'00000000-0000-0000-0000-000000000000'}])assert.throws(()=>profileRevisionRequest(v));
 for(const v of [{profile:null,revision:1},{profile:profile(),revision:0},{profile:null,revision:0,hash:'PRIVATE'}])assert.throws(()=>profileRevisionSnapshot(v));
 assert.deepEqual(profileRevisionResult({state:'saved',profile:{...profile(),email:'PRIVATE'},operationId:op(1),revision:1}),{state:'saved',profile:profile(),operationId:op(1),revision:1});
 assert.throws(()=>profileRevisionResult({state:'conflict',revision:1,profile:profile()}));
});
test('revision mode is explicit and missing coherent read dependency closes before Auth',async()=>{
 assert.throws(()=>createMemberProfileClient({profileRevisions:'true'}));assert.throws(()=>createAllianceProfileApi({profileRevisions:'true'}));
 let calls=0;const signed=journalFixture({events:[]});const api=createAllianceProfileApi({enabled:true,profileRevisions:true,origin,url,key,journal:signed.client,serving:{authorize:()=>true},ledger:{authorizeAccountSession(){}},fetcher:()=>{calls++;throw Error();}});
 assert.equal((await api(new Request(origin+'/api/alliance-members/me'))).status,503);assert.equal(calls,0);api.close();signed.client.close();
});
test('client → cookie Auth → admitted coordinator supports create, repeat edit and unlist without owner-review RPCs',async()=>{
 const f=system();try{const {client,states}=f.client();assert.throws(()=>client.save(fields()),{code:'read_required'});assert.deepEqual(await client.load(),{profile:null,revision:0});
  const data=fields();assert.equal((await client.save(data)).revision,1);assert.equal((await client.save({...data,name:'Second ordinary edit',listed:true})).revision,2);assert.equal((await client.save({...data,name:'Unlisted again'})).revision,3);
  assert.equal(f.stored.listed,false);assert.equal(f.mutations,3);assert.equal(states.at(-1).status,'saved');assert.equal(data.name,'Revision Member');
  assert.equal(f.requests.filter(r=>r.init.method==='POST').length,3);assert.ok(f.requests.every(r=>r.init.credentials==='same-origin'));assert.doesNotMatch(JSON.stringify(states),/session_id|inputSha256|user_metadata|PRIVATE/);
 }finally{f.close();}
});
test('two editors conflict without overwrite; loading a comparison cannot silently unlock another save',async()=>{
 const f=system();try{const a=f.client(),b=f.client();await a.client.load();await b.client.load();await a.client.save(fields());
  const draft={...fields(),name:'Retained second editor draft'};assert.deepEqual(await b.client.save(draft),{state:'conflict',revision:1});assert.equal(f.mutations,1);assert.equal(b.states.at(-1).status,'conflict');
  const before=f.requests.length;await assert.rejects(b.client.save(draft),{code:'conflict'});assert.equal(f.requests.length,before);
  const current=await b.client.load();assert.equal(b.states.at(-1).status,'comparison_ready');await assert.rejects(b.client.save(draft),{code:'conflict'});
  assert.throws(()=>b.client.acceptCurrent(0),{code:'read_required'});const requests=f.requests.length;b.client.acceptCurrent(current.revision);assert.equal(f.requests.length,requests);assert.equal(b.states.at(-1).status,'current_accepted');assert.equal(draft.name,'Retained second editor draft');
  assert.equal((await b.client.save(draft)).revision,2);assert.equal(f.stored.name,draft.name);
 }finally{f.close();}
});
test('lost response stays unknown through an explicit read until current version is confirmed; no automatic retry',async()=>{
 let lost=false;const f=system({wrap:async(dispatch,init)=>{const response=await dispatch();if(init.method==='POST'&&!lost){lost=true;throw Error('PRIVATE transport');}return response;}});
 try{const a=f.client();await a.client.load();await assert.rejects(a.client.save(fields()),{code:'unknown'});assert.equal(f.mutations,1);const before=f.requests.length;await assert.rejects(a.client.save(fields()),{code:'unknown'});assert.equal(f.requests.length,before);
  const ref=a.client.unconfirmedSave();assert.deepEqual(ref,{operationId:op(1),revision:0});ref.revision=99;assert.equal(a.client.unconfirmedSave().revision,0);
  const current=await a.client.load();assert.equal(current.revision,1);assert.equal(a.states.at(-1).status,'comparison_ready');await assert.rejects(a.client.save(fields()),{code:'unknown'});a.client.acceptCurrent(1);assert.equal(a.client.unconfirmedSave(),null);
  const b=f.client();await b.client.load();await b.client.save({...fields(),name:'Newer change'});
  assert.deepEqual(await a.client.save({...fields(),name:'Cannot overwrite newer change'}),{state:'conflict',revision:2});assert.equal(f.stored.name,'Newer change');assert.doesNotMatch(JSON.stringify(a.states),/PRIVATE/);
 }finally{f.close();}
});
test('cancelling a committed-but-delayed response cannot display a late success or erase uncertainty',async()=>{
 const committed=deferred(),release=deferred();const f=system({wrap:async(dispatch,init)=>{const r=await dispatch();if(init.method==='POST'){committed.resolve();await release.promise;}return r;}});
 try{const a=f.client();await a.client.load();const writing=a.client.save(fields());await committed.promise;a.client.cancel();await assert.rejects(writing,{code:'unknown'});release.resolve();await tick();assert.equal(a.states.at(-1).status,'unknown');assert.equal(f.mutations,1);
  await a.client.load();assert.equal(a.states.at(-1).status,'comparison_ready');await assert.rejects(a.client.save(fields()),{code:'unknown'});
 }finally{release.resolve();f.close();}
});
test('wrong saved operation/revision and malformed conflicts are unknown, never a successful save',async()=>{
 for(const result of [{state:'saved',operationId:op(99),revision:1,profile:profile()},{state:'saved',operationId:op(1),revision:2,profile:profile()},{state:'conflict',revision:1,private:'PRIVATE'}]){
  const states=[];let n=0;const client=createMemberProfileClient({enabled:true,profileRevisions:true,origin,newOperationId:()=>op(1),onState:s=>states.push(s),fetcher:async()=>++n===1?json({profile:null,revision:0}):json(result,result.state==='conflict'?409:200)});
  await client.load();await assert.rejects(client.save(fields()),{code:'unknown'});assert.equal(states.at(-1).status,'unknown');client.dispose();
 }
});
test('journal removal recorded during a revision write withholds the committed profile and leaves caller uncertain',async()=>{
 const f=system({afterFinish:({signed,id})=>signed.history.push(chain([event({profileId:id})])[0])});try{const a=f.client();await a.client.load();await assert.rejects(a.client.save(fields()),{code:'unknown'});assert.equal(f.mutations,1);assert.equal(a.states.at(-1).status,'unknown');assert.ok(!a.states.some(s=>s.status==='saved'));
 }finally{f.close();}
});
test('session revocation after the new SQL write cannot release its profile or claim a confirmed save',async()=>{
 let revoked=false;const f=system({afterFinish:()=>{revoked=true;},authorize:(a,s)=>revoked?null:({actorId:a,sessionId:s})});
 try{const a=f.client();await a.client.load();await assert.rejects(a.client.save(fields()),{code:'unknown'});assert.equal(f.mutations,1);assert.equal(a.states.at(-1).status,'unknown');assert.ok(!a.states.some(s=>s.status==='saved'));}finally{f.close();}
});
