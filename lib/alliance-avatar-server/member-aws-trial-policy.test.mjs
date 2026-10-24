import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {memberAwsTrialPolicyBundle as build,reviewMemberAwsTrialPolicyBundle as review,MEMBER_AWS_TRIAL_MAX_MS} from './member-aws-trial-policy.mjs';
import {closedMemberKmsPolicy} from './member-kms-plan.mjs';
import {syntheticMemberTrialPolicy} from './member-aws-trial-policy.fixture.mjs';
const error=/^Error: alliance_member_trial_policy_unavailable$/;
const accountId='123456789012',region='us-east-2';
const permits=b=>b.identity.Statement.filter(s=>s.Effect==='Allow');
test('finite member proposal is deterministic and keeps original rollback policies and independent trust pin',()=>{
 const i=syntheticMemberTrialPolicy(),before=JSON.stringify(i),b=build(i);assert.equal(MEMBER_AWS_TRIAL_MAX_MS,600000);assert.deepEqual(build(i),b);assert.equal(JSON.stringify(i),before);
 assert.deepEqual(review({input:i,prepared:b}),review({input:i,prepared:structuredClone(b)}));assert.equal(b.trust.sha256,i.expectedTrust.sha256);
 assert.deepEqual(b.originalKeyPolicies,i.keyPolicies);assert.equal(b.canonicalOriginalKeyPolicySha256,createHash('sha256').update(JSON.stringify(closedMemberKmsPolicy(accountId))).digest('hex'));
 assert.equal(Buffer.byteLength(JSON.stringify(b.identity))<=6144,true);
});
test('secret grants pin BOTH version ID and current stage separately for each exact purpose ARN',()=>{
 const i=syntheticMemberTrialPolicy(),b=build(i),s=permits(b).filter(s=>s.Action.includes('secretsmanager:GetSecretValue'));assert.equal(s.length,2);
 for(const [n,p] of ['control','journal'].entries()){assert.equal(s[n].Resource,i.secrets[p].secretArn);assert.equal(s[n].Condition.StringEquals['secretsmanager:VersionId'],i.secrets[p].versionId);assert.equal(s[n].Condition.StringEquals['secretsmanager:VersionStage'],'AWSCURRENT');}
 assert.equal(JSON.stringify(permits(b)).includes('kms:Decrypt'),false);
});
test('nonce permissions are only metadata/get/conditional-put on the member table and caller prefix',()=>{
 const i=syntheticMemberTrialPolicy(),b=build(i),s=permits(b).filter(s=>s.Action.some(a=>a.startsWith('dynamodb:')));assert.equal(s.length,2);
 assert.deepEqual(s[0].Action,['dynamodb:DescribeTable','dynamodb:DescribeTimeToLive']);assert.deepEqual(s[1].Action,['dynamodb:GetItem','dynamodb:PutItem']);
 for(const v of s)assert.equal(v.Resource,`arn:aws:dynamodb:${region}:${accountId}:table/alliance-member-nonce-synthetic`);
 assert.deepEqual(s[1].Condition['ForAllValues:StringLike']['dynamodb:LeadingKeys'],[i.installation.binding.callerKey.keyId+'#*']);assert.equal(s[1].Condition.Null['dynamodb:LeadingKeys'],'false');
});
test('all outbound allows use unqualified function provenance, TLS/region and inclusive-start/exclusive-end dates',()=>{
 const i=syntheticMemberTrialPolicy(),b=build(i);
 assert.deepEqual(b.identity,b.permissionsBoundary);
 for(const s of permits(b)){
  assert.equal(s.Condition.ArnEquals['lambda:SourceFunctionArn'],`arn:aws:lambda:${region}:${accountId}:function:alliance-member-authority-synthetic`);
  assert.equal(s.Condition.Bool['aws:SecureTransport'],'true');assert.equal(s.Condition.StringEquals['aws:RequestedRegion'],region);
  assert.deepEqual(s.Condition.DateGreaterThanEquals,{'aws:CurrentTime':i.window.notBeforeUtc});assert.deepEqual(s.Condition.DateLessThan,{'aws:CurrentTime':i.window.notAfterUtc});
 }
 const denies=b.identity.Statement.filter(s=>s.Effect==='Deny');assert.equal(denies.length,6);
 assert.ok(denies.some(s=>s.Condition.Null?.['aws:CurrentTime']==='true'));
 assert.ok(denies.some(s=>s.Condition.ArnNotEqualsIfExists?.['lambda:SourceFunctionArn']));
 assert.ok(denies.some(s=>s.Condition.StringNotEqualsIfExists?.['aws:RequestedRegion']===region));
 assert.ok(denies.some(s=>s.Condition.BoolIfExists?.['aws:SecureTransport']==='false'));
});
test('signing allows only the two exact keys, RAW message type and supported Ed25519 algorithm',()=>{
 const i=syntheticMemberTrialPolicy(),b=build(i),s=permits(b).find(s=>s.Action.includes('kms:Sign'));
 assert.deepEqual(s.Resource,['control','journal'].map(p=>i.installation.signing[p].keyArn));assert.equal(s.Condition.StringEquals['kms:MessageType'],'RAW');assert.equal(s.Condition.StringEquals['kms:SigningAlgorithm'],'ED25519_SHA_512');
 for(const denied of ['iam:','sts:','logs:','CreateTable','DeleteItem','UpdateItem','Scan','Query','BatchGetSecretValue','PutSecretValue','CreateGrant'])assert.equal(JSON.stringify(permits(b)).includes(denied),false,denied);
});
test('source/network guards cover all granted direct calls without a blanket forwarded-service decrypt denial',()=>{
 const b=build(syntheticMemberTrialPolicy()),allowed=[...new Set(permits(b).flatMap(s=>s.Action))].sort();
 for(const sid of ['OnlyReviewedSourceFunction','OnlyReviewedRegion','OnlySecureTransport']){
  const s=b.identity.Statement.find(s=>s.Sid===sid);assert.deepEqual(s.Action,allowed);assert.equal(s.Action.includes('kms:Decrypt'),false);
 }
 for(const sid of ['TrialNotStarted','TrialExpired','TrialTimeRequired'])assert.equal(b.identity.Statement.find(s=>s.Sid===sid).Action,'*');
});
test('key policies preserve existing management exactly, deny other cryptography and target role principals rather than sessions',()=>{
 const i=syntheticMemberTrialPolicy(),b=build(i);
 for(const p of ['control','journal']){
  const k=b.keyPolicies[p];assert.deepEqual(k.Statement[0],i.keyPolicies[p].Statement[0]);
  assert.deepEqual(k.Statement[1].Action,i.keyPolicies[p].Statement[1].Action.filter(a=>a!=='kms:Sign'));
  assert.equal(k.Statement[1].Effect,'Deny');assert.equal(k.Statement[1].Principal,'*');
  const grants=k.Statement.filter(s=>s.Sid.startsWith('FiniteMember'));assert.equal(grants.length,2);
  for(const s of grants){assert.deepEqual(s.Principal,{AWS:b.roleArn});assert.equal(s.Resource,'*');assert.equal(s.Condition.DateLessThan['aws:CurrentTime'],i.window.notAfterUtc);}
  const sign=grants.find(s=>s.Action.includes('kms:Sign'));assert.equal(sign.Condition.StringEquals['kms:MessageType'],'RAW');assert.equal(sign.Condition.StringEquals['kms:SigningAlgorithm'],'ED25519_SHA_512');
  assert.equal(JSON.stringify(k).includes('lambda:SourceFunctionArn'),false);assert.equal(JSON.stringify(k).includes(':assumed-role/'),false);
  assert.equal(k.Statement.find(s=>s.Sid==='NoOtherPrincipalMaySign').Condition.ArnNotEquals['aws:PrincipalArn'],b.roleArn);
  assert.ok(k.Statement.some(s=>s.Sid==='MemberSignExpired'&&s.Effect==='Deny'));assert.ok(k.Statement.some(s=>s.Sid==='MemberSignTimeRequired'&&s.Effect==='Deny'));
 }
});
test('API proposal allows only one numeric member version and exact account/API/stage/POST/member-authority route',()=>{
 const i=syntheticMemberTrialPolicy(),b=build(i),p=b.addPermission,s=b.resourcePolicy.Statement[0];
 assert.equal(p.Qualifier,'2');assert.equal(p.SourceArn,`arn:aws:execute-api:${region}:${accountId}:abcdefghij/preview/POST/member-authority`);assert.equal(p.SourceAccount,accountId);
 assert.deepEqual(s.Principal,{Service:'apigateway.amazonaws.com'});assert.equal(s.Resource,p.FunctionName+':2');assert.equal(s.Condition.ArnLike['AWS:SourceArn'],p.SourceArn);
 assert.deepEqual(b.executionTrust.Statement[0].Principal,{Service:'lambda.amazonaws.com'});assert.equal(p.FunctionUrlAuthType,undefined);
 assert.deepEqual(b.limitations,{outboundSourcePinsVersion:false,iamLimitsRequestCount:false,iamLimitsSignedMessageContents:false,timeFenceDisablesInvocation:false,installedOrSimulated:false});
});
for(const [name,change] of Object.entries({
 'zero time window':i=>i.window.notAfterUtc=i.window.notBeforeUtc,
 'overlong time window':i=>i.window.notAfterUtc='2026-10-24T12:10:01.000Z',
 'noncanonical time':i=>i.window.notBeforeUtc='2026-10-24T12:00:00Z',
 'invalid calendar date':i=>i.window.notBeforeUtc='2026-02-30T12:00:00.000Z',
 'missing time':i=>delete i.window.notAfterUtc,
 'window before caller validity':i=>i.installation.binding.callerKey.notBeforeUtc='2026-10-24T12:01:00.000Z',
 'insufficient caller expiry margin':i=>i.installation.binding.callerKey.notAfterUtc='2026-10-24T12:10:30.000Z',
 'wrong external trust digest':i=>i.expectedTrust.sha256='f'.repeat(64),
 'stale trust generation':i=>i.expectedTrust.minimumGeneration=2,
 'old account nonce namespace':i=>i.installation.nonce.tableName='alliance-account-nonce-synthetic',
 'crossed secret purposes':i=>i.secrets.control={...i.secrets.journal},
 'foreign secret account':i=>i.secrets.control.secretArn=i.secrets.control.secretArn.replace(accountId,'999999999999'),
 'secret alias':i=>i.secrets.control.secretArn='alias/control',
 'private payload field is not accepted':i=>i.secrets.control.password=7,
 'missing immutable secret version':i=>delete i.secrets.journal.versionId,
 'unversioned Lambda':i=>i.installation.binding.resource.version='$LATEST',
 'broad ingress stage':i=>i.installation.binding.gateway.stage='*',
 'wrong role family':i=>i.roleName='administrator',
 'changed original management':i=>i.keyPolicies.control.Statement[0].Action.push('kms:Sign'),
 'changed original denial':i=>i.keyPolicies.journal.Statement[1].Action.pop(),
 'hidden top-level field':i=>i.enabled=true,
})){test(name+' refuses before producing a policy',()=>{const i=syntheticMemberTrialPolicy();change(i);assert.throws(()=>build(i),error);});}
test('reviewer rejects broadened resources/actions, expired-boundary changes, unsupported source conditions and extra grants',()=>{
 const i=syntheticMemberTrialPolicy();
 for(const change of [b=>b.identity.Statement[2].Resource='*',b=>delete b.identity.Statement[2].Condition.StringEquals['secretsmanager:VersionId'],b=>b.identity.Statement[3].Condition.StringEquals['secretsmanager:VersionStage']='AWSPREVIOUS',b=>b.permissionsBoundary.Statement.pop(),b=>delete b.identity.Statement[1].Condition.Null,b=>b.identity.Statement[1].Condition['ForAllValues:StringLike']['dynamodb:LeadingKeys']=['*'],b=>b.keyPolicies.control.Statement[0].Action.push('kms:Sign'),b=>b.keyPolicies.journal.Statement[3].Principal={AWS:'*'},b=>b.keyPolicies.control.Statement[3].Condition.StringEquals['kms:MessageType']='DIGEST',b=>b.keyPolicies.control.Statement.push({Effect:'Allow',Principal:'*',Action:'kms:Sign',Resource:'*'}),b=>b.resourcePolicy.Statement[0].Condition.ArnLike['AWS:SourceArn']='*',b=>b.limitations.installedOrSimulated=true]){
  const b=build(i);change(b);assert.throws(()=>review({input:i,prepared:b}),error);
 }
});
test('policy review cannot carry old secret versions, numeric versions or expiry into a changed plan',()=>{
 for(const change of [i=>i.secrets.control.versionId='3'.repeat(32),i=>i.installation.binding.resource.version='3',i=>i.window.notAfterUtc='2026-10-24T12:09:00.000Z']){
  const i=syntheticMemberTrialPolicy(),b=build(i);change(i);assert.throws(()=>review({input:i,prepared:b}),error);
 }
});
test('committed public synthetic artifact is exactly reproducible and makes no installed-policy claim',()=>{
 const i=syntheticMemberTrialPolicy(),artifact=JSON.parse(readFileSync(new URL('../../docs/examples/alliance-member-aws-trial.synthetic.json',import.meta.url),'utf8'));
 assert.deepEqual(artifact,build(i));assert.equal(review({input:i,prepared:artifact}).matches,true);
 assert.equal(artifact.binding.resource.accountId,'123456789012');assert.equal(artifact.limitations.installedOrSimulated,false);
});
