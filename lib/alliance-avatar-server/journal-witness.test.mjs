import test from 'node:test';
import assert from 'node:assert/strict';
import {sign,generateKeyPairSync,verify,createPublicKey} from 'node:crypto';
import {createJournalWitness} from './journal-witness.mjs';
import {createAvatarDeletionJournal,deletionWitnessBytes} from './deletion-journal.mjs';
import {journalFixture,chain,event,projectRef,epoch,other,zero} from './deletion-journal.fixture.mjs';
const challenge='a'.repeat(64),tick=()=>new Promise(r=>setImmediate(r));
function fixture({events=[event()],tip,records,signer,...options}={}){
  const f=journalFixture({events}),calls=[];
  const current=()=>({projectRef,epoch,sequence:f.history.length,sha256:f.history.at(-1)?.sha256||zero,enabled:true});
  const store={async tip(args){calls.push('tip');return tip?tip(args,current()):current();},async records(end,args){calls.push('records');return records?records(end,args):f.history;}};
  const producer=createJournalWitness({enabled:true,projectRef,epoch,verificationKey:f.verificationKey,minimum:{sequence:0,sha256:zero},store,
    signBytes:async(bytes,args)=>{calls.push('sign');return signer?signer(bytes,args,f):f.signBytes(bytes);},...options});
  return {...f,producer,calls,current,close(){producer.close();f.client.close();}};
}
test('witness is closed by default without a store read or signer call',async()=>{
  for(const enabled of [undefined,false,'true']){const f=fixture({enabled});assert.deepEqual(await f.producer.issue({challenge}),{state:'unavailable'});assert.deepEqual(f.calls,[]);f.close();}
});
test('invalid scope, key, floor, dependencies and deadline refuse construction',()=>{
  for(const options of [{projectRef:'other'},{epoch:'other'},{verificationKey:'secret'},{minimum:{sequence:257,sha256:zero}},{minimum:{sequence:0,sha256:challenge}},{minimum:{sequence:1,sha256:zero,private:'no'}},{store:{}},{signBytes:null},{timeoutMs:0},{timeoutMs:3501}])assert.throws(()=>fixture(options),/alliance_journal_witness_unavailable/);
});
test('only a challenge is accepted; caller tip/time/scope cannot be signed',async()=>{
  const f=fixture();for(const input of [{challenge,sequence:1},{challenge,issuedAt:new Date().toISOString()},{challenge,projectRef},{challenge:'A'.repeat(64)},null])assert.deepEqual(await f.producer.issue(input),{state:'invalid'});assert.deepEqual(f.calls,[]);assert.equal((await f.producer.issue({challenge})).state,'signed');f.close();
});
test('actual canonical Ed25519 output is bounded and includes no intent records',async()=>{
  const f=fixture(),result=await f.producer.issue({challenge});assert.equal(result.state,'signed');assert.ok(result.bytes.length<=2048);
  const witness=JSON.parse(result.bytes),key=createPublicKey({format:'jwk',key:{kty:'OKP',crv:'Ed25519',x:Buffer.from(f.verificationKey,'hex').toString('base64url')}});
  assert.equal(verify(null,deletionWitnessBytes(witness.anchor),key,Buffer.from(witness.signature,'hex')),true);assert.equal(witness.anchor.challenge,challenge);assert.equal(witness.anchor.sha256,f.history[0].sha256);assert.equal(result.bytes.includes(event().profileId),false);assert.deepEqual(f.calls,['tip','records','sign','tip']);f.close();
});
test('actual producer output composes with the fresh-challenge deny-only reader',async()=>{
  const f=fixture(),reader=createAvatarDeletionJournal({enabled:true,projectRef,epoch,verificationKey:f.verificationKey,minimum:{sequence:0,sha256:zero},
    readWitness:async({challenge,signal})=>(await f.producer.issue({challenge},{signal})).bytes,readRecords:async()=>Buffer.from(JSON.stringify(f.history))});
  const view=await reader.review();assert.equal(view.state,'verified_evidence');assert.deepEqual(view.check({profileId:event().profileId,objectId:other}),{state:'blocked',scope:'profile'});view.close();reader.close();f.close();
});
test('empty genesis and paused history remain verifiable without enabling writes',async()=>{
  for(const events of [[],[event()]]){const f=fixture({events,tip:(_,t)=>({...t,enabled:false})});assert.equal((await f.producer.issue({challenge})).state,'signed');f.close();}
});
test('foreign or malformed store tips refuse before any signature and latch closed',async()=>{
  for(const change of [{projectRef:'z'.repeat(20)},{epoch:other},{sequence:257},{enabled:undefined},{extra:'private'}]){const f=fixture({tip:(_,t)=>({...t,...change})});assert.equal((await f.producer.issue({challenge})).state,'unavailable');assert.deepEqual(f.calls,['tip']);await f.producer.issue({challenge});assert.deepEqual(f.calls,['tip']);f.close();}
});
test('configured rollback and same-height fork refuse before loading history',async()=>{
  for(const minimum of [{sequence:2,sha256:challenge},{sequence:1,sha256:challenge}]){const f=fixture({minimum});assert.equal((await f.producer.issue({challenge})).state,'unavailable');assert.deepEqual(f.calls,['tip']);f.close();}
});
test('higher tips must extend the pinned prefix rather than only increase a counter',async()=>{
  const fork=chain([event({profileId:other})])[0],f=fixture({events:[event(),event({id:other})],minimum:{sequence:1,sha256:fork.sha256}});assert.equal((await f.producer.issue({challenge})).state,'unavailable');assert.deepEqual(f.calls,['tip','records']);f.close();
});
test('missing, altered, duplicate and oversized complete chains cannot reach signer',async()=>{
  const original=chain([event()])[0];
  for(const rows of [[],[{...original,sha256:zero}],[{...original,private:'hidden'}],[{...original,event:{...event(),private:'x'.repeat(262144)}}],chain([event(),event()])]){
    const f=fixture({events:rows.length===2?[event(),event()]:[event()],records:()=>rows});assert.equal((await f.producer.issue({challenge})).state,'unavailable');assert.deepEqual(f.calls,['tip','records']);f.close();
  }
});
test('full 256-record capacity remains readable and signable without pruning',async()=>{
  const events=Array.from({length:256},(_,i)=>event({id:i.toString(16).padStart(8,'0')+'-1111-4111-8111-111111111111'})),f=fixture({events});assert.equal((await f.producer.issue({challenge})).state,'signed');f.close();
});
test('a later rollback cannot lower the producer in-memory observed floor',async()=>{
  let rolled=false;const f=fixture({tip:(_,t)=>rolled?{...t,sequence:0,sha256:zero}:t});assert.equal((await f.producer.issue({challenge})).state,'signed');rolled=true;assert.equal((await f.producer.issue({challenge})).state,'unavailable');rolled=false;assert.equal((await f.producer.issue({challenge})).state,'unavailable');assert.equal(f.calls.filter(x=>x==='sign').length,1);f.close();
});
test('wrong-key, truncated and arbitrary signer responses cannot produce a witness',async()=>{
  const wrong=generateKeyPairSync('ed25519');for(const signer of [bytes=>sign(null,bytes,wrong.privateKey),()=>Buffer.alloc(63),()=>Buffer.alloc(65),()=>('secret'),()=>Buffer.alloc(64)]){const f=fixture({signer});assert.equal((await f.producer.issue({challenge})).state,'unavailable');assert.deepEqual(f.calls,['tip','records','sign']);f.close();}
});
test('signer mutation cannot replace the canonical message or caller challenge',async()=>{
  let finish;const gate=new Promise(r=>finish=r),f=fixture({signer:async(bytes,_,keys)=>{bytes.fill(0);await gate;return keys.signBytes(bytes);}}),input={challenge},pending=f.producer.issue(input);await tick();input.challenge='b'.repeat(64);finish();assert.equal((await pending).state,'unavailable');assert.deepEqual(f.calls,['tip','records','sign']);f.close();
});
test('tip movement during signing refuses without a new signature or retry',async()=>{
  let moved=false;const f=fixture({signer:(bytes,_,keys)=>{moved=true;return keys.signBytes(bytes);},tip:(_,t)=>moved?{...t,sequence:2,sha256:challenge}:t});assert.equal((await f.producer.issue({challenge})).state,'unavailable');assert.deepEqual(f.calls,['tip','records','sign','tip']);assert.equal((await f.producer.issue({challenge})).state,'unavailable');f.close();
});
test('one active attempt has no queue; pre-cancellation starts no work',async()=>{
  let finish;const gate=new Promise(r=>finish=r),f=fixture({signer:async(bytes,_,keys)=>{await gate;return keys.signBytes(bytes);}});
  assert.deepEqual(await f.producer.issue({challenge},{signal:AbortSignal.abort()}),{state:'cancelled'});assert.deepEqual(f.calls,[]);
  const pending=f.producer.issue({challenge});await tick();assert.deepEqual(await f.producer.issue({challenge}),{state:'busy'});finish();assert.equal((await pending).state,'signed');f.close();
});
test('deadline and late signer completion cannot cause a final read or another attempt',async()=>{
  let finish;const gate=new Promise(r=>finish=r),f=fixture({timeoutMs:20,signer:async(bytes,_,keys)=>{await gate;return keys.signBytes(bytes);}});
  assert.equal((await f.producer.issue({challenge})).state,'unavailable');finish();await tick();assert.deepEqual(f.calls,['tip','records','sign']);assert.equal((await f.producer.issue({challenge})).state,'unavailable');f.close();
});
test('abort and close cancel an active read without later signing or owning the store',async()=>{
  for(const kind of ['abort','close']){let finish;const gate=new Promise(r=>finish=r),f=fixture({records:async()=>{await gate;return chain([event()]);}}),c=new AbortController(),pending=f.producer.issue({challenge},{signal:c.signal});await tick();if(kind==='abort')c.abort();else f.producer.close();assert.equal((await pending).state,'unavailable');finish();await tick();assert.deepEqual(f.calls,['tip','records']);assert.equal((await f.producer.issue({challenge})).state,'unavailable');f.close();}
});
test('dependency errors remain sanitized and no automatic retry is made',async()=>{
  for(const phase of ['tip','records','signer']){const f=fixture({[phase]:()=>{throw Error('PRIVATE CREDENTIAL');}});assert.deepEqual(await f.producer.issue({challenge}),{state:'unavailable'});const count=f.calls.length;await f.producer.issue({challenge});assert.equal(f.calls.length,count);f.close();}
});
test('wall-clock movement during the final read refuses a stale/future witness',async()=>{
  const now=Date.now;try{for(const shift of [-5000,31000]){let reads=0;const f=fixture({tip:(_,t)=>{if(++reads===2)Date.now=()=>now()+shift;return t;}});assert.equal((await f.producer.issue({challenge})).state,'unavailable');Date.now=now;f.close();}}finally{Date.now=now;}
});
