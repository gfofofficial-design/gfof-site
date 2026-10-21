// Synthetic native-codec/gateway composition; no database or provider network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createAvatarFlow} from './flow.mjs';
import {createAvatarProcessor} from '../alliance-avatar-runtime/processor.mjs';
import {createAllianceAvatarStorage} from '../alliance-avatar-storage.mjs';
test('actual child decoder and gateway compose once; only the derivative descriptor is committed',async()=>{
  const actorId='11111111-1111-4111-8111-111111111111',operationId='22222222-2222-4222-8222-222222222222',objectId='33333333-3333-4333-8333-333333333333',profileId='44444444-4444-4444-8444-444444444444';
  const key=`v1/${profileId}/${objectId}.png`,calls=[];let descriptor,stored;
  const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWMQjG34DwADXwHuQa7szAAAAABJRU5ErkJggg==','base64');
  const ledger={async reserve(){calls.push('reserve');return {dispatch:true,state:'reserved',objectId};},
    async claimUpload(_actor,_operation,value){calls.push('claim');descriptor=value;return {dispatch:true,objectId,key};},
    async commitUpload(_actor,_operation,value){calls.push('commit');assert.equal(value.verified,true);assert.equal(value.receipt.sha256,descriptor.sha256);return {state:'committed',version:1};},
    async cancelReserved(){assert.fail('decoder unexpectedly failed');},async settleUnpublished(){assert.fail('proof unexpectedly unverified');},async operationReceipt(){return {state:'committed'};}};
  const storage=createAllianceAvatarStorage({enabled:true,origin:'https://abcdefghijklmnopqrst.supabase.co',apiKey:'sb_publishable_synthetic_fixture_only_12345',bearerToken:'syntheticHeader.syntheticClaims.syntheticSignature',fetcher:async(_url,init)=>{
    calls.push(init.method);
    if(init.method==='POST'){stored=Buffer.from(init.body);assert.equal(createHash('sha256').update(stored).digest('hex'),descriptor.sha256);return new Response(JSON.stringify({Key:'alliance-member-images-v1/'+key,Id:'55555555-5555-4555-8555-555555555555'}),{headers:{'Content-Type':'application/json'}});}
    return new Response(stored,{headers:{'Content-Type':'image/png'}});
  }});
  const flow=createAvatarFlow({enabled:true,ledger,processor:createAvatarProcessor({enabled:true}),storage});
  assert.deepEqual(await flow.replace({actorId,operationId,version:0,bytes,mime:'image/png'}),{state:'committed',version:1});
  assert.deepEqual(calls,['reserve','claim','POST','GET','commit']);assert.equal(descriptor.mime,'image/png');assert.equal(descriptor.width,1);assert.equal(descriptor.height,1);flow.close();
});
