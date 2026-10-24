// Public offline policy fixture only; no private key, password or live access.
import {createHash,createPublicKey} from 'node:crypto';
import {closedMemberKmsPolicy} from './member-kms-plan.mjs';
import {allianceTrustRecordBytes} from './trust-record.mjs';
const zero={sequence:0,sha256:'0'.repeat(64)},accountId='123456789012',region='us-east-2';
// Explicit public synthetic key bytes only; no private key or credential generated.
export function syntheticMemberTrialPolicy(){
 const scope={memberProjectRef:'abcdefghijklmnopqrst',journalProjectRef:'uvwxyzabcdefghijklmn',controlProjectRef:'opqrstuvwxyzabcdefgh',epoch:'11111111-1111-4111-8111-111111111111'};
 const callerPub=createPublicKey({format:'jwk',key:{kty:'OKP',crv:'Ed25519',x:Buffer.alloc(32,3).toString('base64url')}}).export({format:'der',type:'spki'});
 const binding={gateway:{apiId:'abcdefghij',region,stage:'preview'},resource:{accountId,region,functionName:'alliance-member-authority-synthetic',version:'2'},scope,
  callerKey:{keyId:createHash('sha256').update(callerPub).digest('hex'),spki:callerPub.toString('base64'),notBeforeUtc:'2026-10-24T00:00:00.000Z',notAfterUtc:'2026-10-25T00:00:00.000Z'},controlVerificationKey:'1'.repeat(64),journalVerificationKey:'2'.repeat(64)};
 const installation={format:1,binding,nonce:{accountId,region,tableName:'alliance-member-nonce-synthetic',tableId:'44444444-4444-4444-8444-444444444444',epoch:scope.epoch},signing:Object.fromEntries(['control','journal'].map((p,i)=>[p,{accountId,region,keyArn:`arn:aws:kms:${region}:${accountId}:key/${String(i+1).repeat(8)}-1111-4111-8111-111111111111`}]))};
 const bytes=allianceTrustRecordBytes({format:1,...scope,generation:1,previousSha256:zero.sha256,controlMinimum:{revision:3,sha256:'c'.repeat(64),floor:zero},removalMinimum:zero,controlVerificationKey:binding.controlVerificationKey,journalVerificationKey:binding.journalVerificationKey});
 return {installation,trustRecordBytes:bytes,expectedTrust:{sha256:createHash('sha256').update(bytes).digest('hex'),minimumGeneration:1},
  secrets:Object.fromEntries(['control','journal'].map((p,i)=>[p,{secretArn:`arn:aws:secretsmanager:${region}:${accountId}:secret:alliance-member-${p}-reader-synthetic-Ab12Cd`,versionId:String(i+1).repeat(32)}])),
  roleName:'federation-alliance-member-closed-synthetic',window:{notBeforeUtc:'2026-10-24T12:00:00.000Z',notAfterUtc:'2026-10-24T12:10:00.000Z'},keyPolicies:{control:closedMemberKmsPolicy(accountId),journal:closedMemberKmsPolicy(accountId)}};
}
