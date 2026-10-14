import {spawn} from 'node:child_process';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {createWatchtowerRpcAllowance} from '../netlify/functions/_shared/watchtower-rpc-allowance.mjs';
import {createWatchtowerReceiptSink} from '../netlify/functions/_shared/watchtower-receipt-sink.mjs';
import {createCandidateVerifier} from '../netlify/functions/_shared/watchtower-verify-candidate.mjs';
import {createWatchtowerRpcTransport} from '../netlify/functions/_shared/watchtower-rpc-transport.mjs';
import {createWatchtowerWorker} from '../netlify/functions/_shared/watchtower-worker.mjs';
import {createWatchtowerDatabaseBindings} from '../netlify/functions/_shared/watchtower-database.mjs';
import {createWatchtowerServerHandler} from '../netlify/functions/_shared/watchtower-server.mjs';
import {WATCHTOWER_SOURCE_SHA256} from '../netlify/functions/_shared/watchtower-source-revision.mjs';
import {Pool} from 'pg';
import {createHash} from 'node:crypto';
import {rootCertificates} from 'node:tls';
const container=process.env.WATCHTOWER_TEST_CONTAINER;
const port=Number(process.env.WATCHTOWER_TEST_PORT);
if(process.env.GITHUB_ACTIONS!=='true'||typeof container!=='string'||!/^[a-f0-9]{12,64}$/.test(container)||!Number.isInteger(port)||port<1||port>65535)throw Error('Isolated CI service required');
function sql(statement){return new Promise((resolve,reject)=>{
 const child=spawn('docker',['exec','-i',container,'psql','-U','fixture','-d','postgres','-X','-q','-v','ON_ERROR_STOP=1','-At'],{stdio:['pipe','pipe','pipe']});
 let output='';child.stdout.on('data',data=>{output+=data;});child.stderr.resume();child.on('error',()=>reject(Error('Fixture query failed')));
 child.on('close',code=>code===0?resolve(output.trim()):reject(Error('Fixture query failed')));child.stdin.end(statement);
});}
const literal=value=>"'"+value.replaceAll("'","''")+"'";
// Fresh b sorts before conflicting a, proving an earlier insertion is rolled back.
const a='1'.repeat(63)+'2',b='1'.repeat(64),account='1'.repeat(32);
const candidate=(signature=a,slot=123)=>({signature,slot,matchedAccounts:[account]});
const enqueue=items=>'SELECT watchtower_private.enqueue_watchtower_candidates('+literal(JSON.stringify(items))+'::jsonb);';
await sql('CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;');
await sql(await readFile(new URL('../migrations/20261013_watchtower_candidates.sql',import.meta.url),'utf8'));
// Supabase-like roles cannot reach this private schema, tables or invoker functions.
assert.equal(await sql("SELECT bool_and(relrowsecurity AND relforcerowsecurity) FROM pg_class WHERE relnamespace='watchtower_private'::regnamespace AND relkind='r';"),'t');
assert.equal(await sql("SELECT bool_and(NOT has_schema_privilege(r,'watchtower_private','USAGE')) FROM unnest(ARRAY['anon','authenticated','service_role']) AS roles(r);"),'t');
for(const role of ['anon','authenticated','service_role']) {
 await assert.rejects(sql('SET ROLE '+role+'; SELECT count(*) FROM watchtower_private.watchtower_candidates;'));
 await assert.rejects(sql('SET ROLE '+role+"; SELECT watchtower_private.enqueue_watchtower_candidates('[]'::jsonb);"));
}
const receipts=await Promise.all(Array.from({length:20},()=>sql(enqueue([candidate()]))));
assert.ok(receipts.every(x=>x==='1'));assert.equal(await sql('SELECT count(*) FROM watchtower_private.watchtower_candidates;'),'1');
await assert.rejects(sql(enqueue([candidate(b),candidate(a,124)])));
assert.equal(await sql('SELECT count(*) FROM watchtower_private.watchtower_candidates;'),'1');
const claims=await Promise.all(Array.from({length:10},()=>sql('SELECT signature FROM watchtower_private.claim_watchtower_candidate();')));
assert.equal(claims.filter(Boolean).length,1);
await sql("UPDATE watchtower_private.watchtower_candidates SET lease_until=clock_timestamp()-interval '1 second';");
assert.equal(await sql('SELECT lease_version FROM watchtower_private.claim_watchtower_candidate();'),'2');
const evidence={schema:1,method:'rpc_corroborated_candidate',signature:a,transactionSlot:123,accountSlot:125,sourceAuthenticity:'rpc_response_not_cryptographically_verified',finality:'finalized_requested_from_reviewed_rpc',emitsFinding:false,states:[{account,state:'absent_at_account_slot',slot:125}]};
const evidenceSql=literal(JSON.stringify(evidence))+'::jsonb';
assert.equal(await sql('SELECT watchtower_private.finish_watchtower_candidate('+literal(a)+',1,'+evidenceSql+');'),'f');
assert.equal(await sql('SELECT corroboration IS NULL FROM watchtower_private.watchtower_candidates;'),'t');
await assert.rejects(sql('SELECT watchtower_private.finish_watchtower_candidate('+literal(a)+",2,'{}'::jsonb);"));
const malformedState={...evidence,states:[{account,state:'present_at_account_slot',slot:125,ownerProgram:null,executable:false,dataBytes:0,dataSha256:null,stateSha256:null}]};
await assert.rejects(sql('SELECT watchtower_private.finish_watchtower_candidate('+literal(a)+',2,'+literal(JSON.stringify(malformedState))+'::jsonb);'));
assert.equal(await sql('SELECT state FROM watchtower_private.watchtower_candidates;'),'leased');
assert.equal(await sql('SELECT corroboration IS NULL FROM watchtower_private.watchtower_candidates;'),'t');
assert.equal(await sql('SELECT watchtower_private.finish_watchtower_candidate('+literal(a)+',2,'+evidenceSql+');'),'t');
assert.equal(await sql("SELECT corroboration->>'signature' FROM watchtower_private.watchtower_candidates;"),a);
assert.equal(await sql('SELECT corroborated_at IS NOT NULL FROM watchtower_private.watchtower_candidates;'),'t');
assert.equal(await sql('SELECT count(*) FROM watchtower_private.claim_watchtower_candidate();'),'0');
await sql(enqueue([candidate()]));assert.equal(await sql('SELECT state FROM watchtower_private.watchtower_candidates;'),'processed');
await sql(enqueue([candidate(b)]));
await sql("UPDATE watchtower_private.watchtower_candidates SET attempts=5,state='leased',lease_until=clock_timestamp()-interval '1 second' WHERE signature="+literal(b)+';');
assert.equal(await sql('SELECT count(*) FROM watchtower_private.claim_watchtower_candidate();'),'0');
assert.equal(await sql('SELECT state FROM watchtower_private.watchtower_candidates WHERE signature='+literal(b)+';'),'exhausted');
const c='1'.repeat(63)+'3';
await sql(enqueue([candidate(c)]));
assert.equal(await sql('SELECT lease_version FROM watchtower_private.claim_watchtower_candidate();'),'1');
const presentEvidence={...evidence,signature:c,states:[{account,state:'present_at_account_slot',slot:125,ownerProgram:account,executable:false,dataBytes:0,dataSha256:'0'.repeat(64),stateSha256:'0'.repeat(64)}]};
assert.equal(await sql('SELECT watchtower_private.finish_watchtower_candidate('+literal(c)+',1,'+literal(JSON.stringify(presentEvidence))+'::jsonb);'),'t');
const reservation={purpose:'watchtower_candidate_verification',method:'getTransaction',maxRequests:1,maxResponseBytes:1048576};
const allowance=(dailyLimit,monthlyLimit,scope='preview')=>createWatchtowerRpcAllowance({scope,dailyLimit,monthlyLimit,query:async(statement,args)=>{
 const command=statement.replace(/\$([1-3])/g,(_,index)=>typeof args[Number(index)-1]==='string'?literal(args[Number(index)-1]):String(args[Number(index)-1]));
 const output=await sql(command+';');return {rowCount:output?1:0};
}});
const race=async run=>(await Promise.all(Array.from({length:20},()=>run(reservation)))).filter(Boolean).length;
assert.equal(await race(allowance(7,10)),7);
await sql("UPDATE watchtower_private.watchtower_rpc_allowance SET day_utc=day_utc-1 WHERE scope='preview';");
assert.equal(await race(allowance(7,10)),3);
assert.equal(await race(allowance(7,10)),0);
await sql("UPDATE watchtower_private.watchtower_rpc_allowance SET day_utc=day_utc-1,month_utc=(month_utc-interval '1 month')::date WHERE scope='preview';");
assert.equal(await race(allowance(7,10)),7);
assert.equal(await race(allowance(2,3,'production')),2);
await sql("UPDATE watchtower_private.watchtower_rpc_allowance SET day_utc=day_utc+1 WHERE scope='preview';");
assert.equal(await allowance(7,10)(reservation),false);
// Real queue/allowance queries with synthetic HTTP responses; no provider connection.
const query=async(statement,args)=>{
 if(statement.includes('claim_watchtower_candidate')){
  const output=await sql('SELECT row_to_json(c) FROM watchtower_private.claim_watchtower_candidate() AS c;');
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
assert.equal(await sql('SELECT state FROM watchtower_private.watchtower_candidates WHERE signature='+literal(d)+';'),'processed');
assert.equal(await sql("SELECT corroboration->>'accountSlot' FROM watchtower_private.watchtower_candidates WHERE signature="+literal(d)+';'),'125');
assert.equal(await sql("SELECT day_requests FROM watchtower_private.watchtower_rpc_allowance WHERE scope='production';"),'4');
// Apply runtime roles after generic recovery fixtures; these have no login or memberships.
await sql(await readFile(new URL('../sql/watchtower-runtime-access.sql',import.meta.url),'utf8'));
assert.equal(await sql("SELECT bool_and(NOT rolcanlogin AND NOT rolbypassrls AND NOT rolsuper AND NOT rolcreaterole AND NOT rolcreatedb) FROM pg_roles WHERE rolname IN ('watchtower_intake','watchtower_worker');"),'t');
const asRole=(role,statement)=>sql('SET ROLE '+role+'; '+statement);
const approvedAccount='Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV',e='1'.repeat(63)+'5';
const approvedCandidate={signature:e,slot:123,matchedAccounts:[approvedAccount]};
assert.equal(await asRole('watchtower_intake',enqueue([approvedCandidate])),'1');
assert.equal(await asRole('watchtower_intake',enqueue([approvedCandidate])),'1');
await assert.rejects(asRole('watchtower_intake',enqueue([candidate('1'.repeat(63)+'6')])));
await assert.rejects(asRole('watchtower_intake',"UPDATE watchtower_private.watchtower_candidates SET state='exhausted';"));
await assert.rejects(asRole('watchtower_intake',"UPDATE watchtower_private.watchtower_candidates SET signature="+literal('1'.repeat(63)+'7')+' WHERE signature='+literal(e)+';'));
await assert.rejects(asRole('watchtower_intake','SELECT * FROM watchtower_private.claim_watchtower_candidate();'));
await assert.rejects(asRole('watchtower_intake','SELECT * FROM watchtower_private.watchtower_rpc_allowance;'));
await assert.rejects(asRole('watchtower_worker',enqueue([approvedCandidate])));
assert.equal(await asRole('watchtower_worker','SELECT signature FROM watchtower_private.claim_watchtower_candidate();'),e);
await assert.rejects(asRole('watchtower_worker','UPDATE watchtower_private.watchtower_candidates SET slot=999;'));
await assert.rejects(asRole('watchtower_worker','DELETE FROM watchtower_private.watchtower_candidates;'));
assert.equal(await asRole('watchtower_worker',"SELECT count(*) FROM watchtower_private.watchtower_rpc_allowance WHERE scope='preview';"),'0');
await assert.rejects(asRole('watchtower_worker',"INSERT INTO watchtower_private.watchtower_rpc_allowance VALUES ('preview',current_date,date_trunc('month',current_date)::date,1,1);"));
for(const role of ['anon','authenticated','service_role'])await assert.rejects(asRole(role,'SELECT count(*) FROM watchtower_private.watchtower_candidates;'));
// Credential holders stay locked in the real template. Test actual role binding in this disposable service only.
await sql(await readFile(new URL('../sql/watchtower-server-logins.sql',import.meta.url),'utf8'));
await sql(await readFile(new URL('../sql/watchtower-pilot-intake-bound.sql',import.meta.url),'utf8'));
const readinessSql=await readFile(new URL('../sql/watchtower-readiness.sql',import.meta.url),'utf8');
const readiness=JSON.parse(await sql(readinessSql));
assert.equal(readiness.schema,1);assert.equal(readiness.status,'storage_prepared_credentials_locked');assert.equal(readiness.activationProven,false);
assert.ok(Object.values(readiness.checks).every(x=>x===true));
assert.equal(readiness.candidateCounts.candidates,Number(await sql('SELECT count(*) FROM watchtower_private.watchtower_candidates;')));
await sql('ALTER ROLE watchtower_intake_login LOGIN;');
assert.equal(JSON.parse(await sql(readinessSql)).status,'review_required');
await sql('ALTER ROLE watchtower_intake_login NOLOGIN;');
assert.equal(await sql("SELECT bool_and(NOT rolcanlogin AND NOT rolinherit AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolbypassrls AND rolconnlimit=2) FROM pg_roles WHERE rolname IN ('watchtower_intake_login','watchtower_worker_login');"),'t');
assert.equal(await sql("SELECT count(*) FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid JOIN pg_roles l ON l.oid=m.member WHERE (r.rolname,l.rolname) IN (('watchtower_intake','watchtower_intake_login'),('watchtower_worker','watchtower_worker_login')) AND NOT m.admin_option AND NOT m.inherit_option AND m.set_option;"),'2');
await assert.rejects(sql(await readFile(new URL('../sql/watchtower-server-logins.sql',import.meta.url),'utf8')));
for(const kind of ['intake','worker']){
 await assert.rejects(sql('SET SESSION AUTHORIZATION watchtower_'+kind+'_login; SELECT count(*) FROM watchtower_private.watchtower_candidates;'));
 const other=kind==='intake'?'worker':'intake';
 await assert.rejects(sql('SET SESSION AUTHORIZATION watchtower_'+kind+'_login; SET ROLE watchtower_'+other+';'));
 assert.equal(await sql('SET SESSION AUTHORIZATION watchtower_'+kind+'_login; BEGIN; SET LOCAL ROLE watchtower_'+kind+'; SELECT current_user||\',\'||session_user; COMMIT;'),
  'watchtower_'+kind+',watchtower_'+kind+'_login');
}
// A self-signed public fixture certificate and private key live only inside the disposable container.
const command=(program,args)=>new Promise((resolve,reject)=>{const child=spawn(program,args,{stdio:['ignore','pipe','pipe']});let output='';
 child.stdout.on('data',d=>{output+=d;});child.stderr.resume();child.on('error',()=>reject(Error('Fixture setup failed')));
 child.on('close',code=>code===0?resolve(output.trim()):reject(Error('Fixture setup failed')));});
const certDirectory=await mkdtemp(join(tmpdir(),'watchtower-ci-tls-'));let ca;
try{
 const certPath=join(certDirectory,'fixture.crt'),keyPath=join(certDirectory,'fixture.key');
 await command('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=aws-0-us-east-2.pooler.supabase.com',
  '-addext','subjectAltName=DNS:aws-0-us-east-2.pooler.supabase.com','-addext','basicConstraints=critical,CA:TRUE','-keyout',keyPath,'-out',certPath]);
 ca=await readFile(certPath,'utf8');
 await command('docker',['cp',certPath,container+':/tmp/watchtower-fixture.crt']);
 await command('docker',['cp',keyPath,container+':/tmp/watchtower-fixture.key']);
 await command('docker',['exec','-u','0',container,'sh','-c','chown postgres:postgres /tmp/watchtower-fixture.key /tmp/watchtower-fixture.crt && chmod 600 /tmp/watchtower-fixture.key']);
}finally{await rm(certDirectory,{recursive:true,force:true});}
await sql("ALTER SYSTEM SET ssl_cert_file='/tmp/watchtower-fixture.crt'; ALTER SYSTEM SET ssl_key_file='/tmp/watchtower-fixture.key'; ALTER SYSTEM SET ssl=on; SELECT pg_reload_conf();");
await new Promise(r=>setTimeout(r,200));assert.equal(await sql('SHOW ssl;'),'on');
const intakePassword='synthetic-fixture-intake-password',workerPassword='synthetic-fixture-worker-password';
await sql('ALTER ROLE watchtower_intake_login LOGIN PASSWORD '+literal(intakePassword)+'; ALTER ROLE watchtower_worker_login LOGIN PASSWORD '+literal(workerPassword)+';');
// This driver forces loopback and removes the Supavisor tenant suffix. It cannot contact a hosted project.
class LocalFixturePool extends Pool{constructor(config){super({...config,host:'127.0.0.1',port,user:config.user.split('.')[0]});}}
const connection={host:'aws-0-us-east-2.pooler.supabase.com',projectRef:'abcdefghijklmnopqrst',ca,
 caSha256:createHash('sha256').update(ca).digest('hex'),intakePassword,workerPassword};
for(const changed of [{intakePassword:'wrong-synthetic-intake-password'},
 {ca:rootCertificates[0],caSha256:createHash('sha256').update(rootCertificates[0]).digest('hex')},
 {host:'aws-9-us-east-2.pooler.supabase.com'}]){
 const denied=createWatchtowerDatabaseBindings({enabled:true,Pool:LocalFixturePool,connection:{...connection,...changed}});
 try{await assert.rejects(denied.intakeQuery('SELECT watchtower_private.enqueue_watchtower_candidates($1::jsonb) AS accepted',['[]']));}
 finally{await denied.close();}
}
class WrongIdentityPool extends LocalFixturePool{constructor(config){super({...config,user:'fixture',password:'fixture'});}}
const adminDenied=createWatchtowerDatabaseBindings({enabled:true,Pool:WrongIdentityPool,connection});
try{await assert.rejects(adminDenied.intakeQuery('SELECT watchtower_private.enqueue_watchtower_candidates($1::jsonb) AS accepted',['[]']));}
finally{await adminDenied.close();}
const bindings=createWatchtowerDatabaseBindings({enabled:true,Pool:LocalFixturePool,connection});
try{
 const f='1'.repeat(63)+'8',saved=await bindings.intakeQuery('SELECT watchtower_private.enqueue_watchtower_candidates($1::jsonb) AS accepted',[JSON.stringify([{signature:f,slot:123,matchedAccounts:[approvedAccount]}])]);
 assert.equal(saved.rows[0].accepted,1);
 await assert.rejects(bindings.intakeQuery('SELECT * FROM watchtower_private.claim_watchtower_candidate()',[]));
 const claimed=await bindings.workerQuery('SELECT * FROM watchtower_private.claim_watchtower_candidate()',[]);assert.equal(claimed.rows[0].signature,f);
}finally{await bindings.close();}
// Complete HTTP composition over the same disposable TLS service. The factory
// substitutes only its local fixture CA after the real server config validates.
// Requests and context are synthetic; no cloud route, secret or provider exists.
// Retire unfinished claims from earlier denial fixtures so their lease age cannot
// make this independent HTTP scenario claim an unrelated synthetic candidate.
await sql("UPDATE watchtower_private.watchtower_candidates SET state='exhausted',lease_until=NULL WHERE state='leased';");
const g='1'.repeat(63)+'9',serverTime=Date.now(),siteId='11111111-1111-4111-8111-111111111111';
const startup={additionalProviderSpendUsd:0,creditHeadroomChecked:true,automaticPurchasesDisabled:true,providerPauseReviewed:true,storageMigrationApproved:true,storageReady:true,limitsApproved:true,mainnetTransportReviewed:true,credentialProofReviewed:true,otherDatabaseScopeReviewed:true,providerWebhookCostsReviewed:true,intakeBoundReviewed:true};
const serverEnv={WATCHTOWER_PILOT_ENABLED:'true',WATCHTOWER_INTAKE_AUTHORIZATION:'Bearer '+'a'.repeat(43),WATCHTOWER_WORKER_AUTHORIZATION:'Bearer '+'b'.repeat(43),
 WATCHTOWER_ACTIVATION:JSON.stringify({schema:1,siteId,sourceSha256:WATCHTOWER_SOURCE_SHA256,startsAtUtc:new Date(serverTime-1000).toISOString(),endsAtUtc:new Date(serverTime+120000).toISOString(),startup}),
 WATCHTOWER_SUPABASE_PROJECT_REF:connection.projectRef,WATCHTOWER_SUPABASE_POOLER_HOST:connection.host,WATCHTOWER_INTAKE_DATABASE_PASSWORD:intakePassword,WATCHTOWER_WORKER_DATABASE_PASSWORD:workerPassword,WATCHTOWER_HELIUS_API_KEY:'synthetic-fixture-provider-key'};
const serverContext={site:{id:siteId},deploy:{context:'branch-deploy',published:false,id:'1'.repeat(24)}};
let serverReads=0;
const serverOptions={readEnv:name=>serverEnv[name],bindingsFactory:({connection:claimed})=>{
 assert.equal(claimed.projectRef,connection.projectRef);assert.equal(claimed.host,connection.host);
 return createWatchtowerDatabaseBindings({enabled:true,Pool:LocalFixturePool,connection:{...claimed,ca:connection.ca,caSha256:connection.caSha256}});
},fetcher:async(_,options)=>{serverReads++;const request=JSON.parse(options.body);
 return new Response(JSON.stringify({jsonrpc:'2.0',id:request.id,result:request.id===1?
  {slot:123,version:'legacy',meta:{err:null},transaction:{signatures:[g],message:{accountKeys:[approvedAccount]}}}:{context:{slot:125},value:[null]}}),{headers:{'content-type':'application/json'}});
}};
const serverIntake=createWatchtowerServerHandler({kind:'intake',...serverOptions}),serverWorker=createWatchtowerServerHandler({kind:'worker',...serverOptions});
const receipt=await serverIntake(new Request('https://fixture.invalid/api/watchtower/intake',{method:'POST',headers:{authorization:serverEnv.WATCHTOWER_INTAKE_AUTHORIZATION,'content-type':'application/json'},body:JSON.stringify([{signature:g,slot:123,accountData:[{account:approvedAccount}]}])}),serverContext);
assert.equal(receipt.status,200);assert.equal((await receipt.json()).code,'RECEIPT_ACCEPTED');
const completion=await serverWorker(new Request('https://fixture.invalid/api/watchtower/process-one',{method:'POST',headers:{authorization:serverEnv.WATCHTOWER_WORKER_AUTHORIZATION}}),serverContext);
assert.equal(completion.status,200);assert.equal((await completion.json()).code,'CORROBORATION_SAVED');assert.equal(serverReads,2);
assert.equal(await sql('SELECT state FROM watchtower_private.watchtower_candidates WHERE signature='+literal(g)+';'),'processed');
assert.equal(await sql("SELECT day_requests FROM watchtower_private.watchtower_rpc_allowance WHERE scope='production';"),'6');
// Independent synthetic bound scenario: only the fixture administrator resets
// its data. All ordinary inserts below run through the real intake capability.
await sql('TRUNCATE watchtower_private.watchtower_candidates;');
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const boundSignature=i=>'1'.repeat(62)+alphabet[Math.floor(i/58)]+alphabet[i%58];
const boundedCandidate=i=>({signature:boundSignature(i),slot:123,matchedAccounts:[approvedAccount]});
const isolationSql="BEGIN ISOLATION LEVEL REPEATABLE READ; SET ROLE watchtower_intake; DO $$ DECLARE message text; BEGIN BEGIN INSERT INTO watchtower_private.watchtower_candidates(signature,slot,matched_accounts) VALUES ('"+boundSignature(500)+"',123,'[\""+approvedAccount+"\"]'::jsonb); RAISE EXCEPTION 'Unexpected insert'; EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS message=MESSAGE_TEXT; IF message<>'Pilot intake requires read committed' THEN RAISE; END IF; END; END $$; ROLLBACK;";
await sql(isolationSql);assert.equal(await sql('SELECT count(*) FROM watchtower_private.watchtower_candidates;'),'0');
assert.equal(await asRole('watchtower_intake',enqueue(Array.from({length:99},(_,i)=>boundedCandidate(i)))),'99');
const boundedRace=await Promise.allSettled(Array.from({length:20},(_,i)=>asRole('watchtower_intake',enqueue([boundedCandidate(100+i)]))));
assert.equal(boundedRace.filter(r=>r.status==='fulfilled').length,1);
assert.equal(await sql('SELECT count(*) FROM watchtower_private.watchtower_candidates;'),'100');
assert.equal(await asRole('watchtower_intake',enqueue([boundedCandidate(0)])),'1');
await assert.rejects(asRole('watchtower_intake',enqueue([{...boundedCandidate(0),slot:124}])));
await assert.rejects(asRole('watchtower_intake',enqueue([boundedCandidate(0),boundedCandidate(200)])));
await assert.rejects(asRole('watchtower_intake',"INSERT INTO watchtower_private.watchtower_candidates(signature,slot,matched_accounts) VALUES ('"+boundSignature(201)+"',123,'[\""+approvedAccount+"\"]'::jsonb);"));
await assert.rejects(asRole('watchtower_intake','DELETE FROM watchtower_private.watchtower_candidates;'));
await sql("UPDATE watchtower_private.watchtower_candidates SET state='exhausted',lease_until=NULL WHERE signature="+literal(boundSignature(0))+';');
await assert.rejects(asRole('watchtower_intake',enqueue([boundedCandidate(202)])));
assert.equal(await sql('SELECT count(*) FROM watchtower_private.watchtower_candidates;'),'100');
// Relock only disposable credentials; no row, counter or password mutation.
const relockSql=await readFile(new URL('../sql/watchtower-relock.sql',import.meta.url),'utf8');
for(let attempt=0;attempt<2;attempt++){
 const closure=JSON.parse(await sql(relockSql));
 assert.equal(closure.schema,1);assert.equal(closure.status,'logins_locked_no_visible_database_sessions');
 assert.equal(closure.loginsLocked,true);assert.equal(closure.visibleDatabaseSessions,0);
 assert.equal(closure.upstreamPauseProven,false);assert.equal(closure.oldDeploymentCleanupProven,false);
}
assert.equal(await sql('SELECT count(*) FROM watchtower_private.watchtower_candidates;'),'100');
process.stdout.write('Isolated PostgreSQL acceptance passed: queue/recovery/allowance, restricted capability and credential roles, actual pg driver over fixture TLS, wrong password/CA/hostname/admin rejection, transaction-local role/identity checks, complete HTTP composition and the 100-row pilot bound under concurrency/direct inserts/replay/isolation changes. No hosted connection or provider call.\n');

