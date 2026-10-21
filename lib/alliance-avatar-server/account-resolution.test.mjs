import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {accountEvent,accountRecord} from './account-history.mjs';
import {accountHandoffBytes,reviewAccountHandoff,reviewAccountHandoffSuccessor} from './account-handoff.mjs';
import {deriveAccountResolution,reviewAccountResolutionSuccessor} from './account-resolution.mjs';
const scope={memberProjectRef:'abcdefghijklmnopqrst',journalProjectRef:'uvwxyzabcdefghijklmn',controlProjectRef:'opqrstuvwxyzabcdefgh',epoch:'11111111-1111-4111-8111-111111111111'},hs={memberProjectRef:scope.memberProjectRef,journalProjectRef:scope.journalProjectRef,epoch:scope.epoch};
const zero={sequence:0,sha256:'0'.repeat(64)},tag='a'.repeat(64),key='b'.repeat(64),sha=b=>createHash('sha256').update(b).digest('hex'),point=r=>({sequence:r.sequence,sha256:r.sha256});
const event=accountEvent({kind:'account_remove_requested',subject:tag}),one=accountRecord({scope:hs,sequence:1,previous:zero.sha256,event:accountEvent({kind:'account_admitted',subject:tag})}),two=accountRecord({scope:hs,sequence:2,previous:one.sha256,event});
const competing=accountRecord({scope:hs,sequence:2,previous:one.sha256,event:accountEvent({kind:'account_admitted',subject:'d'.repeat(64)})}),later=accountRecord({scope:hs,sequence:3,previous:competing.sha256,event});
const pending=()=>({id:'c'.repeat(64),kind:'history_append',event,expected:point(one),target:null});
const record=()=>({format:1,scope,generation:2,previousSha256:'e'.repeat(64),verificationKey:key,minimum:{head:point(one),acknowledged:zero},pending:pending()});
const minimum=(rows,ack=zero)=>({head:point(rows.at(-1)),acknowledged:ack});
const derive=(r,rows,ack=zero)=>deriveAccountResolution({record:r,records:rows,minimum:minimum(rows,ack)});
function proposal(r,rows,ack=zero){const previousBytes=accountHandoffBytes(r),result=derive(r,rows,ack);assert.equal(result.state,'resolvable');const after={...r,format:2,generation:r.generation+1,previousSha256:sha(previousBytes),minimum:minimum(rows,ack),pending:null,resolution:result.resolution};return {previousBytes,previousSha256:sha(previousBytes),nextBytes:accountHandoffBytes(after),nextSha256:sha(accountHandoffBytes(after)),expectedScope:scope,expectedVerificationKey:key,minimumGeneration:r.generation,records:rows,after};}
const review=p=>{const {after,...input}=p;return reviewAccountResolutionSuccessor(input);};
test('absent append effect with unchanged expected tip remains pending, without proving noncommit',()=>{
 assert.deepEqual(derive(record(),[one]),{state:'pending'});
});
test('format1 canonical bytes remain identical and format2 cannot be an unlinked bootstrap',()=>{
 const r=record();assert.deepEqual(accountHandoffBytes(r),Buffer.from(JSON.stringify(r)+'\n'));const p=proposal(r,[one,two]);assert.throws(()=>accountHandoffBytes({...p.after,generation:1,previousSha256:zero.sha256}));
});
test('a satisfied admission effect does not re-admit an account that is already removed',()=>{
 const r={...record(),minimum:{head:zero,acknowledged:zero},pending:{...pending(),event:one.event,expected:zero}};const value=derive(r,[one,two],point(two));assert.equal(value.resolution.outcome,'effect_satisfied');assert.deepEqual(value.resolution.guard,point(one));assert.ok(!('authorization' in value));
});
test('exact later event resolves only the effect, never caller commit attribution or erasure',()=>{
 const r=derive(record(),[one,two]);assert.equal(r.resolution.outcome,'effect_satisfied');assert.deepEqual(r.resolution.pending,pending());assert.deepEqual(r.resolution.guard,point(two));assert.equal(r.resolution.checkpointSha256,sha(accountHandoffBytes(record())));assert.ok(!('committedBy' in r.resolution));
});
test('an absent append can resolve superseded only after its original expected tip is displaced',()=>{
 const r=derive(record(),[one,competing]);assert.equal(r.resolution.outcome,'superseded');assert.deepEqual(r.resolution.guard,point(competing));
});
test('same effect applied by another writer later is satisfied rather than falsely attributed to original request',()=>{
 const r=derive(record(),[one,competing,later]);assert.equal(r.resolution.outcome,'effect_satisfied');assert.deepEqual(r.resolution.guard,point(later));
});
test('ack unchanged below target remains pending; an intermediate advance supersedes the expected CAS',()=>{
 const r={...record(),minimum:{head:point(later),acknowledged:zero},pending:{id:key,kind:'acknowledgement_advance',event:null,expected:zero,target:point(later)}};
 assert.deepEqual(derive(r,[one,competing,later]),{state:'pending'});assert.equal(derive(r,[one,competing,later],point(one)).resolution.outcome,'superseded');assert.deepEqual(derive(r,[one,competing,later],point(one)).resolution.guard,point(one));
});
test('ack at or beyond the exact canonical target resolves its effect without a new advance',()=>{
 const r={...record(),minimum:{head:point(competing),acknowledged:zero},pending:{id:key,kind:'acknowledgement_advance',event:null,expected:zero,target:point(competing)}};
 for(const [rows,ack] of [[[one,competing],point(competing)],[[one,competing,later],point(later)]]){const v=derive(r,rows,ack);assert.equal(v.resolution.outcome,'effect_satisfied');assert.deepEqual(v.resolution.guard,point(competing));}
});
test('an exact no-op acknowledgement is satisfied without pretending it proves any caller commit',()=>{
 const r={...record(),pending:{id:key,kind:'acknowledgement_advance',event:null,expected:zero,target:zero}};assert.equal(derive(r,[one]).resolution.outcome,'effect_satisfied');assert.deepEqual(derive(r,[one]).resolution.guard,zero);
});
test('rollback, forks, truncated history, wrong scope and bad target/expected points cannot resolve',()=>{
 for(const [r,rows,ack] of [[{...record(),minimum:{head:point(two),acknowledged:zero}},[one],zero],[record(),[one,{...two,sha256:key}],zero],[record(),[two],zero],[record(),[one,{...two,scope:{...hs,epoch:'99999999-9999-4999-8999-999999999999'}}],zero],[{...record(),pending:{...pending(),expected:{sequence:1,sha256:key}}},[one,two],zero]])assert.throws(()=>derive(r,rows,ack));
 const r={...record(),minimum:{head:point(later),acknowledged:zero},pending:{id:key,kind:'acknowledgement_advance',event:null,expected:zero,target:{sequence:2,sha256:key}}};assert.throws(()=>derive(r,[one,competing,later],point(one)));
});
test('an event already present before the expected tip is not accepted as a properly staged append',()=>{
 const r={...record(),pending:{...pending(),event:one.event}};assert.throws(()=>derive(r,[one,two]));
});
test('resolution upgrades a pinned v1 pending record to v2 with a retained canonical receipt',()=>{
 const p=proposal(record(),[one,two]);assert.deepEqual(review(p),p.after);const v=reviewAccountHandoff({bytes:p.nextBytes,expectedSha256:p.nextSha256,expectedScope:scope,expectedVerificationKey:key,minimumGeneration:3});assert.equal(v.format,2);assert.equal(v.pending,null);assert.deepEqual(v.resolution.pending,pending());
});
test('ordinary successor review still cannot clear pending or upgrade format, even with a valid resolution',()=>{
 const p=proposal(record(),[one,two]);const {after,...input}=p;assert.throws(()=>reviewAccountHandoffSuccessor(input));
});
test('supplied outcomes, guard points, operation IDs, checkpoint digests and retained intent cannot bypass derivation',()=>{
 const p=proposal(record(),[one,two]);for(const patch of [{outcome:'superseded'},{guard:point(one)},{checkpointSha256:key},{pending:{...pending(),id:key}},{pending:{...pending(),expected:zero}}]){const after={...p.after,resolution:{...p.after.resolution,...patch}},nextBytes=accountHandoffBytes(after);assert.throws(()=>review({...p,nextBytes,nextSha256:sha(nextBytes)}));}
});
test('no-pending records and fabricated unchanged-tip failure cannot be cleared by a resolution successor',()=>{
 const r={...record(),pending:null};assert.deepEqual(derive(r,[one]),{state:'no_pending'});
 const p=proposal(record(),[one,two]),before={...record(),pending:null},previousBytes=accountHandoffBytes(before);assert.throws(()=>review({...p,previousBytes,previousSha256:sha(previousBytes)}));
 const after={...p.after,minimum:{head:point(one),acknowledged:zero},resolution:{...p.after.resolution,outcome:'superseded',head:point(one),guard:point(one)}};const nextBytes=accountHandoffBytes(after);assert.throws(()=>review({...p,records:[one],nextBytes,nextSha256:sha(nextBytes)}));
});
test('generation gaps, wrong key/scope and a new pending operation cannot be mixed into clearing',()=>{
 const p=proposal(record(),[one,two]);for(const patch of [{generation:4},{previousSha256:key},{verificationKey:'d'.repeat(64)},{scope:{...scope,controlProjectRef:'z'.repeat(20)}},{pending:pending()}]){const after={...p.after,...patch},nextBytes=accountHandoffBytes(after);assert.throws(()=>review({...p,nextBytes,nextSha256:sha(nextBytes)}));}
});
test('future ordinary v2 successors preserve the last resolution receipt and cannot silently downgrade',()=>{
 const p=proposal(record(),[one,two]),next={...p.after,generation:4,previousSha256:p.nextSha256},bytes=accountHandoffBytes(next);const input={previousBytes:p.nextBytes,previousSha256:p.nextSha256,nextBytes:bytes,nextSha256:sha(bytes),expectedScope:scope,expectedVerificationKey:key,minimumGeneration:3,records:[one,two]};assert.deepEqual(reviewAccountHandoffSuccessor(input),next);
 for(const mutate of [v=>{v.format=1;delete v.resolution;},v=>{v.resolution.checkpointSha256=key;}]){const bad=structuredClone(next);mutate(bad);const b=accountHandoffBytes(bad);assert.throws(()=>reviewAccountHandoffSuccessor({...input,nextBytes:b,nextSha256:sha(b)}));}
});
test('v2 metadata remains bounded and cannot be hidden in v1 or dropped from v2',()=>{
 const p=proposal(record(),[one,two]);assert.ok(p.nextBytes.length<4096);assert.throws(()=>accountHandoffBytes({...record(),resolution:p.after.resolution}));const missing={...p.after};delete missing.resolution;assert.throws(()=>accountHandoffBytes(missing));assert.throws(()=>accountHandoffBytes({...p.after,resolution:{...p.after.resolution,extra:true}}));
});
