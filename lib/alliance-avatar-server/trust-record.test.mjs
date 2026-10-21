import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign,verify,createPublicKey} from 'node:crypto';
import {allianceTrustRecordBytes,allianceTrustRecord,reviewAllianceTrustSuccessor} from './trust-record.mjs';
import {createPinnedAllianceAuthorities} from './pinned-authorities.mjs';
import {controlPolicySha256} from './control-policy.mjs';
import {deletionWitnessBytes} from './deletion-journal.mjs';
import {startupFixture} from './startup-gate.fixture.mjs';
import {chain,event,other,zero} from './deletion-journal.fixture.mjs';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const key=()=>{const pair=generateKeyPairSync('ed25519');return {publicKey:Buffer.from(pair.publicKey.export({format:'jwk'}).x,'base64url').toString('hex'),signBytes:bytes=>sign(null,bytes,pair.privateKey)};};
function fixture(){
 const f=startupFixture(),cp=f.checkpoint,scope={memberProjectRef:cp.memberProjectRef,journalProjectRef:cp.journalProjectRef,controlProjectRef:'opqrstuvwxyzabcdefgh',epoch:cp.epoch},control=key(),journal=key(),calls=[];
 const raw={format:1,memberProjectRef:scope.memberProjectRef,journalProjectRef:scope.journalProjectRef,epoch:scope.epoch,...f.control,revision:2,changeId:other};
 let policy={...raw,sha256:controlPolicySha256(raw)},history=chain([event()]);
 const anchor={format:1,memberProjectRef:cp.memberProjectRef,journalProjectRef:cp.journalProjectRef,epoch:cp.epoch,sequence:1,sha256:history[0].sha256};
 const record={format:1,...scope,generation:1,previousSha256:zero,controlMinimum:{revision:policy.revision,sha256:policy.sha256,floor:{...policy.floor}},removalMinimum:{sequence:1,sha256:anchor.sha256},controlVerificationKey:control.publicKey,journalVerificationKey:journal.publicKey};
 const bytes=allianceTrustRecordBytes(record),args={bytes,expectedSha256:digest(bytes),expectedScope:scope,minimumGeneration:1};
 const options={enabled:true,trustBytes:bytes,expectedSha256:args.expectedSha256,expectedScope:scope,minimumGeneration:1,controlSigner:{publicKey:control.publicKey,signBytes(b,o){calls.push('control-sign');return control.signBytes(b,o);}},journalSigner:{publicKey:journal.publicKey,signBytes(b,o){calls.push('journal-sign');return journal.signBytes(b,o);}},controlStore:{read:()=>{calls.push('policy');return structuredClone(policy);}},anchorStore:{read:()=>{calls.push('anchor');return {...anchor};}},ledger:{recoveryInventory:()=>{calls.push('member-inventory');return structuredClone(cp.member);}},journalStore:{recoveryInventory:()=>{calls.push('journal-inventory');return structuredClone(cp.journal);},tip:()=>{calls.push('tip');return {projectRef:cp.memberProjectRef,epoch:cp.epoch,sequence:history.length,sha256:history.at(-1)?.sha256||zero,enabled:true};},records:()=>{calls.push('records');return structuredClone(history);}}};
 return {cp,scope,record,bytes,args,options,anchor,history,calls,control,journal,make:overrides=>createPinnedAllianceAuthorities({...options,...overrides}),serve(){const {sha256,...v}=policy;v.state='serve';v.revision++;policy={...v,sha256:controlPolicySha256(v)};},getPolicy(){return structuredClone(policy);},setPolicy(v){policy=v;}};
}
const challenge={challenge:'a'.repeat(64)};
test('public trust record is exact canonical bounded configuration with independent scope and digest',()=>{
 const f=fixture(),r=allianceTrustRecord(f.args);assert.deepEqual(r,f.record);r.controlMinimum.floor.sequence=0;assert.deepEqual(allianceTrustRecord(f.args),f.record);assert.ok(f.bytes.length<4096);
});
test('changed or truncated trust bytes do not match the protected digest',()=>{
 const f=fixture();for(const bytes of [f.bytes.subarray(0,-1),Buffer.concat([f.bytes,Buffer.from(' ')]),Buffer.alloc(4097)])assert.throws(()=>allianceTrustRecord({...f.args,bytes}),/alliance_trust_unavailable/);
});
test('duplicate JSON keys, reordered fields, BOM, malformed UTF8 and trailing data are refused even with their matching digest',()=>{
 const f=fixture(),text=f.bytes.toString(),raws=[Buffer.from(text.replace('"format":1','"format":1,"format":1')),Buffer.from(JSON.stringify(Object.fromEntries(Object.entries(f.record).reverse()))+'\n'),Buffer.concat([Buffer.from([239,187,191]),f.bytes]),Buffer.from([255]),Buffer.concat([f.bytes,Buffer.from('null')])];
 for(const bytes of raws)assert.throws(()=>allianceTrustRecord({...f.args,bytes,expectedSha256:digest(bytes)}),/alliance_trust_unavailable/);
});
test('trust scope pins all three distinct domains and the exact epoch',()=>{
 const f=fixture();for(const expectedScope of [{...f.scope,controlProjectRef:'z'.repeat(20)},{...f.scope,epoch:other},{...f.scope,controlProjectRef:f.scope.memberProjectRef},{...f.scope,extra:true},{}])assert.throws(()=>allianceTrustRecord({...f.args,expectedScope}));
});
test('missing, stale or malformed generation and digest have no fallback',()=>{
 const f=fixture();for(const change of [{minimumGeneration:2},{minimumGeneration:undefined},{minimumGeneration:'1'},{minimumGeneration:0},{expectedSha256:undefined},{expectedSha256:'f'.repeat(64)}])assert.throws(()=>allianceTrustRecord({...f.args,...change}));
});
test('no private key, arbitrary field, shared purpose key or impossible point is accepted',()=>{
 const f=fixture();for(const change of [{privateKey:'not a key'},{controlVerificationKey:zero},{journalVerificationKey:f.record.controlVerificationKey},{previousSha256:'e'.repeat(64)},{controlMinimum:{...f.record.controlMinimum,floor:{sequence:2,sha256:'a'.repeat(64)}}},{removalMinimum:{sequence:1,sha256:'f'.repeat(64)}}])assert.throws(()=>allianceTrustRecordBytes({...f.record,...change}));
});
test('closed composition does no I/O or signing and accepts no truthy activation substitute',async()=>{
 const f=fixture();for(const enabled of [undefined,false,'true',1]){const a=f.make({enabled,trustBytes:null});assert.deepEqual(await a.startup.prepare(f.cp),{state:'quarantine',access:'closed'});assert.equal(await a.startup.authorize(),false);assert.deepEqual(await a.witness.issue(challenge),{state:'unavailable'});a.close();}assert.deepEqual(f.calls,[]);
});
test('pinned startup prepares actual pair protocol and requires separate later release',async()=>{
 const f=fixture(),a=f.make();try{assert.deepEqual(await a.startup.prepare(f.cp),{state:'prepared',access:'closed'});f.serve();assert.equal(await a.startup.authorize(),true);assert.ok(f.calls.includes('member-inventory'));assert.ok(f.calls.includes('control-sign'));assert.equal(f.calls.includes('journal-sign'),false);}finally{a.close();}
});
test('pinned journal witness signs the actual protocol with only the journal key',async()=>{
 const f=fixture(),a=f.make();try{const r=await a.witness.issue(challenge);assert.equal(r.state,'signed');const e=JSON.parse(r.bytes),k=createPublicKey({format:'jwk',key:{kty:'OKP',crv:'Ed25519',x:Buffer.from(f.journal.publicKey,'hex').toString('base64url')}});assert.equal(verify(null,deletionWitnessBytes(e.anchor),k,Buffer.from(e.signature,'hex')),true);assert.equal(f.calls.includes('control-sign'),false);}finally{a.close();}
});
test('wrong or swapped signer handles and secret-bearing handle fields fail before reads',()=>{
 const f=fixture();for(const change of [{controlSigner:f.options.journalSigner},{journalSigner:f.options.controlSigner},{controlSigner:{...f.options.controlSigner,privateKey:'not a key'}},{journalSigner:{publicKey:f.journal.publicKey}},{trustBytes:null}])assert.throws(()=>f.make(change),/alliance_trust_unavailable/);assert.deepEqual(f.calls,[]);
});
test('a mislabeled protected signer cannot return a signature from the other key',async()=>{
 const f=fixture(),a=f.make({controlSigner:{publicKey:f.control.publicKey,signBytes:f.journal.signBytes}});assert.deepEqual(await a.startup.prepare(f.cp),{state:'quarantine',access:'closed'});assert.equal(await a.startup.authorize(),false);a.close();
});
test('a fresh pinned instance rejects control rollback before touching its signer',async()=>{
 const f=fixture(),{sha256,...raw}=f.getPolicy();raw.revision=1;
 f.setPolicy({...raw,sha256:controlPolicySha256(raw)});const a=f.make();assert.deepEqual(await a.startup.prepare(f.cp),{state:'quarantine',access:'closed'});assert.equal(f.calls.includes('control-sign'),false);a.close();
});
test('external live minimum refuses coherent database rollback in both authority paths',async()=>{
 const f=fixture();f.anchor.sequence=0;f.anchor.sha256=zero;f.history.length=0;const a=f.make();assert.deepEqual(await a.startup.prepare(f.cp),{state:'quarantine',access:'closed'});assert.deepEqual(await a.witness.issue(challenge),{state:'unavailable'});assert.equal(f.calls.some(x=>x.endsWith('-sign')),false);a.close();
});
test('external anchor fork and lost domain fail closed without reading history or signing',async()=>{
 for(const lost of [false,true]){const f=fixture();f.anchor.sha256='f'.repeat(64);const a=f.make(lost?{anchorStore:{read(){throw Error('PRIVATE endpoint');}}}:{});assert.deepEqual(await a.witness.issue(challenge),{state:'unavailable'});assert.equal(f.calls.includes('tip'),false);assert.equal(f.calls.some(x=>x.endsWith('-sign')),false);a.close();}
});
test('a higher sequence on a different canonical chain cannot bypass the external minimum in either path',async()=>{
 const f=fixture(),fork=chain([event({id:other}),event()]);f.history.splice(0,1,...fork);f.anchor.sequence=2;f.anchor.sha256=fork[1].sha256;const a=f.make();assert.deepEqual(await a.startup.prepare(f.cp),{state:'quarantine',access:'closed'});assert.deepEqual(await a.witness.issue(challenge),{state:'unavailable'});assert.equal(f.calls.some(x=>x.endsWith('-sign')),false);a.close();
});
test('late noncooperative anchor read cannot start another history read after cancellation',async()=>{
 const f=fixture();let release;const a=f.make({anchorStore:{read:()=>new Promise(r=>release=r)}}),c=new AbortController(),pending=a.witness.issue(challenge,{signal:c.signal});while(!release)await new Promise(r=>setImmediate(r));c.abort();assert.deepEqual(await pending,{state:'unavailable'});release({...f.anchor});await new Promise(r=>setImmediate(r));assert.equal(f.calls.includes('records'),false);a.close();
});
test('caller mutation after construction cannot replace pins or signer functions',async()=>{
 const f=fixture(),a=f.make();f.bytes.fill(0);f.scope.epoch=other;f.options.controlSigner.signBytes=()=>{throw Error();};assert.deepEqual(await a.startup.prepare(f.cp),{state:'prepared',access:'closed'});a.close();
});
test('close cancels blocked signing and late result cannot publish or authorize',async()=>{
 const f=fixture();let release;const a=f.make({controlSigner:{publicKey:f.control.publicKey,signBytes:()=>new Promise(r=>release=r)}}),pending=a.startup.prepare(f.cp);while(!release)await new Promise(r=>setImmediate(r));a.close();assert.deepEqual(await pending,{state:'quarantine',access:'closed'});release(Buffer.alloc(64));assert.equal(await a.startup.authorize(),false);assert.deepEqual(await a.witness.issue(challenge),{state:'unavailable'});
});
function successor(f,change={}){const value={...structuredClone(f.record),generation:2,previousSha256:f.args.expectedSha256,...change},bytes=allianceTrustRecordBytes(value);return {value,bytes,args:{previousBytes:f.bytes,previousSha256:f.args.expectedSha256,nextBytes:bytes,nextSha256:digest(bytes),expectedScope:f.scope,minimumGeneration:1,records:f.history}};}
test('explicit successor review permits separate new signing keys and preserves verified floors',()=>{
 const f=fixture(),c=key(),j=key(),next=successor(f,{controlVerificationKey:c.publicKey,journalVerificationKey:j.publicKey});assert.deepEqual(reviewAllianceTrustSuccessor(next.args),next.value);assert.deepEqual(allianceTrustRecord(f.args),f.record);assert.throws(()=>allianceTrustRecord({...f.args,bytes:next.bytes}));
});
test('successor requires exact predecessor, next generation and unchanged scope',()=>{
 const f=fixture();for(const change of [{generation:3},{previousSha256:'f'.repeat(64)},{controlProjectRef:'z'.repeat(20)}])assert.throws(()=>reviewAllianceTrustSuccessor(successor(f,change).args));
});
test('successor rejects role-crossed keys and unchanged-revision control hash forks',()=>{
 const f=fixture();for(const change of [{controlVerificationKey:f.journal.publicKey,journalVerificationKey:f.control.publicKey},{controlMinimum:{...f.record.controlMinimum,sha256:'f'.repeat(64)}}])assert.throws(()=>reviewAllianceTrustSuccessor(successor(f,change).args));
});
test('successor verifies full canonical prefix for a higher live minimum',()=>{
 const f=fixture(),history=chain([event(),event({id:other})]),point={sequence:2,sha256:history[1].sha256},n=successor(f,{removalMinimum:point});assert.equal(reviewAllianceTrustSuccessor({...n.args,records:history}).removalMinimum.sequence,2);assert.throws(()=>reviewAllianceTrustSuccessor({...n.args,records:history.slice(1)}));const fork=structuredClone(history);fork[0].sha256='f'.repeat(64);assert.throws(()=>reviewAllianceTrustSuccessor({...n.args,records:fork}));
});
test('successor cannot lower an acknowledged minimum or reviewed policy revision',()=>{
 const f=fixture();for(const change of [{removalMinimum:{sequence:0,sha256:zero},controlMinimum:{...f.record.controlMinimum,floor:{sequence:0,sha256:zero}}},{controlMinimum:{...f.record.controlMinimum,revision:1}}])assert.throws(()=>reviewAllianceTrustSuccessor(successor(f,change).args));
});
