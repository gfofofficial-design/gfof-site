import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createHash} from 'node:crypto';
import {rootCertificates} from 'node:tls';
import {watchtowerPgConfigs,createWatchtowerDatabaseBindings} from '../netlify/functions/_shared/watchtower-database.mjs';
import {WATCHTOWER_ALLOWANCE_SQL} from '../netlify/functions/_shared/watchtower-rpc-allowance.mjs';

const ca=rootCertificates[0],host='aws-0-us-east-2.pooler.supabase.com';
const connection=()=>({projectRef:'abcdefghijklmnopqrst',host,ca,caSha256:createHash('sha256').update(ca).digest('hex'),
 intakePassword:'synthetic-intake-password-not-real',workerPassword:'synthetic-worker-password-not-real'});
const enqueue='SELECT watchtower_private.enqueue_watchtower_candidates($1::jsonb) AS accepted';
const claim='SELECT * FROM watchtower_private.claim_watchtower_candidate()';
const fixture=(options={})=>{
 const pools=[],calls=[],releases=[];
 class Pool extends EventEmitter{
  constructor(config){super();this.config=config;pools.push(this);this.kind=pools.length===1?'intake':'worker';}
  async connect(){if(options.connect)return options.connect(this);return this.client();}
  client(){const kind=this.kind;return {connection:{stream:{encrypted:true,authorized:true,getPeerCertificate:()=>({subjectaltname:'DNS:'+host}),...options.stream}},
   release:destroy=>releases.push({kind,destroy}),query:async(text,args)=>{
    calls.push({kind,text,args});if(options.query)return options.query(text,args,kind);
    if(text.startsWith('SELECT current_user'))return {rowCount:1,rows:[{runtime_role:'watchtower_'+kind,login_role:'watchtower_'+kind+'_login',
     database:'postgres',restricted:true,membership_count:'1',capability_memberships:'0',binding_matches:true,...options.identity}]};
    return {rowCount:1,rows:[{accepted:0}]};}};}
  async end(){this.ended=true;}
 }
 return {Pool,pools,calls,releases};
};

