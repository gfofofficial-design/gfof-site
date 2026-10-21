// Called inside the guarded disposable TLS fixture while a synthetic image is
// active. Auth, provider responses, startup gate and journal signer are fixtures.
import assert from 'node:assert/strict';
import {createAllianceAvatarMemberService} from './member.mjs';
import {createAllianceAvatarStorage} from '../alliance-avatar-storage.mjs';
import {journalFixture,event} from './deletion-journal.fixture.mjs';
export async function privateViewNative({admin,ledger,actor,session,operation,profileId,objectId,png}){
  const origin='https://deploy-preview-124--gfof.netlify.app',url='https://abcdefghijklmnopqrst.supabase.co',key='sb_publishable_synthetic_fixture_only_12345';
  const token='syntheticHeader.'+Buffer.from(JSON.stringify({sub:actor,session_id:session,iss:url+'/auth/v1',role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+120})).toString('base64url')+'.syntheticSignature';
  const req=()=>new Request(origin+'/api/alliance-members/me/image/content',{headers:{'Sec-Fetch-Site':'same-origin',Cookie:'__Host-gf-access='+token}}),input={operationId:operation};
  let calls=0,mode='normal';const head=await ledger.mineSession(actor,session);
  const storage=createAllianceAvatarStorage({enabled:true,origin:url,apiKey:key,bearerToken:'syntheticHeader.syntheticClaims.syntheticSignature',fetcher:async()=>{
    calls++;
    if(mode==='logout')admin(`delete from auth.sessions where id='${session}';`);
    if(mode==='head')admin(`update alliance_avatar.heads set version=version+1 where profile_id='${profileId}';`);
    return new Response(png,{headers:{'Content-Type':'image/png'}});
  }});
  const make=events=>{
    const signed=journalFixture({events});
    const service=createAllianceAvatarMemberService({enabled:true,viewEnabled:true,origin,url,key,ledger,storage,processor:{process(){throw Error('Read cannot decode an upload');}},journal:signed.client,serving:{authorize:async()=>true},fetcher:async()=>new Response(JSON.stringify({id:actor,is_anonymous:false,email_confirmed_at:'2026-10-17T12:00:00Z'}),{headers:{'Content-Type':'application/json'}})});
    return {service,close(){service.close();signed.client.close();}};
  };
  let f=make([]);
  try{
    const read=await f.service.handle(req(),input);assert.equal(read.state,'readable');assert.deepEqual(Buffer.from(await read.response.arrayBuffer()),png);assert.equal(read.response.headers.get('cache-control'),'private, no-store');assert.equal(calls,1);assert.deepEqual(await ledger.mineSession(actor,session),head);
    console.log('PASS actual member/TLS ledger/signed reader/gateway self-view returns only current verified private PNG without mutation');
  }finally{f.close();}
  for(const events of [[event({profileId})],[event({profileId,kind:'image_remove_requested',objectId})]]){
    f=make(events);try{assert.deepEqual(await f.service.handle(req(),input),{state:'unavailable'});assert.equal(calls,1);assert.deepEqual(await ledger.mineSession(actor,session),head);}finally{f.close();}
  }
  console.log('PASS independently signed profile or image denial blocks the actual member read despite an active SQL head, with no provider call');
  f=make([]);mode='logout';
  try{assert.deepEqual(await f.service.handle(req(),input),{state:'unavailable'});assert.equal(calls,2);}
  finally{mode='normal';f.close();admin(`insert into auth.sessions values('${session}','${actor}',null);`);}
  assert.deepEqual(await ledger.mineSession(actor,session),head);
  console.log('PASS actual SQL session removal during download discards image bytes even when synthetic Auth accepts the old cookie');
  f=make([]);mode='head';
  try{assert.deepEqual(await f.service.handle(req(),input),{state:'unavailable'});assert.equal(calls,3);}
  finally{mode='normal';f.close();admin(`update alliance_avatar.heads set version=${head.version} where profile_id='${profileId}';`);}
  assert.deepEqual(await ledger.mineSession(actor,session),head);
  console.log('PASS actual head movement during download discards image bytes; exact synthetic pointer and session changes are undone');
}
