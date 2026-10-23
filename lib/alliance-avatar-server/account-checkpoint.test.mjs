import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {accountEvent,accountRecord} from './account-history.mjs';
import {accountHandoffBytes} from './account-handoff.mjs';
import {createAccountCheckpoint} from './account-checkpoint.mjs';
import {checkpointFixture,checkpointSqliteAvailable} from './account-checkpoint.fixture.mjs';
const scope={memberProjectRef:'abcdefghijklmnopqrst',journalProjectRef:'uvwxyzabcdefghijklmn',controlProjectRef:'opqrstuvwxyzabcdefgh',epoch:'11111111-1111-4111-8111-111111111111'},hs={memberProjectRef:scope.memberProjectRef,journalProjectRef:scope.journalProjectRef,epoch:scope.epoch};
const zero={sequence:0,sha256:'0'.repeat(64)},tag='a'.repeat(64),verificationKey='b'.repeat(64),sha=b=>createHash('sha256').update(b).digest('hex');
const one=accountRecord({scope:hs,sequence:1,previous:zero.sha256,event:accountEvent({kind:'account_admitted',subject:tag})}),event=accountEvent({kind:'account_remove_requested',subject:tag}),two=accountRecord({scope:hs,sequence:2,previous:one.sha256,event}),tip=r=>({sequence:r.sequence,sha256:r.sha256});
const base=()=>({format:1,scope,generation:1,previousSha256:zero.sha256,verificationKey,minimum:{head:tip(one),acknowledged:zero},pending:null});
const intent=()=>({id:'c'.repeat(64),kind:'history_append',event,expected:tip(one),target:null});
const clone=v=>structuredClone(v),receipt=b=>({generation:JSON.parse(b).generation,sha256:sha(b)});
function fixture(options={}){
 let bytes=accountHandoffBytes(base()),anchorReceipt=receipt(bytes),rows=[one],ack=zero;const calls=[],initial={...anchorReceipt};
 const slot={read:async()=>{calls.push('slot.read');return {bytes:Buffer.from(bytes),receipt:receipt(bytes)};},compareAndSet:async q=>{calls.push('slot.cas');if(JSON.stringify(q.expected)!==JSON.stringify(receipt(bytes)))return {state:'conflict',receipt:receipt(bytes)};bytes=Buffer.from(q.bytes);return {state:'committed',receipt:receipt(bytes)};}};
 const anchor={read:async()=>{calls.push('anchor.read');return {...anchorReceipt};},advance:async q=>{calls.push('anchor.cas');if(JSON.stringify(q.expected)!==JSON.stringify(anchorReceipt))return {state:'conflict',receipt:{...anchorReceipt}};anchorReceipt={...q.next};return {state:'committed',receipt:{...anchorReceipt}};}};
 const history={snapshot:async()=>{calls.push('history.read');return {scope:hs,enabled:true,admissionsOpen:true,head:tip(rows.at(-1)),records:clone(rows)};},append:async q=>{calls.push('history.append');assert.deepEqual(JSON.parse(bytes).pending.event,q.event);assert.deepEqual(anchorReceipt,receipt(bytes));rows=[one,two];return {state:'recorded',record:two,head:tip(two)};}};
 const acknowledgements={read:async()=>{calls.push('ack.read');return {...ack};},advance:async q=>{calls.push('ack.advance');assert.deepEqual(anchorReceipt,receipt(bytes));ack={...q.head};return {state:'acknowledged',point:{...ack}};}};
 const make=patch=>createAccountCheckpoint({enabled:true,scope,verificationKey,minimum:initial,slot,anchor,history,acknowledgements,...options,...patch});
 return {make,slot,anchor,history,acknowledgements,calls,initial,get bytes(){return Buffer.from(bytes);},get anchorReceipt(){return {...anchorReceipt};},setRows:v=>{rows=clone(v);},setAck:v=>{ack={...v};},replace:(b,a)=>{bytes=Buffer.from(b);anchorReceipt={...a};}};
}
test('checkpoint coordinator defaults off and performs no storage or mutation I/O',async()=>{
 for(const enabled of [undefined,false,1,'true']){let n=0;const c=createAccountCheckpoint({enabled,slot:{read:()=>n++}});assert.deepEqual(await c.observe(),{state:'unavailable'});assert.deepEqual(await c.execute(intent()),{state:'unavailable'});assert.equal(n,0);c.close();}
});
test('configuration requires exact outside receipt, canonical scope/key and every narrow capability',()=>{
 for(const patch of [{minimum:undefined},{minimum:{generation:0,sha256:verificationKey}},{scope:{...scope,controlProjectRef:scope.memberProjectRef}},{verificationKey:zero.sha256},{slot:{}},{anchor:{}},{history:{}},{acknowledgements:{}},{timeoutMs:8001}])assert.throws(()=>fixture().make(patch));
});
test('observation checks both stores around the load and gives no authorization or erasure',async()=>{
 const f=fixture(),c=f.make();try{assert.deepEqual(await c.observe(),{state:'checkpointed',minimum:base().minimum,authorization:'not_established',erasure:'not_established'});assert.deepEqual(f.calls,['anchor.read','slot.read','anchor.read','history.read','ack.read','anchor.read','slot.read','anchor.read']);}finally{c.close();}
});
test('new observations persist both head and acknowledgement before any evidence returns',async()=>{
 const f=fixture();f.setRows([one,two]);f.setAck(tip(one));const c=f.make();try{const r=await c.observe();assert.equal(r.state,'checkpointed');assert.deepEqual(r.minimum,{head:tip(two),acknowledged:tip(one)});assert.equal(JSON.parse(f.bytes).generation,2);assert.deepEqual(receipt(f.bytes),f.anchorReceipt);assert.ok(f.calls.indexOf('slot.cas')<f.calls.indexOf('anchor.cas'));assert.deepEqual(f.calls.slice(-3),['anchor.read','slot.read','anchor.read']);}finally{c.close();}
});
test('mutation dispatch follows committed intent, outside receipt and exact readback',async()=>{
 const f=fixture(),c=f.make();try{assert.deepEqual(await c.execute(intent()),{state:'pending',outcome:'reported_commit'});const dispatch=f.calls.indexOf('history.append');assert.ok(dispatch>f.calls.indexOf('anchor.cas'));assert.deepEqual(f.calls.slice(dispatch-3,dispatch),['anchor.read','slot.read','anchor.read']);assert.deepEqual(JSON.parse(f.bytes).pending,intent());assert.equal((await c.execute(intent())).state,'pending');assert.equal(f.calls.filter(x=>x==='history.append').length,1);}finally{c.close();}
});
test('acknowledgement dispatch also requires persisted exact expected/target points',async()=>{
 const f=fixture(),c=f.make(),p={id:'d'.repeat(64),kind:'acknowledgement_advance',event:null,expected:zero,target:tip(one)};try{assert.deepEqual(await c.execute(p),{state:'pending',outcome:'reported_commit'});assert.deepEqual(JSON.parse(f.bytes).pending,p);assert.equal(f.calls.filter(x=>x==='ack.advance').length,1);}finally{c.close();}
});
test('paused history blocks dispatch while admission closure still permits removal',async()=>{
 for(const enabled of [false,true]){const f=fixture(),read=f.history.snapshot;f.history.snapshot=async()=>({...await read(),enabled,admissionsOpen:false});const c=f.make();try{if(!enabled){assert.deepEqual(await c.execute(intent()),{state:'paused'});assert.ok(!f.calls.includes('slot.cas'));assert.ok(!f.calls.includes('history.append'));}else assert.equal((await c.execute(intent())).outcome,'reported_commit');}finally{c.close();}}
 const f=fixture(),read=f.history.snapshot;f.history.snapshot=async()=>({...await read(),admissionsOpen:false});const c=f.make();try{const p={...intent(),event:accountEvent({kind:'account_admitted',subject:'e'.repeat(64)})};assert.deepEqual(await c.execute(p),{state:'admissions_closed'});assert.ok(!f.calls.includes('slot.cas'));assert.ok(!f.calls.includes('history.append'));}finally{c.close();}
});
test('lost slot commit reply stops before anchor or business mutation; restart refuses split stores',async()=>{
 const f=fixture(),put=f.slot.compareAndSet;f.slot.compareAndSet=async q=>{await put(q);throw Error('PRIVATE');};const c=f.make();try{assert.deepEqual(await c.execute(intent()),{state:'unknown'});assert.ok(!f.calls.includes('anchor.cas'));assert.ok(!f.calls.includes('history.append'));assert.equal((await c.observe()).state,'unavailable');const fresh=f.make();try{assert.equal((await fresh.execute(intent())).state,'unavailable');}finally{fresh.close();}}finally{c.close();}
});
test('lost outside receipt reply leaves coherent pending state but never dispatches or retries',async()=>{
 const f=fixture(),advance=f.anchor.advance;f.anchor.advance=async q=>{await advance(q);throw Error('PRIVATE');};const c=f.make();try{assert.equal((await c.execute(intent())).state,'unknown');assert.ok(!f.calls.includes('history.append'));const fresh=f.make();try{assert.deepEqual(await fresh.execute(intent()),{state:'pending',outcome:'unresolved'});assert.ok(!f.calls.includes('history.append'));}finally{fresh.close();}}finally{c.close();}
});
test('lost business COMMIT reply preserves exact pending work across fresh construction',async()=>{
 const f=fixture(),append=f.history.append;f.history.append=async q=>{await append(q);throw Error('lost_reply');};const c=f.make();try{assert.equal((await c.execute(intent())).state,'unknown');const fresh=f.make();try{assert.deepEqual(await fresh.execute(intent()),{state:'pending',outcome:'unresolved'});assert.equal(f.calls.filter(x=>x==='history.append').length,1);assert.deepEqual(JSON.parse(f.bytes).pending,intent());assert.equal((await fresh.observe()).state,'pending');}finally{fresh.close();}}finally{c.close();}
});
test('conflicting storage CAS, wrong receipt or changed readback cannot dispatch',async()=>{
 for(const kind of ['conflict','wrong_receipt','readback']){const f=fixture();if(kind==='conflict')f.slot.compareAndSet=async()=>({state:'conflict',receipt:f.initial});if(kind==='wrong_receipt')f.anchor.advance=async()=>({state:'committed',receipt:f.initial});if(kind==='readback'){const advance=f.anchor.advance;f.anchor.advance=async q=>{const r=await advance(q);f.slot.read=async()=>({bytes:f.bytes,receipt:f.initial});return r;};}const c=f.make();try{assert.equal((await c.execute(intent())).state,'unknown');assert.ok(!f.calls.includes('history.append'));}finally{c.close();}}
});
test('stored older generation, changed bytes and regressed observed minima fault closed',async()=>{
 for(const kind of ['old_anchor','tampered','history','ack']){const f=fixture();if(kind==='old_anchor')f.anchor.read=async()=>({generation:1,sha256:'e'.repeat(64)});if(kind==='tampered')f.slot.read=async()=>({bytes:Buffer.from('bad'),receipt:f.initial});if(kind==='history')f.history.snapshot=async()=>({scope:hs,enabled:true,admissionsOpen:true,head:zero,records:[]});if(kind==='ack'){f.setRows([one,two]);f.setAck(tip(one));}const c=f.make();try{if(kind==='ack'){assert.equal((await c.observe()).state,'checkpointed');f.setAck(zero);}assert.equal((await c.observe()).state,'unavailable');assert.ok(!f.calls.includes('history.append'));}finally{c.close();}}
});
test('malformed/null intent, extra fields and invalid event order cannot dispatch',async()=>{
 for(const p of [null,{}, {...intent(),extra:true},{...intent(),expected:zero},{...intent(),event:accountEvent({kind:'account_remove_requested',subject:'e'.repeat(64)})}]){const f=fixture(),c=f.make();try{assert.ok(['invalid','unavailable'].includes((await c.execute(p)).state));assert.ok(!f.calls.includes('slot.cas'));assert.ok(!f.calls.includes('history.append'));}finally{c.close();}}
});
test('intent is copied before any asynchronous capability can mutate caller input',async()=>{
 const f=fixture(),p=intent(),read=f.anchor.read;f.anchor.read=async()=>{p.event=accountEvent({kind:'account_remove_requested',subject:'e'.repeat(64)});return read();};const c=f.make();try{assert.equal((await c.execute(p)).outcome,'reported_commit');assert.deepEqual(JSON.parse(f.bytes).pending,intent());}finally{c.close();}
});
test('an observation cannot report clear when another writer stages pending work during its reads',async()=>{
 const f=fixture(),c=f.make(),read=f.history.snapshot;f.history.snapshot=async()=>{const snapshot=await read(),b=JSON.parse(f.bytes),bytes=accountHandoffBytes({...b,generation:2,previousSha256:f.initial.sha256,pending:intent()});f.replace(bytes,receipt(bytes));return snapshot;};try{assert.equal((await c.observe()).state,'unavailable');assert.ok(!f.calls.includes('history.append'));}finally{c.close();}
});
test('busy calls do not queue and closing during staging cannot dispatch late work',async()=>{
 const f=fixture();let release,entered;const ready=new Promise(r=>entered=r),put=f.slot.compareAndSet;f.slot.compareAndSet=async q=>{entered();await new Promise(r=>release=r);return put(q);};const c=f.make();const pending=c.execute(intent());await ready;assert.deepEqual(await c.execute(intent()),{state:'busy'});c.close();assert.deepEqual(await pending,{state:'unknown'});release();await new Promise(r=>setImmediate(r));assert.ok(!f.calls.includes('history.append'));assert.ok(!f.calls.includes('anchor.cas'));
});
test('deadline during pending persistence stops dispatch even if the store commits later',async()=>{
 const f=fixture();let release,entered;const ready=new Promise(r=>entered=r),put=f.slot.compareAndSet;f.slot.compareAndSet=async q=>{entered();await new Promise(r=>release=r);return put(q);};const c=f.make({timeoutMs:150});const pending=c.execute(intent());await ready;assert.deepEqual(await pending,{state:'unknown'});release();await new Promise(r=>setImmediate(r));assert.ok(!f.calls.includes('history.append'));assert.ok(!f.calls.includes('anchor.cas'));c.close();
});
test('pre-cancelled calls perform no I/O and cancellation after durable intent retains pending',async()=>{
 const f=fixture(),abort=new AbortController();abort.abort();const c=f.make();try{assert.deepEqual(await c.execute(intent(),{signal:abort.signal}),{state:'cancelled'});assert.equal(f.calls.length,0);const a=new AbortController(),advance=f.anchor.advance;f.anchor.advance=async q=>{const r=await advance(q);a.abort();return r;};assert.equal((await c.execute(intent(),{signal:a.signal})).state,'unknown');assert.deepEqual(JSON.parse(f.bytes).pending,intent());assert.ok(!f.calls.includes('history.append'));}finally{c.close();}
});

