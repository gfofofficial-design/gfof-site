import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {accountHandoffBytes} from './account-handoff.mjs';
import {prepareInitialAccountRoot as prepare,reviewInitialAccountRoot as review,reviewInitialAccountRootReadback as readback} from './account-root-preparation.mjs';
const error=/^Error: alliance_account_root_preparation_unavailable$/,zero='0'.repeat(64),sha=b=>createHash('sha256').update(b).digest('hex');
function fixture(patch={}){
 const scope={memberProjectRef:'abcdefghijklmnopqrst',journalProjectRef:'uvwxyzabcdefghijklmn',controlProjectRef:'opqrstuvwxyzabcdefgh',epoch:'11111111-1111-4111-8111-111111111111'};
 const resource={accountId:'123456789012',region:'us-east-2',tableName:'alliance-account-authority-synthetic',tableId:'22222222-2222-4222-8222-222222222222',rootKey:'c'.repeat(64),custodyId:'d'.repeat(64)};
 const record={format:1,scope,generation:1,previousSha256:zero,verificationKey:'b'.repeat(64),minimum:{head:{sequence:0,sha256:zero},acknowledged:{sequence:0,sha256:zero}},pending:null},bytes=accountHandoffBytes(record);
 const tableDescription={Table:{TableArn:`arn:aws:dynamodb:us-east-2:123456789012:table/${resource.tableName}`,TableId:resource.tableId,TableName:resource.tableName,TableStatus:'ACTIVE',DeletionProtectionEnabled:true,BillingModeSummary:{BillingMode:'PAY_PER_REQUEST'},KeySchema:[{AttributeName:'rootKey',KeyType:'HASH'}],AttributeDefinitions:[{AttributeName:'rootKey',AttributeType:'S'}],ItemCount:0}};
 return {resource,scope,verificationKey:record.verificationKey,receipt:{generation:1,sha256:sha(bytes)},bytes,tableDescription,ttlDescription:{TimeToLiveDescription:{TimeToLiveStatus:'DISABLED'}},...patch};
}
const observation=(input,p)=>({tableDescription:structuredClone(input.tableDescription),ttlDescription:structuredClone(input.ttlDescription),item:structuredClone(p.putItem.Item)});
test('offline preparation imports with no inherited credentials or credential lookup and exports no apply function',()=>{
 // Built-in ESM/assert loading may probe Node loader/color flags; none of those
 // receives a value here. Application/credential namespaces remain forbidden.
 const code=`const original=process.env;process.env=new Proxy({},{get(_,name){if(/^(AWS_|NETLIFY_|FEDERATION_|SUPABASE_|PG|DATABASE_URL)/.test(String(name)))throw Error('forbidden credential lookup');return undefined;},ownKeys(){throw Error('forbidden enumeration');}});try{const m=await import(${JSON.stringify(new URL('./account-root-preparation.mjs',import.meta.url).href)});if(JSON.stringify(Object.keys(m).sort())!==JSON.stringify(['prepareInitialAccountRoot','reviewInitialAccountRoot','reviewInitialAccountRootReadback']))throw Error('unexpected export');}finally{process.env=original;}`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',code],{env:{TZ:'UTC'},encoding:'utf8',timeout:15000});assert.equal(child.status,0,child.stderr);assert.equal(child.stdout,'');
});
test('only an externally supplied canonical empty generation-one checkpoint prepares the exact conditional request and strong read',()=>{
 const f=fixture(),p=prepare(f);assert.equal(p.purpose,'first-install-review-only');assert.equal(p.putItem.TableName,f.tableDescription.Table.TableArn);assert.equal(p.putItem.ConditionExpression,'attribute_not_exists(#root)');assert.deepEqual(p.putItem.ExpressionAttributeNames,{'#root':'rootKey'});assert.equal(p.getItem.ConsistentRead,true);assert.deepEqual(Buffer.from(p.putItem.Item.bytes.B,'base64'),f.bytes);assert.equal(review({input:f,prepared:p}).matches,true);assert.deepEqual(p.receipt,f.receipt);
 const reviewBefore=review({input:f,prepared:p});f.tableDescription.Table.ItemCount=12345;assert.deepEqual(review({input:f,prepared:p}),reviewBefore); // no false empty-history proof
});
test('missing bindings, malformed resources, conflated custody and approximate empty tables do not supply a checkpoint',()=>{
 for(const name of Object.keys(fixture())){const f=fixture();delete f[name];assert.throws(()=>prepare(f),error);}
 for(const patch of [{accountId:123456789012},{region:'eu-west-1'},{tableName:'alliance-account-nonce-synthetic'},{tableId:'bad'},{rootKey:zero},{custodyId:'c'.repeat(64)},{extra:true}]){const f=fixture();Object.assign(f.resource,patch);assert.throws(()=>prepare(f),error);}
 const f=fixture();delete f.receipt;assert.equal(f.tableDescription.Table.ItemCount,0);assert.throws(()=>prepare(f),error);
});
test('existing history, pending work, later generations, wrong independently retained digest/scope/key and noncanonical bytes refuse',()=>{
 for(const patch of [{generation:2,previousSha256:'a'.repeat(64)},{minimum:{head:{sequence:1,sha256:'a'.repeat(64)},acknowledged:{sequence:0,sha256:zero}}},{pending:{id:'e'.repeat(64),kind:'acknowledgement_advance',event:null,expected:{sequence:0,sha256:zero},target:{sequence:0,sha256:zero}}}]){
  const f=fixture(),record={...JSON.parse(f.bytes),...patch};f.bytes=accountHandoffBytes(record);f.receipt={generation:record.generation,sha256:sha(f.bytes)};assert.throws(()=>prepare(f),error);
 }
 for(const mutate of [f=>f.receipt.sha256='a'.repeat(64),f=>f.scope.epoch='33333333-3333-4333-8333-333333333333',f=>f.verificationKey='a'.repeat(64),f=>{f.bytes=Buffer.concat([f.bytes,Buffer.from('\n')]);f.receipt.sha256=sha(f.bytes);},f=>{f.bytes=Buffer.from(f.bytes.toString().replace('"format":1','"format":1,"format":1'));f.receipt.sha256=sha(f.bytes);}]){const f=fixture();mutate(f);assert.throws(()=>prepare(f),error);}
});
test('table-generation, TTL, deletion protection, schema, replicas/indexes/streams and capacity drift refuse',()=>{
 for(const patch of [{TableArn:'arn:aws:dynamodb:us-east-2:000000000000:table/other'},{TableId:'33333333-3333-4333-8333-333333333333'},{TableStatus:'CREATING'},{DeletionProtectionEnabled:false},{BillingModeSummary:{BillingMode:'PROVISIONED'}},{KeySchema:[{AttributeName:'other',KeyType:'HASH'}]},{AttributeDefinitions:[{AttributeName:'rootKey',AttributeType:'N'}]},{GlobalSecondaryIndexes:[{}]},{LocalSecondaryIndexes:[{}]},{Replicas:[{}]},{StreamSpecification:{StreamEnabled:true}}]){const f=fixture();Object.assign(f.tableDescription.Table,patch);assert.throws(()=>prepare(f),error);}
 for(const state of ['ENABLING','ENABLED','DISABLING',undefined]){const f=fixture();f.ttlDescription.TimeToLiveDescription.TimeToLiveStatus=state;assert.throws(()=>prepare(f),error);}
});
test('review rejects removal or broadening of the no-overwrite guard, altered target/item and extra operations',()=>{
 const f=fixture(),p=prepare(f);for(const mutate of [p=>delete p.putItem.ConditionExpression,p=>p.putItem.ConditionExpression='attribute_exists(#root)',p=>p.putItem.ExpressionAttributeNames['#root']='custodyId',p=>p.putItem.TableName='other',p=>p.putItem.Item.rootKey.S='e'.repeat(64),p=>p.putItem.ReturnValues='ALL_OLD',p=>p.putItem.Item.expiresAt={N:'1'},p=>p.deleteItem={},p=>p.getItem.ConsistentRead=false,p=>p.resource.tableId='33333333-3333-4333-8333-333333333333']){const changed=structuredClone(p);mutate(changed);assert.throws(()=>review({input:f,prepared:changed}),error);}
});
test('readback matches exact supplied bytes/binding only, never confers serving or initialization authorization',()=>{
 const f=fixture(),p=prepare(f),seen=observation(f,p),r=readback({input:f,prepared:p,observation:seen});assert.equal(r.matchesSuppliedReadback,true);assert.equal(r.access,'closed');assert.deepEqual(r.receipt,f.receipt);assert.equal(r.planSha256,review({input:f,prepared:p}).sha256);assert.equal(Object.hasOwn(r,'committed'),false);
 for(const mutate of [v=>delete v.item,v=>v.item.generation.N='2',v=>v.item.bytes.B+='\n',v=>v.item.custodyId.S='e'.repeat(64),v=>v.item.expiresAt={N:'1'},v=>v.tableDescription.Table.TableId='33333333-3333-4333-8333-333333333333',v=>v.ttlDescription.TimeToLiveDescription.TimeToLiveStatus='ENABLED']){const changed=structuredClone(seen);mutate(changed);assert.throws(()=>readback({input:f,prepared:p,observation:changed}),error);}
});
test('prepared bytes, scope, receipt and resource have no mutable aliases to caller inputs',()=>{
 const f=fixture(),p=prepare(f),original=structuredClone(p);f.bytes.fill(0);f.resource.rootKey='f'.repeat(64);f.scope.memberProjectRef='zzzzzzzzzzzzzzzzzzzz';f.receipt.sha256='a'.repeat(64);assert.deepEqual(p,original);
});
