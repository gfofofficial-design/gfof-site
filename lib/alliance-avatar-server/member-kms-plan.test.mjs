import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createHash} from 'node:crypto';
import {preparePendingMemberKmsKeys,reviewPendingMemberKmsKey} from './member-kms-plan.mjs';
const key=()=>{const p=generateKeyPairSync('ed25519').publicKey,spki=p.export({format:'der',type:'spki'});return {keyId:createHash('sha256').update(spki).digest('hex'),spki:spki.toString('base64'),verificationKey:Buffer.from(p.export({format:'jwk'}).x,'base64url').toString('hex')};};
const input=()=>({accountId:'123456789012',region:'us-east-2',suffix:'preview-20261022',callerKeyId:'a'.repeat(64),control:key(),journal:key()});
function readback(i,p,purpose='control'){
 const item=p.keys.find(k=>k.purpose===purpose),id='11111111-1111-4111-8111-111111111111';
 return {input:i,prepared:p,purpose,metadata:{KeyId:id,Arn:`arn:aws:kms:${i.region}:${i.accountId}:key/${id}`,AWSAccountId:i.accountId,Description:item.createKey.Description,KeySpec:'ECC_NIST_EDWARDS25519',KeyUsage:'SIGN_VERIFY',Origin:'EXTERNAL',KeyState:'PendingImport',Enabled:false,MultiRegion:false,KeyManager:'CUSTOMER'},policy:JSON.parse(item.createKey.Policy),aliases:[{AliasName:item.aliasName,TargetKeyId:id}],tags:item.createKey.Tags};
}
test('pending-only plans pin both distinct public purposes with no generated private material or execution',()=>{
 const i=input(),p=preparePendingMemberKmsKeys(i);assert.equal(p.keys.length,2);assert.deepEqual(p.keys.map(k=>k.purpose),['control','journal']);
 for(const k of p.keys){assert.equal(k.createKey.Origin,'EXTERNAL');assert.equal(k.createKey.MultiRegion,false);assert.equal(k.createKey.BypassPolicyLockoutSafetyCheck,false);assert.equal(k.createKey.KeyUsage,'SIGN_VERIFY');assert.equal(k.createKey.KeySpec,'ECC_NIST_EDWARDS25519');assert.equal(Object.hasOwn(k,'privateKey'),false);}
 assert.equal(preparePendingMemberKmsKeys(i).keys[0].aliasName,'alias/federation-alliance-control-preview-20261022');
});
test('pending policies keep existing account management and explicitly deny signing/import/grants',()=>{
 const i=input(),p=preparePendingMemberKmsKeys(i),policy=JSON.parse(p.keys[0].createKey.Policy);
 assert.deepEqual(policy.Statement[0].Principal,{AWS:'arn:aws:iam::123456789012:root'});assert.equal(policy.Statement[0].Action.includes('kms:PutKeyPolicy'),true);assert.equal(policy.Statement[0].Action.some(x=>x==='kms:*'),false);
 const deny=policy.Statement[1];assert.equal(deny.Effect,'Deny');assert.equal(deny.Principal,'*');for(const action of ['kms:Sign','kms:ImportKeyMaterial','kms:GetParametersForImport','kms:CreateGrant','kms:EnableKey'])assert.ok(deny.Action.includes(action));
});
test('different scope, same caller/authority key, noncanonical or mismatched public identity refuse',()=>{
 const i=input();for(const change of [{region:'us-west-2'},{accountId:123456789012},{suffix:'production'},{journal:i.control},{callerKeyId:i.control.keyId},{control:{...i.control,verificationKey:'b'.repeat(64)}},{control:{...i.control,keyId:'b'.repeat(64)}},{journal:{...i.journal,privateKey:'PRIVATE'}}])assert.throws(()=>preparePendingMemberKmsKeys({...i,...change}));
});
test('fresh pending-only metadata, exact alias/policy/tags can be reviewed without cloud access',()=>{
 const i=input(),p=preparePendingMemberKmsKeys(i);for(const purpose of ['control','journal']){const r=reviewPendingMemberKmsKey(readback(i,p,purpose));assert.equal(r.state,'PendingImport');assert.equal(r.materialImported,false);assert.equal(r.cryptographicUsePermitted,false);}
});
test('enabled, generated-material, foreign-account, mutable alias and broadened policy readbacks refuse',()=>{
 const i=input(),p=preparePendingMemberKmsKeys(i),original=readback(i,p);
 for(const patch of [{KeyState:'Enabled'},{Enabled:true},{Origin:'AWS_KMS'},{MultiRegion:true},{KeySpec:'ECC_NIST_P256'},{AWSAccountId:'999999999999'},{Arn:original.metadata.Arn.replace('us-east-2','us-west-2')}])assert.throws(()=>reviewPendingMemberKmsKey({...original,metadata:{...original.metadata,...patch}}));
 const policy=structuredClone(original.policy);policy.Statement[0].Action.push('kms:Sign');assert.throws(()=>reviewPendingMemberKmsKey({...original,policy}));
 assert.throws(()=>reviewPendingMemberKmsKey({...original,aliases:[{...original.aliases[0],TargetKeyId:'other'}]}));
 assert.throws(()=>reviewPendingMemberKmsKey({...original,tags:original.tags.slice(1)}));
 const prepared=structuredClone(p);prepared.keys[0].createKey.BypassPolicyLockoutSafetyCheck=true;assert.throws(()=>reviewPendingMemberKmsKey({...original,prepared}));
});