const fixtureUrl=new URL('./account-checkpoint.fixture.mjs',import.meta.url).href;
const childSource=`import {readFileSync} from 'node:fs';import {openCheckpointFixture} from ${JSON.stringify(fixtureUrl)};const x=JSON.parse(readFileSync(0,'utf8'));let f;try{f=await openCheckpointFixture(x.directory,'synthetic_account_checkpoint');const q={expected:x.expected,bytes:Buffer.from(x.bytes,'base64')};if(x.phase){f.crashSlot(q,x.phase);}else{const r=await f.slot.compareAndSet(q);process.stdout.write(r.state);}}catch{process.stdout.write('busy');}finally{f?.close();}`;
const child=(data)=>{const r=spawnSync(process.execPath,['--input-type=module','-e',childSource],{input:JSON.stringify(data),encoding:'utf8',timeout:10000,maxBuffer:4096});assert.equal(r.status,0,r.stderr);return r.stdout;};
test('real SQLite pair commits pending before dispatch, survives close/reopen and blocks a fresh coordinator',{skip:!checkpointSqliteAvailable},async()=>{
 const f=fixture(),disk=await checkpointFixture(f.bytes,'synthetic_account_checkpoint');let pair=await disk.open();
 const history={...f.history,append:async q=>{f.calls.push('history.append');const stored=await pair.slot.read();assert.deepEqual(JSON.parse(stored.bytes).pending.event,q.event);assert.deepEqual(stored.receipt,await pair.anchor.read());f.setRows([one,two]);return {state:'recorded',record:two,head:tip(two)};}};
 const c=f.make({slot:pair.slot,anchor:pair.anchor,history});
 try{assert.equal((await c.execute(intent())).outcome,'reported_commit');c.close();pair.close();pair=await disk.open();const fresh=f.make({slot:pair.slot,anchor:pair.anchor});try{assert.deepEqual(await fresh.execute(intent()),{state:'pending',outcome:'unresolved'});assert.equal(f.calls.filter(x=>x==='history.append').length,1);}finally{fresh.close();}}finally{c.close();pair.close();await disk.cleanup();}
});
test('real child exits before and after SQLite commit distinguish rollback from split-store uncertainty',{skip:!checkpointSqliteAvailable},async()=>{
 for(const phase of ['before_commit','after_commit']){const f=fixture(),disk=await checkpointFixture(f.bytes,'synthetic_account_checkpoint'),b=JSON.parse(f.bytes),bytes=accountHandoffBytes({...b,generation:2,previousSha256:disk.receipt.sha256,pending:intent()});let pair;
  try{assert.equal(child({directory:disk.directory,expected:disk.receipt,bytes:bytes.toString('base64'),phase}),'');pair=await disk.open();const stored=await pair.slot.read();assert.equal(stored.receipt.generation,phase==='before_commit'?1:2);const c=f.make({slot:pair.slot,anchor:pair.anchor});try{assert.equal((await c.observe()).state,phase==='before_commit'?'checkpointed':'unavailable');assert.ok(!f.calls.includes('history.append'));}finally{c.close();}}finally{pair?.close();await disk.cleanup();}
 }
});
test('two real child processes competing for one SQLite slot commit at most one successor without retry',{skip:!checkpointSqliteAvailable},async()=>{
 const f=fixture(),disk=await checkpointFixture(f.bytes,'synthetic_account_checkpoint'),b=JSON.parse(f.bytes),bytes=accountHandoffBytes({...b,generation:2,previousSha256:disk.receipt.sha256,pending:intent()});
 const run=()=>new Promise((resolve,reject)=>{const p=spawn(process.execPath,['--input-type=module','-e',childSource],{stdio:['pipe','pipe','pipe']});let out='',err='';const timer=setTimeout(()=>{p.kill();reject(Error('child_timeout'));},10000);p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);p.once('error',e=>{clearTimeout(timer);reject(e);});p.once('exit',code=>{clearTimeout(timer);code===0?resolve(out):reject(Error(err));});p.stdin.end(JSON.stringify({directory:disk.directory,expected:disk.receipt,bytes:bytes.toString('base64')}));});
 try{const results=await Promise.all([run(),run()]);assert.equal(results.filter(x=>x==='committed').length,1);assert.ok(results.every(x=>['committed','conflict','busy'].includes(x)));const pair=await disk.open();try{assert.equal((await pair.slot.read()).receipt.generation,2);assert.equal((await pair.anchor.read()).generation,1);}finally{pair.close();}}finally{await disk.cleanup();}
});
test('child exits after BOTH real store commits before business dispatch; fresh coordinator refuses replay',{skip:!checkpointSqliteAvailable},async()=>{
 const f=fixture(),disk=await checkpointFixture(f.bytes,'synthetic_account_checkpoint'),url=new URL('./account-checkpoint.mjs',import.meta.url).href;
 const code=`import {readFileSync} from 'node:fs';import {openCheckpointFixture} from ${JSON.stringify(fixtureUrl)};import {createAccountCheckpoint} from ${JSON.stringify(url)};const x=JSON.parse(readFileSync(0,'utf8'));const f=await openCheckpointFixture(x.directory,'synthetic_account_checkpoint');const c=createAccountCheckpoint({...x.config,enabled:true,slot:f.slot,anchor:f.anchor,history:{snapshot:async()=>x.snapshot,append:async()=>process.exit(0)},acknowledgements:{read:async()=>x.zero,advance:async()=>{throw Error('unexpected');}}});await c.execute(x.intent);process.exit(9);`;
 let pair;try{const r=spawnSync(process.execPath,['--input-type=module','-e',code],{input:JSON.stringify({directory:disk.directory,config:{scope,verificationKey,minimum:disk.receipt},snapshot:{scope:hs,enabled:true,admissionsOpen:true,head:tip(one),records:[one]},zero,intent:intent()}),encoding:'utf8',timeout:10000,maxBuffer:4096});assert.equal(r.status,0,r.stderr);pair=await disk.open();const stored=await pair.slot.read();assert.equal(stored.receipt.generation,2);assert.deepEqual(stored.receipt,await pair.anchor.read());assert.deepEqual(JSON.parse(stored.bytes).pending,intent());const fresh=f.make({slot:pair.slot,anchor:pair.anchor});try{assert.deepEqual(await fresh.execute(intent()),{state:'pending',outcome:'unresolved'});assert.ok(!f.calls.includes('history.append'));}finally{fresh.close();}}finally{pair?.close();await disk.cleanup();}
});
test('coherent rollback of BOTH SQLite files refuses a separately retained latest generation after restart',{skip:!checkpointSqliteAvailable},async()=>{
 const f=fixture(),original=f.bytes,disk=await checkpointFixture(original,'synthetic_account_checkpoint'),pair=await disk.open(),c=f.make({slot:pair.slot,anchor:pair.anchor,history:{...f.history,append:async()=>({state:'recorded'})}});
 try{assert.equal((await c.execute(intent())).outcome,'reported_commit');const latest=await pair.anchor.read();assert.equal(latest.generation,2);c.close();pair.replace('slot',original,disk.receipt);pair.replace('anchor',null,disk.receipt);const fresh=f.make({slot:pair.slot,anchor:pair.anchor,minimum:latest});try{assert.equal((await fresh.observe()).state,'unavailable');assert.equal((await fresh.execute(intent())).state,'unavailable');assert.ok(!f.calls.includes('history.append'));}finally{fresh.close();}}finally{c.close();pair.close();await disk.cleanup();}
});
