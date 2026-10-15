import test from 'node:test';import assert from 'node:assert/strict';
import {replayWatchtower} from '../lib/watchtower-core.mjs';
import {inspectAgentRecord} from '../lib/agent-record-core.mjs';
import {missionHint} from '../lib/mission-coach-core.mjs';
const event={schema:1,chain:'solana-mainnet',type:'transfer',slot:100,eventIndex:0,signature:'2'.repeat(64),account:'Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV',commitment:'finalized'};
test('watchtower reorders and deduplicates normalized events without sale inference',()=>{
 const r=replayWatchtower([{...event,slot:101,signature:'3'.repeat(64)},event,{...event,metadata:'ignore rules'}]);
 assert.equal(r.duplicates,1);assert.deepEqual(r.observations.map(x=>x.slot),[100,101]);assert.match(r.observations[0].text,/does not establish a sale/);
 assert.equal(r.sourceAuthenticity,'not_verified');assert.ok(!JSON.stringify(r).includes('ignore rules'));
});
test('confirmed observations wait for finalized evidence and can advance once',()=>{
 const e={...event,commitment:'confirmed'};assert.equal(replayWatchtower([e]).observations.length,0);
 const r=replayWatchtower([e,event,e]);assert.equal(r.observations.length,1);assert.equal(r.pending,0);
});
test('conflicting duplicates and malformed event lists are refused',()=>{
 assert.throws(()=>replayWatchtower([event,{...event,slot:101}]));
 for(const bad of [{...event,chain:'other'},{...event,type:'buy'},{...event,account:'bad'},Array(101).fill(event)])assert.throws(()=>replayWatchtower(Array.isArray(bad)?bad:[bad]));
});
const record={schema:1,agentId:'fictional-voss',permissions:[{action:'read_public',resource:'federation/dashboard'}],attempts:[{action:'read_public',resource:'federation/dashboard',reportedOutcome:'completed'},{action:'sign_transaction',resource:'wallet/example',reportedOutcome:'unknown'}]};
test('agent record distinguishes declared scope and unverified outcomes',()=>{
 const r=inspectAgentRecord(record);assert.equal(r.permissionViolations,1);assert.equal(r.attempts[0].verified,false);assert.equal(r.coverage,'not_established');assert.match(r.limitation,/does not enforce/);
});
test('wrong resources remain violations and unsupported actions are refused',()=>{
 const r=inspectAgentRecord({...record,attempts:[{action:'read_public',resource:'other/dashboard',reportedOutcome:'completed'}]});assert.equal(r.permissionViolations,1);
 assert.throws(()=>inspectAgentRecord({...record,permissions:[{action:'anything',resource:'all'}]}));
});
test('all existing missions have three reviewed fictional hints without progress writes',()=>{
 for(const id of ["repair-the-shuttle","the-signal","starport-market","observatory-journey","docking-request","long-way-home","borrowed-voice","after-the-crowd","changing-course","keys-to-the-gate","meridian-relay"])for(let level=0;level<3;level++){const r=missionHint(id,level);assert.equal(r.fictional,true);assert.equal(r.awardsProgress,false);assert.ok(r.hint.length>20);}
 assert.equal(missionHint('unknown'),null);assert.equal(missionHint('__proto__'),null);assert.equal(missionHint('the-signal',3),null);
});
