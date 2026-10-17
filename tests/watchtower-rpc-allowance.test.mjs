import test from 'node:test';import assert from 'node:assert/strict';
import {createWatchtowerRpcAllowance} from '../netlify/functions/_shared/watchtower-rpc-allowance.mjs';
const request={purpose:'watchtower_candidate_verification',method:'getTransaction',maxRequests:1,maxResponseBytes:1048576};
test('exact verification requests reserve parameterized environment capacity',async()=>{
 const run=createWatchtowerRpcAllowance({scope:'preview',dailyLimit:7,monthlyLimit:10,query:async(sql,args)=>{assert.match(sql,/ON CONFLICT/);assert.deepEqual(args,['preview',7,10]);return {rowCount:1};}});assert.equal(await run(request),true);
});
test('invalid bounds and unsupported request methods cannot query allowance',async()=>{
 let calls=0;const query=async()=>{calls++;return {rowCount:1};};
 for(const change of [{scope:'client'},{dailyLimit:0},{monthlyLimit:1},{dailyLimit:1.5}])assert.throws(()=>createWatchtowerRpcAllowance({query,scope:'preview',dailyLimit:7,monthlyLimit:10,...change}));
 const run=createWatchtowerRpcAllowance({query,scope:'preview',dailyLimit:7,monthlyLimit:10});
 for(const r of [null,{...request,method:'sendTransaction'},{...request,maxRequests:2},{...request,extra:true}])assert.equal(await run(r),false);assert.equal(calls,0);
});
test('exhausted or failed storage cannot grant capacity',async()=>{
 for(const query of [async()=>({rowCount:0}),async()=>{throw Error('private storage detail');}])assert.equal(await createWatchtowerRpcAllowance({query,scope:'production',dailyLimit:7,monthlyLimit:10})(request),false);
});
