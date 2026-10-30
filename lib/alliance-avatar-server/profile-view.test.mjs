import test from 'node:test';
import assert from 'node:assert/strict';
import {createAllianceProfileView} from './profile-view.mjs';
import {journalFixture,event,chain,profileId,objectId,other} from './deletion-journal.fixture.mjs';
const self={kind:'self'},directory={kind:'directory',after:null,limit:2};
const row=(id=profileId)=>({id,name:'Fixture Reader',community:'',bio:'Synthetic restored text only.',role:'builder',listed:true,publication:'listed',updatedAt:'2026-10-17T16:00:00Z'});
const publicRow=(id=profileId)=>{const {publication,updatedAt,listed,...r}=row(id);return r;};
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:v=>resolve(v)};};
const tick=()=>new Promise(r=>setImmediate(r));
function fixture({events=[],review,authorize,options={}}={}){
  const signed=journalFixture({events}),calls=[];
  const viewer=createAllianceProfileView({enabled:true,journal:{review:args=>{calls.push('review');return review?review(args,signed):signed.client.review(args);}},serving:{authorize:()=>{calls.push('permit');return authorize?authorize():true;}},...options});
  return {viewer,signed,calls,close(){viewer.close();signed.client.close();}};
}
test('text guard defaults closed and validates authority dependencies and bounds',async()=>{
  for(const enabled of [undefined,false,'true']){const f=fixture({options:{enabled}});assert.deepEqual(await f.viewer.read(self,{load:()=>{throw Error();}}),{state:'unavailable'});assert.deepEqual(f.calls,[]);f.close();}
  for(const options of [{journal:{}},{serving:{}},{timeoutMs:0},{timeoutMs:8001}])assert.throws(()=>fixture({options}));
});
test('malformed mode, actor override, cursor, limit and pre-abort make no calls',async()=>{
  const f=fixture();for(const input of [{kind:'other'},{...self,actorId:other},{...directory,after:'bad'},{...directory,limit:21}])assert.deepEqual(await f.viewer.read(input,{load:()=>row()}),{state:'unavailable'});
  assert.deepEqual(await f.viewer.read(self,{load:()=>row(),signal:AbortSignal.abort()}),{state:'unavailable'});assert.deepEqual(f.calls,[]);f.close();
});
test('closed startup permit blocks all journal and source work',async()=>{
  const f=fixture({authorize:()=>false});assert.deepEqual(await f.viewer.read(self,{load:()=>{throw Error('unexpected load');}}),{state:'unavailable'});assert.deepEqual(f.calls,['permit']);f.close();
});
test('real signed empty history releases a copied DTO after two fresh reviews',async()=>{
  const f=fixture();let loads=0;const result=await f.viewer.read(self,{load:()=>{loads++;return {...row(),email:'PRIVATE',user_id:other};}});assert.deepEqual(result,{state:'ready',body:{profile:row()}});assert.equal(loads,1);assert.equal(f.calls.filter(x=>x==='review').length,2);assert.doesNotMatch(JSON.stringify(result),/PRIVATE|user_id/);f.close();
});
test('restored own text with a profile removal intent is withheld, never called missing',async()=>{
  const f=fixture({events:[event()]});assert.deepEqual(await f.viewer.read(self,{load:()=>row()}),{state:'withheld'});f.close();
});
test('image-only removal never hides the independent text profile',async()=>{
  const f=fixture({events:[event({kind:'image_remove_requested',objectId})]});assert.equal((await f.viewer.read(self,{load:()=>row()})).state,'ready');f.close();
});
test('a new removal recorded while text loads blocks the final response',async()=>{
  const f=fixture();const result=await f.viewer.read(self,{load:()=>{f.signed.history.push(chain([event()])[0]);return row();}});assert.deepEqual(result,{state:'withheld'});f.close();
});
test('directory suppresses restored names and emits only a surviving cursor',async()=>{
  const f=fixture({events:[event({profileId:other})]});const raw={items:[publicRow(),publicRow(other)],next:other};
  const result=await f.viewer.read(directory,{load:()=>raw});assert.deepEqual(result,{state:'ready',body:{items:[publicRow()],next:profileId}});assert.equal(JSON.stringify(result).includes(other),false);f.close();
});
test('a wholly suppressed continuing page is unavailable rather than false directory end',async()=>{
  const f=fixture({events:[event()]});assert.deepEqual(await f.viewer.read({...directory,limit:1},{load:()=>({items:[publicRow()],next:profileId})}),{state:'withheld'});f.close();
});
test('a suppressed final page is a real empty visible page and requires no refill',async()=>{
  const f=fixture({events:[event()]});let calls=0;assert.deepEqual(await f.viewer.read(directory,{load:()=>{calls++;return {items:[publicRow()],next:null};}}),{state:'ready',body:{items:[],next:null}});assert.equal(calls,1);f.close();
});
test('missing own profile is returned only after both signed reviews',async()=>{
  const f=fixture();assert.deepEqual(await f.viewer.read(self,{load:()=>null}),{state:'ready',body:{profile:null}});assert.equal(f.calls.filter(x=>x==='review').length,2);f.close();
});
test('malformed source DTOs and unsafe cursors never produce partial text',async()=>{
  for(const raw of [{},row('bad'),{...row(),bio:'<PRIVATE>'}]){const f=fixture();assert.deepEqual(await f.viewer.read(self,{load:()=>raw}),{state:'unavailable'});f.close();}
  for(const raw of [{items:[publicRow(),publicRow()],next:null},{items:[publicRow()],next:other},{items:[],next:other}]){const f=fixture();assert.deepEqual(await f.viewer.read(directory,{load:()=>raw}),{state:'unavailable'});f.close();}
});
test('unverified or failed second journal read cannot return already loaded text',async()=>{
  let n=0;const f=fixture({review:(args,signed)=>++n===2?{state:'unavailable'}:signed.client.review(args)});assert.deepEqual(await f.viewer.read(self,{load:()=>row()}),{state:'unavailable'});f.close();
});
test('unknown and malformed journal verdicts are unavailable, never absence',async()=>{
  for(const value of [{state:'allowed'},{state:'not_listed',extra:true},{state:'blocked',scope:'image'}]){const f=fixture({review:()=>({state:'verified_evidence',checkProfile:()=>value,close(){}})});assert.deepEqual(await f.viewer.read(self,{load:()=>row()}),{state:'unavailable'});f.close();}
});
test('late noncooperative source work cannot escape cancellation or run twice',async()=>{
  const gate=deferred(),c=new AbortController(),f=fixture();let loads=0;
  const pending=f.viewer.read(self,{load:()=>{loads++;c.abort();return gate.promise;},signal:c.signal});assert.deepEqual(await pending,{state:'unavailable'});gate.resolve(row());await tick();assert.equal(f.calls.filter(x=>x==='review').length,1);assert.equal(loads,1);assert.deepEqual(await f.viewer.read(self,{load:()=>row()}),{state:'unavailable'});f.close();
});
test('stalled first review times out and late completion cannot begin a load',async()=>{
  const gate=deferred(),f=fixture({review:()=>gate.promise,options:{timeoutMs:15}});let loads=0,closed=0;
  assert.deepEqual(await f.viewer.read(self,{load:()=>{loads++;return row();}}),{state:'unavailable'});gate.resolve({state:'verified_evidence',checkProfile:()=>({state:'not_listed'}),close(){closed++;}});await tick();assert.equal(loads,0);assert.equal(closed,1);f.close();
});
test('one in-flight operation refuses queues and close cancels it',async()=>{
  const f=fixture({review:()=>new Promise(()=>{})});const pending=f.viewer.read(self,{load:()=>row()});assert.deepEqual(await f.viewer.read(self,{load:()=>row()}),{state:'busy'});f.close();assert.deepEqual(await pending,{state:'unavailable'});
});
test('mutable upstream rows are copied before another dependency runs',async()=>{
  const raw=row();let reviews=0;const f=fixture({review:(args,signed)=>{if(++reviews===2)raw.bio='PRIVATE CHANGED AFTER LOAD';return signed.client.review(args);}});assert.deepEqual(await f.viewer.read(self,{load:()=>raw}),{state:'ready',body:{profile:row()}});f.close();
});
test('freeze after data arrives discards the text without another load',async()=>{
  let frozen=false;const f=fixture({authorize:()=>!frozen});assert.deepEqual(await f.viewer.read(self,{load:()=>{frozen=true;return row();}}),{state:'unavailable'});f.close();
});
