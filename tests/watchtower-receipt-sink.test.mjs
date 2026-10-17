import test from 'node:test';import assert from 'node:assert/strict';
import {createWatchtowerReceiptSink} from '../netlify/functions/_shared/watchtower-receipt-sink.mjs';
const receipt=()=>({schema:1,chain:'solana-mainnet',provider:'helius_enhanced_webhook',headerAuthentication:'shared_authorization_value_matched',finality:'verification_required',candidates:[{signature:'1'.repeat(64),slot:123,matchedAccounts:['1'.repeat(32)]}]});
test('sink projects canonical candidates with parameterized SQL before acceptance',async()=>{
 const run=createWatchtowerReceiptSink({query:async(sql,args)=>{assert.match(sql,/\$1::jsonb/);assert.deepEqual(JSON.parse(args[0]),receipt().candidates);return {rowCount:1,rows:[{accepted:1}]};}});
 assert.equal(await run({...receipt(),raw:'private detail'}),true);
});
test('invalid candidate or aborted request cannot query storage',async()=>{
 let calls=0;const run=createWatchtowerReceiptSink({query:async()=>{calls++;}});
 const controller=new AbortController();controller.abort();assert.equal(await run(receipt(),{signal:controller.signal}),false);
 const r=receipt();r.candidates[0].signature='bad';assert.equal(await run(r),false);assert.equal(calls,0);
});
test('storage failures and incorrect acceptance counts remain closed',async()=>{
 for(const query of [async()=>{throw Error('private storage diagnostic');},async()=>({rowCount:1,rows:[{accepted:0}]})])assert.equal(await createWatchtowerReceiptSink({query})(receipt()),false);
});
test('late durable completion cannot acknowledge an already aborted request',async()=>{
 const controller=new AbortController();const run=createWatchtowerReceiptSink({query:async()=>{controller.abort();return {rowCount:1,rows:[{accepted:1}]};}});
 assert.equal(await run(receipt(),{signal:controller.signal}),false);
});
test('intake cancellation signal reaches the database adapter',async()=>{
 const controller=new AbortController();
 const run=createWatchtowerReceiptSink({query:async(sql,args,options)=>{assert.equal(options.signal,controller.signal);return {rowCount:1,rows:[{accepted:1}]};}});
 assert.equal(await run(receipt(),{signal:controller.signal}),true);
});
