// In-memory integration fixture only. No credential or provider endpoint works.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createAllianceMemberHttp} from '../lib/alliance-member-http.mjs';
import {createAllianceCreation} from '../lib/alliance-avatar-server/creation.mjs';
import {createAllianceAnchoredRemoval} from '../lib/alliance-avatar-server/anchored-removal.mjs';
import {memoryRemovalJournal} from '../lib/alliance-avatar-server/removal.fixture.mjs';
import {journalFixture,projectRef,epoch,zero} from '../lib/alliance-avatar-server/deletion-journal.fixture.mjs';
const {createHandler}=createRequire(import.meta.url)('../netlify/functions/federation-account.cjs');
export const origin='https://deploy-preview-124--gfof.netlify.app',url='https://abcdefghijklmnopqrst.supabase.co';
export const actor='11111111-1111-4111-8111-111111111111',session='22222222-2222-4222-8222-222222222222';
export const operation=n=>`${String(n).padStart(8,'0')}-5555-4555-8555-555555555555`;
export const fields=()=>({name:'Synthetic member',community:'Example crew',bio:'A fictional member used only for source integration checks.',role:'builder',listed:false});
const key='sb_publishable_synthetic_http_fixture_only';
const reject=()=>{throw Object.assign(Error('Synthetic SQL refusal'),{outcome:'rejected'});};
export function memberHttpFixture({authWork,afterFinish,timeoutMs}={}){
  let profile=null,revision=0,version=0,incarnation=0,activeSession=true,permit=true,authStatus=200,closed=0;
  const calls=[],operations=new Map(),saved=new Map(),routers=[];
  const signed=journalFixture({events:[]}),journal=memoryRemovalJournal();
  const append=journal.append.bind(journal);
  journal.append=async input=>{calls.push('journal-append');const result=await append(input);if(result.state==='recorded'&&!signed.history.some(r=>r.sequence===result.record.sequence))signed.history.push(result.record);return result;};
  journal.review=options=>signed.client.review(options);
  journal.admit=async event=>{calls.push('admit');return {state:'admitted',event};};
  journal.admission=async event=>({state:'admitted',event});
  const serving={authorize:async()=>permit,close(){closed++;}};
  const id=()=>`${String(30000000+incarnation).padStart(8,'0')}-3333-4333-8333-333333333333`;
  const context=(a,s)=>{assert.deepEqual([a,s],[actor,session]);if(!activeSession)reject();};
  const own=()=>{if(!profile)reject();};
  let anchor={format:1,memberProjectRef:projectRef,journalProjectRef:'uvwxyzabcdefghijklmn',epoch,sequence:0,sha256:zero};
  const ledger={
    authorizeAccountSession:async(a,s)=>{calls.push('current-session');context(a,s);return {actorId:a,sessionId:s};},
    authorizeSession:async(a,s)=>{context(a,s);own();return {actorId:a,sessionId:s,profileId:profile.id};},
    profileRevisionReadSession:async(a,s)=>{context(a,s);return structuredClone({profile,revision});},
    mineSession:async(a,s)=>{context(a,s);own();return {version,objectId:null,pending:[]};},
    prepareProfileSession:async(a,s)=>{context(a,s);return {kind:'profile',profileId:profile?.id||id(),objectId:null,operationId:null,version:0};},
    prepareImageSession:reject,creationStatusSession:reject,finishProfileSession:reject,finishImageSession:reject,
    finishProfileRevisionSession:async(a,s,plan,input,event,op,expected)=>{
      context(a,s);assert.equal(event.profileId,plan.profileId);calls.push('finish-profile');
      if(saved.has(op))return structuredClone(saved.get(op));
      if(revision!==expected)return {state:'conflict',revision};
      revision++;profile={id:plan.profileId,...input,publication:input.listed?'listed':'private',updatedAt:new Date().toISOString()};
      const result=structuredClone({state:'saved',profile,revision,operationId:op});saved.set(op,result);await afterFinish?.();return result;
    },
    prepareAnchoredRemovalSession:reject,
    prepareProfileBoundAnchoredRemovalSession:async(a,s,op,v,expectedId)=>{
      context(a,s);let entry=operations.get(op);
      if(entry){if(entry.plan.version!==v||entry.plan.profileId!==expectedId)reject();}
      else{own();if(profile.id!==expectedId||version!==v)reject();entry={plan:{format:1,kind:'profile',operationId:op,profileId:profile.id,version:v,objectIds:[]},committed:false};operations.set(op,entry);}
      calls.push('prepare-removal');return {state:'prepared',plan:structuredClone(entry.plan)};
    },
    finishAnchoredRemovalSession:async(a,s,op,plan,receipt,proof)=>{
      context(a,s);assert.equal(proof.sha256,anchor.sha256);assert.equal(receipt.records[0].sha256,journal.rows.at(-1).sha256);
      const entry=operations.get(op);assert.deepEqual(entry.plan,plan);calls.push('finish-removal');
      if(!entry.committed){own();assert.equal(profile.id,plan.profileId);profile=null;revision=0;version=0;incarnation++;entry.committed=true;}
      return {state:'committed',version:plan.version+1};
    },close(){closed++;},
  };
  for(const k of ['reserveSession','claimUploadSession','commitUploadSession','cancelReservedSession','operationReceiptSession','removeImageSession','settleUnpublished'])ledger[k]=reject;
  const creation=createAllianceCreation({enabled:true,profileRevisions:true,ledger,journal,serving});
  const anchorStore={read:async()=>structuredClone(anchor),advance:async value=>{anchor={...anchor,...value.through};return {state:'anchored',anchor:structuredClone(anchor)};}};
  const removal=createAllianceAnchoredRemoval({enabled:true,profileBinding:true,projectRef,journalProjectRef:anchor.journalProjectRef,epoch,minimum:{sequence:0,sha256:zero},ledger,journal,serving,anchorStore});
  const token='fixtureHeader.'+Buffer.from(JSON.stringify({sub:actor,session_id:session,iss:url+'/auth/v1',role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+300})).toString('base64url')+'.fixtureSignature';
  const provider=async(endpoint,init)=>{
    calls.push('auth');assert.equal(endpoint,url+'/auth/v1/user');assert.equal(init.headers.Authorization,'Bearer '+token);
    await authWork?.(init);return new Response(JSON.stringify({id:actor,email:'fixture@example.invalid',email_confirmed_at:'2026-10-21T12:00:00Z',is_anonymous:false,user_metadata:{admin:true}}),{status:authStatus});
  };
  const options={enabled:true,origin,url,key,ledger,journal,serving,creation,removal,processor:{process:reject},storage:{upload:reject},fetcher:provider,...(timeoutMs?{timeoutMs}:{})};
  const http=createAllianceMemberHttp(options);routers.push(http);
  const account=createHandler({env:{FEDERATION_ACCOUNT_ENABLED:'true',FEDERATION_ACCOUNT_ORIGIN:origin,FEDERATION_AUTH_URL:url,FEDERATION_AUTH_PUBLISHABLE_KEY:key,CONTEXT:'deploy-preview',DEPLOY_PRIME_URL:origin},fetchImpl:provider});
  function request(path='/me',{method='GET',body,headers={},signal,cookie=true}={}){
    return new Request(origin+'/api/alliance-members'+path,{method,headers:{origin,'sec-fetch-site':'same-origin',...(cookie?{cookie:'__Host-gf-access='+token}:{}),...(body!==undefined?{'content-type':'application/json'}:{}),...headers},...(body!==undefined?{body:typeof body==='string'?body:JSON.stringify(body)}:{}),...(signal?{signal}:{})});
  }
  const fetcher=async(endpoint,init)=>{
    if(endpoint===origin+'/api/federation-account/session'){
      const result=await account({path:'/api/federation-account/session',httpMethod:'GET',rawUrl:endpoint,headers:{cookie:'__Host-gf-access='+token}});
      return new Response(result.body,{status:result.statusCode,headers:result.headers});
    }
    assert.equal(new URL(endpoint).origin,origin);
    return http.handle(new Request(endpoint,{...init,headers:{...init.headers,origin,'sec-fetch-site':'same-origin',cookie:'__Host-gf-access='+token}}));
  };
  return {http,options,request,fetcher,token,calls,journal,get profile(){return structuredClone(profile);},get revision(){return revision;},get anchor(){return structuredClone(anchor);},get dependencyCloses(){return closed;},
    set activeSession(v){activeSession=v;},set permitted(v){permit=v;},set authStatus(v){authStatus=v;},
    another(){const router=createAllianceMemberHttp(options);routers.push(router);return router;},
    close(){for(const r of routers)r.close();creation.close();removal.close();signed.client.close();}};
}