test('disabled factory needs no credentials and constructs no driver',async()=>{
 const run=createWatchtowerDatabaseBindings({Pool:class{constructor(){throw Error('must not construct');}}});
 assert.equal(run.status,'disabled');await assert.rejects(run.intakeQuery(enqueue,['[]']));await run.close();
});
test('structured pooler configuration pins distinct credentials, TLS hostname and small pools',()=>{
 const config=watchtowerPgConfigs(connection());
 assert.equal(config.intake.user,'watchtower_intake_login.abcdefghijklmnopqrst');assert.equal(config.worker.user,'watchtower_worker_login.abcdefghijklmnopqrst');
 assert.equal(config.intake.port,6543);assert.equal(config.intake.max,1);assert.equal(config.intake.database,'postgres');
 assert.equal(config.intake.ssl.rejectUnauthorized,true);assert.equal(config.intake.ssl.servername,host);assert.equal(config.intake.ssl.minVersion,'TLSv1.2');
 assert.ok(config.intake.ssl.checkServerIdentity('wrong-input',{subjectaltname:'DNS:wrong.invalid'}));
 assert.ok(!Object.hasOwn(config.intake,'connectionString'));assert.notEqual(config.intake.password,config.worker.password);
});
test('wrong host, changed CA, shared passwords and short passwords cannot construct a pool',()=>{
 for(const changed of [{host:'evil.invalid'},{projectRef:'bad'},{caSha256:'0'.repeat(64)},{ca:'not a certificate'},
  {intakePassword:'short'},{workerPassword:connection().intakePassword}]){
  assert.throws(()=>createWatchtowerDatabaseBindings({enabled:true,connection:{...connection(),...changed},Pool:class{constructor(){assert.fail('must not connect');}}}),
   e=>e.message==='Invalid Watchtower database configuration');
 }
});
test('two callbacks use different pools and a transaction-local role and identity check every time',async()=>{
 const f=fixture(),run=createWatchtowerDatabaseBindings({enabled:true,connection:connection(),Pool:f.Pool});
 await run.intakeQuery(enqueue,['[]']);await run.workerQuery(claim,[]);await run.intakeQuery(enqueue,['[]']);
 assert.equal(f.pools.length,2);assert.notEqual(run.intakeQuery,run.workerQuery);
 assert.equal(f.calls.filter(x=>x.text.startsWith('SELECT current_user')).length,3);
 assert.equal(f.calls.filter(x=>x.text==='SET LOCAL ROLE watchtower_intake').length,2);
 for(const kind of ['intake','worker']){const texts=f.calls.filter(x=>x.kind===kind).map(x=>x.text);assert.equal(texts[0],'BEGIN');assert.equal(texts.at(-1),'COMMIT');}
 assert.ok(f.releases.every(x=>x.destroy===false));await run.close();assert.ok(f.pools.every(x=>x.ended));
});
test('plaintext, unauthorized TLS and wrong certificate name stop before any SQL',async()=>{
 for(const stream of [{encrypted:false},{authorized:false},{getPeerCertificate:()=>({subjectaltname:'DNS:wrong.invalid'})}]){
  const f=fixture({stream}),run=createWatchtowerDatabaseBindings({enabled:true,connection:connection(),Pool:f.Pool});
  await assert.rejects(run.intakeQuery(enqueue,['[]']));assert.equal(f.calls.length,0);assert.deepEqual(f.releases,[{kind:'intake',destroy:true}]);await run.close();
 }
});
test('admin, wrong database/login/capability and unexpected membership stop before business SQL',async()=>{
 for(const identity of [{runtime_role:'postgres'},{login_role:'watchtower_worker_login'},{database:'wrong'},
  {restricted:false},{membership_count:'2'},{capability_memberships:'1'},{binding_matches:false}]){
  const f=fixture({identity}),run=createWatchtowerDatabaseBindings({enabled:true,connection:connection(),Pool:f.Pool});
  await assert.rejects(run.intakeQuery(enqueue,['[]']));assert.ok(!f.calls.some(x=>x.text===enqueue||x.text==='COMMIT'));
  assert.deepEqual(f.releases,[{kind:'intake',destroy:true}]);await run.close();
 }
});
test('cross-role SQL, arbitrary statements and named prepared-query objects never acquire a connection',async()=>{
 const f=fixture(),run=createWatchtowerDatabaseBindings({enabled:true,connection:connection(),Pool:f.Pool});
 for(const [call,sql,args] of [[run.intakeQuery,claim,[]],[run.workerQuery,enqueue,['[]']],[run.workerQuery,'SELECT 1',[]],
  [run.workerQuery,{name:'prepared',text:claim},[]],[run.workerQuery,claim,['unexpected']]])await assert.rejects(call(sql,args));
 assert.equal(f.calls.length,0);await run.close();
});
test('worker may bind parameterized allowance but never intake SQL',async()=>{
 const f=fixture(),run=createWatchtowerDatabaseBindings({enabled:true,connection:connection(),Pool:f.Pool});
 await run.workerQuery(WATCHTOWER_ALLOWANCE_SQL,['production',2000,60000]);
 assert.deepEqual(f.calls.find(x=>x.text===WATCHTOWER_ALLOWANCE_SQL).args,['production',2000,60000]);await run.close();
});
test('deadline while acquiring rejects and destroys a late client without executing SQL',async()=>{
 let resolve;const f=fixture({connect:()=>new Promise(r=>{resolve=r;})}),run=createWatchtowerDatabaseBindings({enabled:true,connection:connection(),Pool:f.Pool,timeoutMs:10});
 await assert.rejects(run.intakeQuery(enqueue,['[]']));resolve(f.pools[0].client());await new Promise(r=>setTimeout(r,0));
 assert.equal(f.calls.length,0);assert.deepEqual(f.releases,[{kind:'intake',destroy:true}]);await run.close();
});
test('cancellation during identity check destroys the connection and prevents a later write',async()=>{
 const controller=new AbortController();let resolve;const f=fixture({query:text=>text.startsWith('SELECT current_user')?new Promise(r=>{resolve=r;}):Promise.resolve({rows:[]})});
 const run=createWatchtowerDatabaseBindings({enabled:true,connection:connection(),Pool:f.Pool});
 const pending=run.intakeQuery(enqueue,['[]'],{signal:controller.signal});while(!resolve)await new Promise(r=>setImmediate(r));
 controller.abort();await assert.rejects(pending);resolve({rowCount:1,rows:[]});await new Promise(r=>setTimeout(r,0));
 assert.ok(!f.calls.some(x=>x.text===enqueue||x.text==='COMMIT'));assert.deepEqual(f.releases,[{kind:'intake',destroy:true}]);await run.close();
});
test('database errors and ambiguous commit failures expose no password or client diagnostic and never retry',async()=>{
 for(const failing of ['BEGIN','COMMIT']){
  const f=fixture({query:(text,args,kind)=>{
   if(text===failing)throw Error('private '+connection().intakePassword);
   if(text.startsWith('SELECT current_user'))return {rowCount:1,rows:[{runtime_role:'watchtower_'+kind,login_role:'watchtower_'+kind+'_login',database:'postgres',restricted:true,membership_count:1,capability_memberships:0,binding_matches:true}]};
   return {rowCount:1,rows:[]};
  }}),run=createWatchtowerDatabaseBindings({enabled:true,connection:connection(),Pool:f.Pool});
  await assert.rejects(run.intakeQuery(enqueue,['[]']),e=>e.message==='Watchtower database unavailable; completion may be uncertain');
  assert.equal(f.calls.filter(x=>x.text===failing).length,1);assert.deepEqual(f.releases,[{kind:'intake',destroy:true}]);await run.close();
 }
});
test('aborted or closed bindings cannot start work',async()=>{
 const f=fixture(),run=createWatchtowerDatabaseBindings({enabled:true,connection:connection(),Pool:f.Pool}),controller=new AbortController();controller.abort();
 await assert.rejects(run.intakeQuery(enqueue,['[]'],{signal:controller.signal}));await run.close();await assert.rejects(run.workerQuery(claim,[]));assert.equal(f.calls.length,0);
});
