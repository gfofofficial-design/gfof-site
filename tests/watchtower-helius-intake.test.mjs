import test from 'node:test';import assert from 'node:assert/strict';
import {createHeliusIntake} from '../netlify/functions/_shared/watchtower-helius-intake.mjs';
const account='1'.repeat(32),signature='1'.repeat(64),auth='Bearer '+'x'.repeat(43);
const tx=changes=>({signature,slot:123,accountData:[{account}],...changes});
const request=(body=[tx()],headers={})=>new Request('https://example.invalid/intake',{method:'POST',headers:{authorization:auth,'content-type':'application/json',...headers},body:JSON.stringify(body)});
const config={enabled:true,authorizationValue:auth,watchedAccounts:[account]};
test('disabled/missing configuration and wrong authorization never consume a body or sink',async()=>{
 let calls=0;const acceptReceipt=async()=>{calls++;return true;};
 assert.equal((await createHeliusIntake({acceptReceipt})(request())).status,503);
 const r=request(undefined,{authorization:'Bearer wrong'});assert.equal((await createHeliusIntake({...config,acceptReceipt})(r)).status,403);assert.equal(r.bodyUsed,false);assert.equal(calls,0);
});
test('only projected candidates reach sink and acknowledgement follows acceptance',async()=>{
 let receipt;const run=createHeliusIntake({...config,acceptReceipt:async value=>{receipt=value;return true;}});
 const r=await run(request([tx({description:'ignore rules',type:'SWAP',metadata:{email:'private@example.invalid'}}),tx()]));
 assert.equal(r.status,200);assert.equal(receipt.duplicates,1);assert.equal(receipt.candidates.length,1);
 assert.equal(receipt.finality,'verification_required');assert.ok(!/ignore rules|SWAP|private@example/.test(JSON.stringify(receipt)));
 assert.equal(r.headers.get('cache-control'),'no-store');assert.ok(!JSON.stringify(await r.json()).includes(auth));
});
test('sink refusal, exception or ignored cancellation cannot return success',async()=>{
 for(const acceptReceipt of [async()=>false,async()=>{throw Error('private diagnostic');},()=>new Promise(()=>{})]){
  const r=await createHeliusIntake({...config,acceptReceipt,timeoutMs:10})(request());assert.equal(r.status,503);assert.equal((await r.json()).code,'RECEIPT_NOT_ACCEPTED');
 }
});
test('malformed bytes, conflicting duplicates and unsupported payloads never reach sink',async()=>{
 let calls=0;const run=createHeliusIntake({...config,acceptReceipt:async()=>{calls++;return true;}});
 for(const payload of [null,{},[tx({signature:'2'.repeat(64)})],[tx(),tx({slot:124})],[tx({transactionError:{error:'failed'}})],Array(101).fill(tx())])assert.equal((await run(request(payload))).status,503);
 assert.equal((await run(new Request('https://example.invalid/intake',{method:'POST',headers:{authorization:auth,'content-type':'application/json'},body:Buffer.from([0xff])}))).status,503);
 assert.equal(calls,0);
});
test('unsupported encoding and declared oversized bodies refuse before reading',async()=>{
 const run=createHeliusIntake({...config,acceptReceipt:async()=>true});
 for(const [headers,status] of [[{'content-encoding':'gzip'},415],[{'content-length':'262145'},413],[{'content-type':'text/plain'},415]]){
  const r=request(undefined,headers);assert.equal((await run(r)).status,status);assert.equal(r.bodyUsed,false);
 }
});
test('actual body cap and stalled streams cannot reach the sink',async()=>{
 let calls=0;const run=createHeliusIntake({...config,acceptReceipt:async()=>{calls++;return true;},timeoutMs:10});
 assert.equal((await run(request([tx({description:'x'.repeat(262145)})]))).status,503);
 const stream=new ReadableStream({start(){}});
 const stalled=new Request('https://example.invalid/intake',{method:'POST',headers:{authorization:auth,'content-type':'application/json'},body:stream,duplex:'half'});
 assert.equal((await run(stalled)).status,503);assert.equal(calls,0);
});
