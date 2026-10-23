import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {rootCertificates} from 'node:tls';
import {controlTransport,controlTransportProfile} from './control-transport.mjs';
import {createAllianceAnchorStore,createAllianceControlStore} from './control-store.mjs';
const controlProjectRef='opqrstuvwxyzabcdefgh',memberProjectRef='abcdefghijklmnopqrst',journalProjectRef='uvwxyzabcdefghijklmn',epoch='11111111-1111-4111-8111-111111111111';
const host='aws-0-us-east-2.pooler.supabase.com',zero='0'.repeat(64),reader='alliance_control_reader';
const scope={memberProjectRef,journalProjectRef,controlProjectRef,epoch};
async function harness({writer=false,identityActor,connectionProfile='supabase-session',deploymentProfile='supabase-managed',connectionHost=host,postflight=false,enabled=true,...extra}={}){
 let config,opens=0,scans=0;const calls=[],releases=[],actor=writer?'alliance_control_anchor_writer':reader;
 const anchor={format:1,memberProjectRef,journalProjectRef,epoch,sequence:0,sha256:zero};
 const client=Object.assign(new EventEmitter(),{release:v=>releases.push(v),async query(q){calls.push(q.text);
  if(q.text.startsWith('select current_database')){scans++;return {rows:[{database:'postgres',actor:identityActor??actor,login:identityActor??actor,tls:true,restricted:true,isolated:!(postflight&&scans===2),limited:true,durable:true,dedicated:true}]};}
  if(q.text.startsWith('SELECT alliance_control.'))return {rows:[{result:writer?{state:'anchored',anchor}:anchor}]};
  return {command:q.text==='COMMIT'?'COMMIT':'SET'};
 }});
 const store=await createAllianceAnchorStore({enabled,writeEnabled:writer,connectionProfile,deploymentProfile,...scope,connection:{host:connectionHost,password:'synthetic-session-transport-only',ca:rootCertificates[0]},openPool:c=>{config=c;return {on(){},async connect(){opens++;return client;},end(){}};},...extra});
 return {store,calls,releases,get config(){return config;},get opens(){return opens;},get scans(){return scans;}};
}
test('direct remains the default and binds the exact project hostname and raw role',()=>{
 assert.equal(controlTransportProfile(),'direct');
 assert.deepEqual(controlTransport({projectRef:controlProjectRef,role:reader,host:`db.${controlProjectRef}.supabase.co`}),{host:`db.${controlProjectRef}.supabase.co`,servername:`db.${controlProjectRef}.supabase.co`,user:reader});
});
test('session route binds the observed Ohio host and exact project-qualified role',()=>{
 for(const role of [reader,'alliance_control_anchor_writer'])assert.deepEqual(controlTransport({profile:'supabase-session',projectRef:controlProjectRef,role,host}),{host,servername:host,user:`${role}.${controlProjectRef}`});
});
test('wrong route, port suffix, host suffix, URI, credential text and arbitrary pooler all refuse',()=>{
 for(const wrong of [`${host}:6543`,`${host}.evil.invalid`,`postgresql://${host}`,`reader@${host}`,'aws-1-us-east-2.pooler.supabase.com','aws-0-us-west-1.pooler.supabase.com',`db.${controlProjectRef}.supabase.co`])assert.throws(()=>controlTransport({profile:'supabase-session',projectRef:controlProjectRef,role:reader,host:wrong}));
 assert.throws(()=>controlTransport({projectRef:controlProjectRef,role:reader,host}));
});
test('unknown profiles, invalid project refs and privileged or prequalified roles refuse',()=>{
 for(const profile of [null,false,'transaction','auto','session',{},['direct']])assert.throws(()=>controlTransportProfile(profile));
 for(const projectRef of ['',memberProjectRef+'.evil',controlProjectRef.toUpperCase()])assert.throws(()=>controlTransport({profile:'supabase-session',projectRef,role:reader,host}));
 for(const role of ['postgres','alliance_control_operator',`${reader}.${controlProjectRef}`])assert.throws(()=>controlTransport({profile:'supabase-session',projectRef:controlProjectRef,role,host}));
});
test('session configuration remains off without an explicit managed deployment profile',async()=>{
 for(const deploymentProfile of ['strict',undefined])await assert.rejects(createAllianceControlStore({connectionProfile:'supabase-session',deploymentProfile}));
 const f=await harness({enabled:false});await assert.rejects(f.store.read());assert.equal(f.opens,0);await f.store.close();
});
test('session connection keeps TLS hostname validation, fixed database/port and original request budgets',async()=>{
 const f=await harness();await f.store.read();assert.equal(f.config.user,`${reader}.${controlProjectRef}`);assert.equal(f.config.host,host);assert.equal(f.config.port,5432);assert.equal(f.config.database,'postgres');
 assert.deepEqual(f.config.ssl,{ca:rootCertificates[0],rejectUnauthorized:true,minVersion:'TLSv1.2',servername:host});assert.equal(f.config.enableChannelBinding,true);assert.equal(f.config.sslnegotiation,'postgres');assert.equal(f.config.max,2);assert.equal(f.config.connectionTimeoutMillis,1000);assert.equal(f.config.statement_timeout,750);assert.equal(f.scans,2);assert.equal(f.calls.at(-2),'COMMIT');assert.equal(f.calls[2],f.calls.at(-1));await f.store.close();
});
test('pooler-qualified backend actor is refused before any application query',async()=>{
 const f=await harness({identityActor:`${reader}.${controlProjectRef}`});await assert.rejects(f.store.read());assert.equal(f.calls.filter(x=>x.startsWith('SELECT alliance_control.')).length,0);assert.deepEqual(f.releases,[true]);assert.equal(f.opens,1);await f.store.close();
});
test('session actor mismatch never authorizes an anchor mutation',async()=>{
 const f=await harness({writer:true,identityActor:'postgres'});await assert.rejects(f.store.advance({expected:{sequence:0,sha256:zero},through:{sequence:0,sha256:zero},records:[]}),e=>e.outcome==='not_started');assert.equal(f.calls.filter(x=>x.startsWith('SELECT alliance_control.')).length,0);await f.store.close();
});
test('session post-COMMIT drift keeps a write unknown and never retries or falls back',async()=>{
 const f=await harness({writer:true,postflight:true});await assert.rejects(f.store.advance({expected:{sequence:0,sha256:zero},through:{sequence:0,sha256:zero},records:[]}),e=>e.outcome==='unknown');assert.equal(f.opens,1);assert.equal(f.calls.filter(x=>x.startsWith('SELECT alliance_control.')).length,1);assert.deepEqual(f.releases,[true]);await f.store.close();
});
test('wrong or cross-wired session scope and extra connection parameters refuse before a pool opens',async()=>{
 for(const options of [{controlProjectRef:memberProjectRef},{journalProjectRef:controlProjectRef},{connectionHost:`db.${controlProjectRef}.supabase.co`},{connection:{host,password:'synthetic-session-transport-only',ca:rootCertificates[0],port:6543}}])await assert.rejects(harness(options));
});
test('the existing direct construction still uses the original raw-role and project TLS target',async()=>{
 const f=await harness({connectionProfile:'direct',connectionHost:`db.${controlProjectRef}.supabase.co`});await f.store.read();assert.equal(f.config.user,reader);assert.equal(f.config.ssl.servername,`db.${controlProjectRef}.supabase.co`);await f.store.close();
});
