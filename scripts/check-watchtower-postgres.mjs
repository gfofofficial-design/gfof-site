import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createWatchtowerRpcAllowance} from '../netlify/functions/_shared/watchtower-rpc-allowance.mjs';
import {createWatchtowerReceiptSink} from '../netlify/functions/_shared/watchtower-receipt-sink.mjs';
import {createCandidateVerifier} from '../netlify/functions/_shared/watchtower-verify-candidate.mjs';
import {createWatchtowerRpcTransport} from '../netlify/functions/_shared/watchtower-rpc-transport.mjs';
import {createWatchtowerWorker} from '../netlify/functions/_shared/watchtower-worker.mjs';
const container=process.env.WATCHTOWER_TEST_CONTAINER;
if(process.env.GITHUB_ACTIONS!=='true'||typeof container!=='string'||!/^[a-f0-9]{12,64}$/.test(container))throw Error('Isolated CI service required');
function sql(statement){return new Promise((resolve,reject)=>{
 const child=spawn('docker',['exec','-i',container,'psql','-U','fixture','-d','watchtower_fixture','-X','-v','ON_ERROR_STOP=1','-At'],{stdio:['pipe','pipe','pipe']});
 let output='';child.stdout.on('data',data=>{output+=data;});child.stderr.resume();child.on('error',()=>reject(Error('Fixture query failed')));
 child.on('close',code=>code===0?resolve(output.trim()):reject(Error('Fixture query failed')));child.stdin.end(statement);
});}
const literal=value=>"'"+value.replaceAll("'","''")+"'";
// Fresh b sorts before conflicting a, proving an earlier insertion is rolled back.
const a='1'.repeat(63)+'2',b='1'.repeat(64),account='1'.repeat(32);
const candidate=(signature=a,slot=123)=>({signature,slot,matchedAccounts:[account]});
const enqueue=items=>'SELECT public.enqueue_watchtower_candidates('+literal(JSON.stringify(items))+'::jsonb);';
await sql(await readFile(new URL('../migrations/20261013_watchtower_candidates.sql',import.meta.url),'utf8'));
const receipts=await Promise.all(Array.from({length:20},()=>sql(enqueue([candidate()]))));
assert.ok(receipts.every(x=>x==='1'));assert.equal(await sql('SELECT count(*) FROM public.watchtower_candidates;'),'1');
await assert.rejects(sql(enqueue([candidate(b),candidate(a,124)])));
assert.equal(await sql('SELECT count(*) FROM public.watchtower_candidates;'),'1');
const claims=await Promise.all(Array.from({length:10},()=>sql('SELECT signature FROM public.claim_watchtower_candidate();')));
assert.equal(claims.filter(Boolean).length,1);
await sql("UPDATE public.watchtower_candidates SET lease_until=clock_timestamp()-interval '1 second';");
assert.equal(await sql('SELECT lease_version FROM public.claim_watchtower_candidate();'),'2');
const evidence={schema:1,method:'rpc_corroborated_candidate',signature:a,transactionSlot:123,accountSlot:125,sourceAuthenticity:'rpc_response_not_cryptographically_verified',finality:'finalized_requested_from_reviewed_rpc',emitsFinding:false,states:[{account,state:'absent_at_account_slot',slot:125}]};
const evidenceSql=literal(JSON.stringify(evidence))+'::jsonb';
assert.equal(await sql('SELECT public.finish_watchtower_candidate('+literal(a)+',1,'+evidenceSql+');'),'f');
assert.equal(await sql('SELECT corroboration IS NULL FROM public.watchtower_candidates;'),'t');
await assert.rejects(sql('SELECT public.finish_watchtower_candidate('+literal(a)+",2,'{}'::jsonb);"));
const malformedState={...evidence,states:[{account,state:'present_at_account_slot',slot:125,ownerProgram:null,executable:false,dataBytes:0,dataSha256:null,stateSha256:null}]};
await assert.rejects(sql('SELECT public.finish_watchtower_candidate('+literal(a)+',2,'+literal(JSON.stringify(malformedState))+'::jsonb);'));
assert.equal(await sql('SELECT state FROM public.watchtower_candidates;'),'leased');
assert.equal(await sql('SELECT corroboration IS NULL FROM public.watchtower_candidates;'),'t');
assert.equal(await sql('SELECT public.finish_watchtower_candidate('+literal(a)+',2,'+evidenceSql+');'),'t');
assert.equal(await sql("SELECT corroboration->>'signature' FROM public.watchtower_candidates;"),a);
assert.equal(await sql('SELECT corroborated_at IS NOT NULL FROM public.watchtower_candidates;'),'t');
assert.equal(await sql('SELECT count(*) FROM public.claim_watchtower_candidate();'),'0');
await sql(enqueue([candidate()]));assert.equal(await sql('SELECT state FROM public.watchtower_candidates;'),'processed');
await sql(enqueue([candidate(b)]));
await sql("UPDATE public.watchtower_candidates SET attempts=5,state='leased',lease_until=clock_timestamp()-interval '1 second' WHERE signature="+literal(b)+';');
assert.equal(await sql('SELECT count(*) FROM public.claim_watchtower_candidate();'),'0');
assert.equal(await sql('SELECT state FROM public.watchtower_candidates WHERE signature='+literal(b)+';'),'exhausted');
const c='1'.repeat(63)+'3';
await sql(enqueue([candidate(c)]));
assert.equal(await sql('SELECT lease_version FROM public.claim_watchtower_candidate();'),'1');
const presentEvidence={...evidence,signature:c,states:[{account,state:'present_at_account_slot',slot:125,ownerProgram:account,executable:false,dataBytes:0,dataSha256:'0'.repeat(64),stateSha256:'0'.repeat(64)}]};
assert.equal(await sql('SELECT public.finish_watchtower_candidate('+literal(c)+',1,'+literal(JSON.stringify(presentEvidence))+'::jsonb);'),'t');
const reservation={purpose:'watchtower_candidate_verification',method:'getTransaction',maxRequests:1,maxResponseBytes:1048576};
const allowance=(dailyLimit,monthlyLimit,scope='preview')=>createWatchtowerRpcAllowance({scope,dailyLimit,monthlyLimit,query:async(statement,args)=>{
 const command=statement.replace(/\$([1-3])/g,(_,index)=>typeof args[Number(index)-1]==='string'?literal(args[Number(index)-1]):String(args[Number(index)-1]));
 const output=await sql(command+';');return {rowCount:output?1:0};
}});
const race=async run=>(await Promise.all(Array.from({length:20},()=>run(reservation)))).filter(Boolean).length;
assert.equal(await race(allowance(7,10)),7);
await sql("UPDATE public.watchtower_rpc_allowance SET day_utc=day_utc-1 WHERE scope='preview';");
assert.equal(await race(allowance(7,10)),3);
assert.equal(await race(allowance(7,10)),0);
await sql("UPDATE public.watchtower_rpc_allowance SET day_utc=day_utc-1,month_utc=(month_utc-interval '1 month')::date WHERE scope='preview';");
assert.equal(await race(allowance(7,10)),7);
assert.equal(await race(allowance(2,3,'production')),2);
await sql("UPDATE public.watchtower_rpc_allowance SET day_utc=day_utc+1 WHERE scope='preview';");
assert.equal(await allowance(7,10)(reservation),false);
// Real queue/allowance queries with synthetic HTTP responses; no provider connection.
const query=async(statement,args)=>{
 if(statement.includes('claim_watchtower_candidate')){
  const output=await sql('SELECT row_to_json(c) FROM public.claim_watchtower_candidate() AS c;');
  return {rowCount:output?1:0,rows:output?[JSON.parse(output)]:[]};
 }
 const bound=statement.replace(/\$([1-3])/g,(_,index)=>typeof args[Number(index)-1]==='string'?literal(args[Number(index)-1]):String(args[Number(index)-1]));
 const output=await sql(bound+';');
 if(statement.includes('enqueue_watchtower_candidates'))return {rowCount:1,rows:[{accepted:Number(output)}]};
 if(statement.includes('finish_watchtower_candidate'))return {rowCount:1,rows:[{finished:output==='t'}]};
 return {rowCount:output?1:0,rows:[]};
};
const d='1'.repeat(63)+'4';
const sink=createWatchtowerReceiptSink({query});
assert.equal(await sink({schema:1,chain:'solana-mainnet',provider:'helius_enhanced_webhook',headerAuthentication:'shared_authorization_value_matched',finality:'verification_required',candidates:[candidate(d)]}),true);
let fixtureReads=0;
const rpc=createWatchtowerRpcTransport({enabled:true,apiKey:'synthetic-fixture-not-real-provider-key',fetcher:async(_,options)=>{
 fixtureReads++;const request=JSON.parse(options.body);
 const result=request.id===1?{slot:123,version:'legacy',meta:{err:null},transaction:{signatures:[d],message:{accountKeys:[account]}}}:
  {context:{slot:125},value:[{owner:account,executable:false,data:[Buffer.from('fixture').toString('base64'),'base64']}]};
 return new Response(JSON.stringify({jsonrpc:'2.0',id:request.id,result}),{headers:{'content-type':'application/json'}});
}});
const reserveAllowance=createWatchtowerRpcAllowance({query,scope:'production',dailyLimit:7,monthlyLimit:10});
const verify=createCandidateVerifier({enabled:true,watchedAccounts:[account],rpc,reserveAllowance});
const worker=createWatchtowerWorker({enabled:true,query,verify});
assert.equal((await worker()).reason,'corroboration_saved');assert.equal(fixtureReads,2);
assert.equal(await sql('SELECT state FROM public.watchtower_candidates WHERE signature='+literal(d)+';'),'processed');
assert.equal(await sql("SELECT corroboration->>'accountSlot' FROM public.watchtower_candidates WHERE signature="+literal(d)+';'),'125');
assert.equal(await sql("SELECT day_requests FROM public.watchtower_rpc_allowance WHERE scope='production';"),'4');
process.stdout.write('Isolated PostgreSQL acceptance passed: concurrent idempotency, conflict rollback, exclusive claims, expired-lease recovery, stale-worker rejection atomic evidence completion, bounded exhaustion and concurrent daily/monthly allowance limits and queue/transport/verifier composition.\n');
