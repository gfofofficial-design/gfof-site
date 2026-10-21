import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,verify} from 'node:crypto';
import {rootCertificates} from 'node:tls';
import {performance} from 'node:perf_hooks';
import {EventEmitter} from 'node:events';
import {controlPolicy,controlPolicySha256} from './control-policy.mjs';
import {createAllianceControlStore,createAllianceAnchorStore} from './control-store.mjs';
import {createAllianceControlAuthority} from './control-authority.mjs';
import {startupDecisionBytes} from './startup-gate.mjs';
import {chain,event,projectRef as memberProjectRef,epoch,other,zero} from './deletion-journal.fixture.mjs';
const journalProjectRef='uvwxyzabcdefghijklmn',controlProjectRef='opqrstuvwxyzabcdefgh',scope={memberProjectRef,journalProjectRef,controlProjectRef,epoch};
const connection={host:`db.${controlProjectRef}.supabase.co`,password:'synthetic-control-reader-password-only',ca:rootCertificates[0]};
const makeRow=(change={})=>{const v={format:1,memberProjectRef,journalProjectRef,epoch,revision:2,state:'review',changeId:other,freezeId:other,frozenAt:'2026-01-01T00:00:00.000Z',checkpointSha256:'f'.repeat(64),floor:{sequence:1,sha256:chain([event()])[0].sha256},...change};return {...v,sha256:controlPolicySha256(v)};};
const identity=()=>({database:'postgres',actor:'alliance_control_reader',login:'alliance_control_reader',tls:true,restricted:true,isolated:true,limited:true,durable:true,dedicated:true});
const tick=()=>new Promise(r=>setImmediate(r)),deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve};},reject=p=>assert.rejects(p,e=>e.message==='alliance_control_unavailable'&&!e.cause);
async function reader({row=makeRow(),who=identity(),run,acquire,end,factory=createAllianceControlStore,...options}={}){
 const calls=[],releases=[];let config,opened=0;
 const client=Object.assign(new EventEmitter(),{query:async q=>{calls.push(q);if(run)return run(q,client);if(q.text.startsWith('select current_database'))return {rows:[who]};if(q.text.startsWith('SELECT alliance_control.'))return {rows:[{result:row}]};return {command:q.text==='COMMIT'?'COMMIT':'SET'};},release:v=>releases.push(v)});
 const store=await factory({enabled:true,...scope,connection,timeoutMs:100,openPool:c=>{config=c;return {on(){},connect(){opened++;return acquire?acquire(client):client;},end(){return end?.();}};},...options});return {store,calls,releases,get config(){return config;},get opened(){return opened;}};
}
function authority({read=()=>makeRow(),signer,minimum,...options}={}){
 const pair=generateKeyPairSync('ed25519'),verificationKey=Buffer.from(pair.publicKey.export({format:'jwk'}).x,'base64url').toString('hex'),calls=[];
 const first=makeRow(),pin=minimum||{revision:first.revision,sha256:first.sha256,floor:first.floor};
 const instance=createAllianceControlAuthority({enabled:true,...scope,verificationKey,minimum:pin,store:{read:async o=>{calls.push('read');return read(o,calls.filter(x=>x==='read').length);}},signBytes:async(bytes,o)=>{calls.push('sign');return signer?signer(bytes,o,pair):sign(null,bytes,pair.privateKey);},...options});
 const request={format:1,memberProjectRef,journalProjectRef,epoch,bootId:'a'.repeat(64),challenge:'b'.repeat(64)};
 return {instance,request,pair,calls};
}
test('control row canonical digest is order-independent and strict about all content and bootstrap nulls',()=>{
 const r=makeRow();assert.deepEqual(controlPolicy(r),r);assert.deepEqual(controlPolicy(Object.fromEntries(Object.entries(r).reverse())),r);
 for(const v of [{...r,sha256:'a'.repeat(64)},{...r,secret:'PRIVATE'},{...r,revision:0},{...r,floor:{sequence:0,sha256:'f'.repeat(64)}},{...r,freezeId:null}])assert.throws(()=>controlPolicy(v));
 const empty=makeRow({revision:1,state:'closed',freezeId:null,frozenAt:null,checkpointSha256:null,floor:{sequence:0,sha256:zero}});assert.equal(controlPolicy(empty).state,'closed');
});
test('control reader defaults closed without opening a pool or establishing genesis',async()=>{
 for(const enabled of [undefined,false,'true']){const f=await reader({enabled});await reject(f.store.read());assert.equal(f.opened,0);assert.equal(f.config,undefined);await f.store.close();}
});
test('control reader pins three different domains, exact host, certificate and credential bounds',async()=>{
 for(const options of [{controlProjectRef:memberProjectRef},{journalProjectRef:memberProjectRef},{connection:{...connection,host:'db.uvwxyzabcdefghijklmn.supabase.co'}},{connection:{...connection,password:'short'}},{connection:{...connection,ca:'bad'}},{connection:{...connection,extra:true}},{timeoutMs:1501}])await reject(reader(options));
 const f=await reader();assert.equal(f.config.user,'alliance_control_reader');assert.equal(f.config.ssl.rejectUnauthorized,true);assert.equal(f.config.ssl.servername,connection.host);assert.equal(f.config.enableChannelBinding,true);assert.equal(f.config.max,2);await f.store.close();
});
test('reader performs fixed read-only transaction and returns only validated committed policy',async()=>{
 const f=await reader(),v=await f.store.read();assert.deepEqual(v,makeRow());assert.equal(f.calls[0].text,'BEGIN READ ONLY');assert.deepEqual(f.calls[3],{text:'SELECT alliance_control.read_policy($1::text,$2::text,$3::uuid) AS result',values:[memberProjectRef,journalProjectRef,epoch]});assert.equal(f.calls[4].text,'COMMIT');assert.deepEqual(f.releases,[false]);await f.store.close();
});
test('TLS, role, membership, grant, durability and domain mismatch stop before policy data',async()=>{
 for(const field of ['tls','restricted','isolated','limited','durable','dedicated','actor','login','database']){const f=await reader({who:{...identity(),[field]:false}});await reject(f.store.read());assert.equal(f.calls.length,3);assert.deepEqual(f.releases,[true]);await f.store.close();}
});
test('malformed, oversized, private or wrong-scope rows do not return data or send COMMIT',async()=>{
 for(const row of [{...makeRow(),extra:'PRIVATE'},{...makeRow(),sha256:'f'.repeat(64)},makeRow({memberProjectRef:'zzzzzzzzzzzzzzzzzzzz'}),{PRIVATE:'x'.repeat(8193)}]){const f=await reader({row});await reject(f.store.read());assert.equal(f.calls.length,4);await f.store.close();}
});
test('lost COMMIT response cannot return a policy or trigger another transaction',async()=>{
 const f=await reader({run:q=>{if(q.text.startsWith('select current_database'))return {rows:[identity()]};if(q.text.startsWith('SELECT alliance_control.'))return {rows:[{result:makeRow()}]};if(q.text==='COMMIT')throw Error('PRIVATE endpoint');return {command:'SET'};}});await reject(f.store.read());assert.equal(f.calls.length,5);assert.deepEqual(f.releases,[true]);await f.store.close();
});
test('checked-out client error aborts a stalled read without an unhandled event or later COMMIT',async()=>{
 let seen;const f=await reader({run:(q,client)=>{seen=client;if(q.text.startsWith('select current_database'))return {rows:[identity()]};if(q.text.startsWith('SELECT alliance_control.')){client.emit('error',Error('PRIVATE'));return new Promise(()=>{});}return {command:'SET'};}});
 await reject(f.store.read());assert.equal(f.calls.length,4);assert.deepEqual(f.releases,[true]);assert.equal(seen.listenerCount('error'),0);await f.store.close();
});
test('late acquisition is destroyed and cancellation never starts SQL after the bounded read',async()=>{
 const wait=deferred();let lateClient;const f=await reader({timeoutMs:10,acquire:c=>{lateClient=c;return wait.promise;}});await reject(f.store.read());wait.resolve(lateClient);await tick();assert.equal(f.calls.length,0);assert.deepEqual(f.releases,[true]);await f.store.close();
 const g=await reader();await reject(g.store.read({signal:AbortSignal.abort()}));assert.equal(g.opened,0);await g.store.close();
});
test('two active reader calls refuse a third unbounded queue and close aborts both',async()=>{
 const f=await reader({run:()=>new Promise(()=>{})}),a=f.store.read(),b=f.store.read();await reject(f.store.read());await f.store.close();await reject(a);await reject(b);assert.equal(f.opened,2);
});
test('authority defaults off and validates independent pin, signer and request without reads',async()=>{
 for(const enabled of [undefined,false,'true']){const f=authority({enabled});assert.deepEqual(await f.instance.issue(f.request),{state:'unavailable'});assert.deepEqual(f.calls,[]);}
 for(const options of [{minimum:undefined,store:{}},{minimum:{revision:0,sha256:zero,floor:{sequence:0,sha256:zero}}},{verificationKey:'bad'},{timeoutMs:3501}])assert.throws(()=>authority(options));
 const f=authority();assert.deepEqual(await f.instance.issue({...f.request,revision:2}),{state:'invalid'});assert.deepEqual(f.calls,[]);
});
test('authority signs exact request from committed current row and verifies final durable policy',async()=>{
 const f=authority(),r=await f.instance.issue(f.request);assert.equal(r.state,'signed');const envelope=JSON.parse(r.bytes);assert.equal(envelope.decision.revision,2);assert.equal(envelope.decision.state,'review');assert.equal(envelope.decision.challenge,f.request.challenge);assert.equal(verify(null,startupDecisionBytes(envelope.decision),f.pair.publicKey,Buffer.from(envelope.signature,'hex')),true);assert.deepEqual(f.calls,['read','sign','read']);f.instance.close();
});
test('missing authority, closed bootstrap and regressed/forked persisted pins refuse without signing',async()=>{
 for(const read of [()=>{throw Error('PRIVATE');},()=>makeRow({revision:1}),()=>makeRow({state:'closed'}),()=>makeRow({floor:{sequence:0,sha256:zero}}),()=>makeRow({state:'closed',revision:1,freezeId:null,frozenAt:null,checkpointSha256:null,floor:{sequence:0,sha256:zero}})]){const f=authority({read});assert.deepEqual(await f.instance.issue(f.request),{state:'unavailable'});assert.deepEqual(f.calls,['read']);assert.deepEqual(await f.instance.issue(f.request),{state:'unavailable'});}
});
test('explicit closure is signed when independently pinned current policy is already closed',async()=>{
 const row=makeRow({state:'closed',revision:3}),f=authority({read:()=>row,minimum:{revision:row.revision,sha256:row.sha256,floor:row.floor}});assert.equal(JSON.parse((await f.instance.issue(f.request)).bytes).decision.state,'closed');
});
test('closure or any policy update during signing discards an otherwise valid signature',async()=>{
 const f=authority({read:(o,n)=>makeRow(n===2?{revision:3,state:'closed'}:{})});assert.deepEqual(await f.instance.issue(f.request),{state:'unavailable'});assert.deepEqual(f.calls,['read','sign','read']);assert.deepEqual(await f.instance.issue(f.request),{state:'unavailable'});
});
test('wrong or malformed signing capability is never accepted as an authority receipt',async()=>{
 for(const signer of [()=>Buffer.alloc(64),()=>Buffer.alloc(63),()=>{throw Error('PRIVATE');}]){const f=authority({signer});assert.deepEqual(await f.instance.issue(f.request),{state:'unavailable'});assert.deepEqual(f.calls,['read','sign']);}
});
test('late signer cannot trigger final read or a later retry after cancellation',async()=>{
 const wait=deferred(),f=authority({signer:()=>wait.promise,timeoutMs:10});assert.deepEqual(await f.instance.issue(f.request),{state:'unavailable'});wait.resolve(Buffer.alloc(64));await tick();assert.deepEqual(f.calls,['read','sign']);assert.deepEqual(await f.instance.issue(f.request),{state:'unavailable'});
});
test('authority refuses concurrent queue, copies caller request and closes in-flight work',async()=>{
 const wait=deferred(),f=authority({read:()=>wait.promise}),pending=f.instance.issue(f.request);f.request.challenge=zero;assert.deepEqual(await f.instance.issue(f.request),{state:'busy'});f.instance.close();assert.deepEqual(await pending,{state:'unavailable'});wait.resolve(makeRow());await tick();assert.deepEqual(f.calls,['read']);
});
test('a restarted authority still refuses an older store when provided an independent newer pin',async()=>{
 const newer=makeRow({revision:3,state:'closed'}),f=authority({minimum:{revision:3,sha256:newer.sha256,floor:newer.floor}});assert.deepEqual(await f.instance.issue(f.request),{state:'unavailable'});assert.deepEqual(f.calls,['read']);
});
test('event-loop blocking cannot extend the authority signing deadline',async()=>{
 const f=authority({timeoutMs:5,read:()=>{const start=performance.now();while(performance.now()-start<15){}return makeRow();}});assert.deepEqual(await f.instance.issue(f.request),{state:'unavailable'});assert.deepEqual(f.calls,['read']);
});
const anchorRow=(sequence=0,sha256=zero)=>({format:1,memberProjectRef,journalProjectRef,epoch,sequence,sha256});
const anchorInput=()=>{const records=chain([event()]);return {expected:{sequence:0,sha256:zero},through:{sequence:1,sha256:records[0].sha256},records};};
test('anchor reader has no write activation and uses one fixed committed read-only call',async()=>{
 const f=await reader({factory:createAllianceAnchorStore,row:anchorRow()});await reject(f.store.advance(anchorInput()));assert.equal(f.opened,0);assert.deepEqual(await f.store.read(),anchorRow());assert.equal(f.calls[3].text,'SELECT alliance_control.read_anchor($1::text,$2::text,$3::uuid) AS result');assert.equal(f.calls[0].text,'BEGIN READ ONLY');await f.store.close();
});
test('dedicated anchor writer binds complete chain and both points, returning only confirmed COMMIT',async()=>{
 const v=anchorInput(),f=await reader({factory:createAllianceAnchorStore,writeEnabled:true,who:{...identity(),actor:'alliance_control_anchor_writer',login:'alliance_control_anchor_writer'},row:{state:'anchored',anchor:anchorRow(v.through.sequence,v.through.sha256)}});
 const out=await f.store.advance(v);assert.equal(out.state,'anchored');assert.equal(f.config.user,'alliance_control_anchor_writer');assert.equal(f.calls[0].text,'BEGIN');assert.match(f.calls[3].text,/advance_anchor/);assert.deepEqual(f.calls[3].values.slice(3,7),[0,zero,1,v.through.sha256]);assert.equal(f.calls.at(-1).text,'COMMIT');await f.store.close();
});
test('incomplete/forked anchor inputs fail before acquisition and grant checks remain mandatory',async()=>{
 const f=await reader({factory:createAllianceAnchorStore,writeEnabled:true});const v=anchorInput();v.records=[];await reject(f.store.advance(v));assert.equal(f.opened,0);await f.store.close();
 const g=await reader({factory:createAllianceAnchorStore,writeEnabled:true,who:{...identity(),actor:'alliance_control_anchor_writer',login:'alliance_control_anchor_writer',limited:false}});await reject(g.store.advance(anchorInput()));assert.equal(g.calls.length,3);await g.store.close();
});
test('wrong anchor response or lost COMMIT acknowledgement remains unknown without retry',async()=>{
 const v=anchorInput(),who={...identity(),actor:'alliance_control_anchor_writer',login:'alliance_control_anchor_writer'};
 const f=await reader({factory:createAllianceAnchorStore,writeEnabled:true,who,row:{state:'anchored',anchor:anchorRow()}});await assert.rejects(f.store.advance(v),e=>e.outcome==='unknown');assert.equal(f.calls.length,4);await f.store.close();
 const g=await reader({factory:createAllianceAnchorStore,writeEnabled:true,who,run:q=>{if(q.text.startsWith('select current_database'))return {rows:[who]};if(q.text.startsWith('SELECT alliance_control.'))return {rows:[{result:{state:'anchored',anchor:anchorRow(v.through.sequence,v.through.sha256)}}]};if(q.text==='COMMIT')throw Error('Synthetic lost commit');return {command:'SET'};}});await assert.rejects(g.store.advance(v),e=>e.outcome==='unknown');assert.equal(g.calls.length,5);assert.deepEqual(g.releases,[true]);await g.store.close();
});
