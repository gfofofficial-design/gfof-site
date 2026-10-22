// Offline review aid only. No SDK, I/O, execution, key import or activation.
import {createHash,createPublicKey} from 'node:crypto';
import {isDeepStrictEqual as same} from 'node:util';
import {controlExact as exact,controlHash as hash} from './control-policy.mjs';
const fail=()=>Error('alliance_member_kms_plan_unavailable');
const MANAGEMENT=['kms:DescribeKey','kms:GetKeyPolicy','kms:PutKeyPolicy','kms:ListKeyPolicies','kms:ListResourceTags','kms:TagResource','kms:UntagResource','kms:CreateAlias','kms:UpdateAlias','kms:DeleteAlias'];
const FORBIDDEN=['kms:Sign','kms:Verify','kms:Encrypt','kms:Decrypt','kms:ReEncrypt*','kms:GenerateDataKey*','kms:GenerateMac','kms:VerifyMac','kms:DeriveSharedSecret','kms:CreateGrant','kms:ImportKeyMaterial','kms:GetParametersForImport','kms:EnableKey'];
function key(v){
 if(!exact(v,['keyId','spki','verificationKey'])||!hash(v.keyId)||!hash(v.verificationKey)||v.verificationKey==='0'.repeat(64)||typeof v.spki!=='string'||v.spki.length!==60)throw fail();
 const bytes=Buffer.from(v.spki,'base64');if(bytes.toString('base64')!==v.spki||bytes.length!==44||createHash('sha256').update(bytes).digest('hex')!==v.keyId)throw fail();
 const pub=createPublicKey({key:bytes,format:'der',type:'spki'});
 if(pub.asymmetricKeyType!=='ed25519'||!pub.export({format:'der',type:'spki'}).equals(bytes)||Buffer.from(pub.export({format:'jwk'}).x,'base64url').toString('hex')!==v.verificationKey)throw fail();return {...v};
}
export function preparePendingMemberKmsKeys(input){
 try{
  if(!exact(input,['accountId','region','suffix','callerKeyId','control','journal'])||typeof input.accountId!=='string'||!/^\d{12}$/.test(input.accountId)||input.region!=='us-east-2'||typeof input.suffix!=='string'||!/^preview-[0-9]{8}$/.test(input.suffix)||!hash(input.callerKeyId))throw fail();
  const control=key(input.control),journal=key(input.journal);
  if(new Set([input.callerKeyId,control.keyId,journal.keyId]).size!==3)throw fail();
  const policy={Version:'2012-10-17',Statement:[
   {Sid:'ExistingAccountManagementOnly',Effect:'Allow',Principal:{AWS:`arn:aws:iam::${input.accountId}:root`},Action:[...MANAGEMENT],Resource:'*'},
   {Sid:'PendingNoCryptographyImportOrRuntimeGrants',Effect:'Deny',Principal:'*',Action:[...FORBIDDEN],Resource:'*'}
  ]};
  return {format:1,purpose:'pending-import-only',accountId:input.accountId,region:input.region,keys:['control','journal'].map(purpose=>{
   const publicKey=purpose==='control'?control:journal,aliasName=`alias/federation-alliance-${purpose}-${input.suffix}`;
   return {purpose,publicKey,aliasName,createKey:{Description:`Federation Alliance ${purpose} signer ${input.suffix} - pending import`,KeySpec:'ECC_NIST_EDWARDS25519',KeyUsage:'SIGN_VERIFY',Origin:'EXTERNAL',MultiRegion:false,BypassPolicyLockoutSafetyCheck:false,Policy:JSON.stringify(policy),Tags:[{TagKey:'FederationPurpose',TagValue:`alliance-${purpose}-${input.suffix}`},{TagKey:'ExpectedPublicKeyId',TagValue:publicKey.keyId},{TagKey:'Activation',TagValue:'pending-review'}]}};
  })};
 }catch{throw fail();}
}
// Caller supplies fresh metadata; this is not an AWS identity/IAM attestation.
export function reviewPendingMemberKmsKey({input,prepared,purpose,metadata,policy,aliases,tags}={}){
 try{
  const expected=preparePendingMemberKmsKeys(input);if(!same(prepared,expected))throw fail();
  const item=expected.keys.find(x=>x.purpose===purpose);if(!item||!metadata||typeof metadata.KeyId!=='string'||!(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/).test(metadata.KeyId))throw fail();
  const arn=`arn:aws:kms:${expected.region}:${expected.accountId}:key/${metadata.KeyId}`;
  if(metadata.Arn!==arn||metadata.AWSAccountId!==expected.accountId||metadata.Description!==item.createKey.Description||metadata.KeySpec!==item.createKey.KeySpec||metadata.KeyUsage!=='SIGN_VERIFY'||metadata.Origin!=='EXTERNAL'||metadata.KeyState!=='PendingImport'||metadata.Enabled!==false||metadata.MultiRegion!==false||metadata.KeyManager!=='CUSTOMER'||!same(policy,JSON.parse(item.createKey.Policy)))throw fail();
  if(!Array.isArray(aliases)||aliases.length!==1||!same(aliases[0],{AliasName:item.aliasName,TargetKeyId:metadata.KeyId}))throw fail();
  const ordered=v=>[...v].sort((a,b)=>a.TagKey.localeCompare(b.TagKey));
  if(!Array.isArray(tags)||!same(ordered(tags),ordered(item.createKey.Tags)))throw fail();
  return {purpose,arn,aliasName:item.aliasName,state:'PendingImport',expectedPublicKeyId:item.publicKey.keyId,materialImported:false,cryptographicUsePermitted:false};
 }catch{throw fail();}
}
