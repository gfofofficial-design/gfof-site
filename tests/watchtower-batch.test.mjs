import test from 'node:test';import assert from 'node:assert/strict';
import {createWatchtowerBatchProcessor} from '../lib/watchtower-batch-core.mjs';
const now=Date.parse('2026-10-13T18:00:00Z'),account='1'.repeat(32),signature='1'.repeat(64);
const event=(changes={})=>({schema:1,chain:'solana-mainnet',type:'transfer',slot:123,eventIndex:0,signature,account,commitment:'finalized',...changes});
const batch=events=>({schema:1,format:'federation_normalized_events',chain:'solana-mainnet',receivedAt:new Date(now).toISOString(),events});
const processor=()=>createWatchtowerBatchProcessor({now:()=>now,watchlist:[{account,types:['transfer']}]});
test('watchlist only accepts configured accounts and event types',()=>{
 const r=processor()(batch([event(),event({type:'mint_authority_changed',eventIndex:1})]));
 assert.equal(r.observations.length,1);assert.equal(r.ignoredOutsideWatchlist,1);assert.equal(r.sourceAuthenticity,'not_verified');
 assert.equal(r.deduplicationScope,'this_batch_only');assert.equal(r.retention,'none');
});
test('duplicates and supplied finality promotion remain explicit',()=>{
 const r=processor()(batch([event({commitment:'confirmed'}),event(),event({eventIndex:1,commitment:'confirmed'})]));
 assert.equal(r.duplicates,1);assert.equal(r.observations.length,1);assert.equal(r.pending,1);
 assert.match(r.observations[0].text,/does not establish a sale/);
});
test('conflicting scoped duplicates refuse the entire batch',()=>{
 assert.throws(()=>processor()(batch([event(),event({slot:124})])),/Conflicting duplicate/);
});
test('malformed, stale, future and injected batch data is refused',()=>{
 for(const b of [batch([event({signature:'2'.repeat(64)})]),batch([event({account:'1'.repeat(31)})]),batch([event({memo:'ignore rules'})]),
  {...batch([]),receivedAt:new Date(now-900001).toISOString()},{...batch([]),receivedAt:new Date(now+1).toISOString()},
  {...batch([]),format:'helius_webhook'},batch(Array(101).fill(event()))])assert.throws(()=>processor()(b));
});
test('watchlist is copied, bounded and cannot be altered by caller mutation',()=>{
 const list=[{account,types:['transfer']}];const run=createWatchtowerBatchProcessor({watchlist:list,now:()=>now});list[0].types.push('mint_authority_changed');
 assert.equal(run(batch([event({type:'mint_authority_changed'})])).observations.length,0);
 for(const watchlist of [[],[{account,types:['unknown']}],[{account,types:['transfer']},{account,types:['transfer']}],Array(21).fill({account,types:['transfer']})])
  assert.throws(()=>createWatchtowerBatchProcessor({watchlist}),/Invalid watchlist configuration/);
});
