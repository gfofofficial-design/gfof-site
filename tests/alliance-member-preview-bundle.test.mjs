import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createHash} from 'node:crypto';
import {rootCertificates} from 'node:tls';
import {createManagedAlliancePreviewBundle} from '../lib/alliance-member-preview-bundle.mjs';

const scope={memberProjectRef:'abcdefghijklmnopqrst',journalProjectRef:'uvwxyzabcdefghijklmn',controlProjectRef:'opqrstuvwxyzabcdefgh',epoch:'11111111-1111-4111-8111-111111111111'};
const origin='https://deploy-preview-163--gfof.netlify.app';
const expectedInstallation={siteId:'11111111-2222-4333-8444-555555555555',deployId:'1234567890abcdef12345678',context:'deploy-preview'};
const context={site:{id:expectedInstallation.siteId},deploy:{id:expectedInstallation.deployId,context:expectedInstallation.context}};
function fixture({failPool=0,openMedia}={}){
  const key=()=>generateKeyPairSync('ed25519'),caller=key(),control=key(),journal=key();
  const hex=p=>Buffer.from(p.publicKey.export({format:'jwk'}).x,'base64url').toString('hex');
  const spki=caller.publicKey.export({format:'der',type:'spki'}),pools=[];
  let keyReads=0,network=0,mediaClosed=0,queries=0,mediaOpened=0;
  const media={processor:{process(){throw Error('Not an image journey');}},storage:{upload(){throw Error('Not an image journey');}},close(){mediaClosed++;}};
  const options={enabled:true,configuration:{origin,key:'sb_publishable_synthetic_preview_bundle_only',scope:{...scope},minimum:{sequence:0,sha256:'0'.repeat(64)},minimumRevision:1,expectedInstallation:{...expectedInstallation},
    reviewerActor:'22222222-2222-4222-8222-222222222222',gateway:{apiId:'abcdefghij',region:'us-east-2',stage:'preview'},resource:{accountId:'123456789012',region:'us-east-2',functionName:'alliance-member-authority-synthetic',version:'1'},
    callerKey:{keyId:createHash('sha256').update(spki).digest('hex'),spki:spki.toString('base64'),notBeforeUtc:new Date(Date.now()-60000).toISOString(),notAfterUtc:new Date(Date.now()+3600000).toISOString()},
    controlVerificationKey:hex(control),journalVerificationKey:hex(journal)},
    connections:Object.fromEntries([['member',scope.memberProjectRef],['journal',scope.journalProjectRef],['anchor',scope.controlProjectRef]].map(([name,ref])=>[name,{host:`db.${ref}.supabase.co`,password:'synthetic-preview-bundle-password-only',ca:rootCertificates[0]}])),
    readCallerSecret(){keyReads++;return caller.privateKey.export({format:'der',type:'pkcs8'}).toString('base64');},
    transport(){network++;throw Error('No authority request permitted');},fetcher(){network++;throw Error('No Auth request permitted');},
    openPool(config){
      if(failPool&&pools.length+1===failPool)throw Error('private-connection-error');
      const pool={config,ends:0,on(){},async end(){this.ends++;},async connect(){queries++;throw Error('No SQL request permitted');}};
      pools.push(pool);return pool;
    },
    openMedia:async input=>{mediaOpened++;return openMedia?openMedia(input,media):media;}};
  return {options,pools,context,media,get counts(){return {keyReads,network,mediaClosed,queries,mediaOpened};}};
}

test('default-off construction never reads private configuration or dependencies',async()=>{
  const trap=new Proxy({},{get(){throw Error('private');}});
  const bundle=await createManagedAlliancePreviewBundle({configuration:trap,connections:trap,readCallerSecret:trap,openMedia:trap});
  assert.deepEqual(await bundle.application.prepare(trap,trap),{state:'quarantine',access:'closed'});
  assert.equal((await bundle.application.handle(null,trap)).status,404);await bundle.close();
});

test('real adapters form the complete closed application; repeated close retires each owned pool once',async()=>{
  const f=fixture(),bundle=await createManagedAlliancePreviewBundle(f.options);
  assert.deepEqual(Object.keys(bundle),['application','close']);
  assert.equal((await bundle.application.handle(new Request(origin+'/api/alliance-members/me'),f.context)).status,503);
  assert.equal(f.pools.length,6);
  assert.deepEqual(f.pools.map(p=>p.config.user),['alliance_avatar_executor','alliance_avatar_executor','alliance_avatar_executor','alliance_avatar_executor','alliance_journal_executor','alliance_control_anchor_writer']);
  assert.deepEqual(f.counts,{keyReads:0,network:0,mediaClosed:0,queries:0,mediaOpened:1});
  await Promise.all([bundle.application.close(),bundle.close()]);assert.ok(f.pools.every(p=>p.ends===1));assert.equal(f.counts.mediaClosed,1);
  assert.deepEqual(await bundle.application.prepare({},f.context),{state:'quarantine',access:'closed'});
});

test('wrong purpose connection and production context refuse before resource construction',async()=>{
  for(const change of [f=>{f.options.connections.journal.host=f.options.connections.member.host;},f=>{f.options.configuration.expectedInstallation.context='production';},f=>{f.options.readCallerSecret=undefined;}]){
    const f=fixture();change(f);await assert.rejects(createManagedAlliancePreviewBundle(f.options),/^Error: alliance_preview_bundle_unavailable$/);
    assert.equal(f.pools.length,0);assert.equal(f.counts.mediaOpened,0);assert.equal(f.counts.keyReads,0);
  }
});

test('a later database-construction failure closes all earlier pools without exposing its error',async()=>{
  const f=fixture({failPool:6});await assert.rejects(createManagedAlliancePreviewBundle(f.options),/^Error: alliance_preview_bundle_unavailable$/);
  assert.equal(f.pools.length,5);assert.ok(f.pools.every(p=>p.ends===1));assert.deepEqual(f.counts,{keyReads:0,network:0,mediaClosed:0,queries:0,mediaOpened:0});
});

test('application validation failure also retires media and every database pool',async()=>{
  const f=fixture();f.options.configuration.reviewerActor='invalid';
  await assert.rejects(createManagedAlliancePreviewBundle(f.options),/^Error: alliance_preview_bundle_unavailable$/);
  assert.ok(f.pools.every(p=>p.ends===1));assert.equal(f.counts.mediaClosed,1);
});

test('cancellation closes existing connections and retires a late media result',async()=>{
  let resolve,started;
  const ready=new Promise(r=>{started=r;}),gate=new Promise(r=>{resolve=r;}),controller=new AbortController();
  const f=fixture({openMedia:async()=>{started();return gate;}});f.options.signal=controller.signal;
  const pending=createManagedAlliancePreviewBundle(f.options);await ready;controller.abort();
  await new Promise(r=>setImmediate(r));assert.ok(f.pools.every(p=>p.ends===1));
  resolve(f.media);await assert.rejects(pending,/alliance_preview_bundle_unavailable/);
  assert.equal(f.counts.mediaClosed,1);assert.equal(f.counts.network,0);assert.equal(f.counts.keyReads,0);
});
