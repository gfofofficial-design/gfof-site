// Offline finite-policy proposal only. No SDK call, installation, clock read,
// secret value, signer, IAM simulation, request dispatch or activation.
import {createHash} from 'node:crypto';
import {isDeepStrictEqual as same} from 'node:util';
import {controlExact as exact} from './control-policy.mjs';
import {reviewAwsMemberInstallation} from './member-aws-runtime.mjs';
import {closedMemberKmsPolicy} from './member-kms-plan.mjs';
const fail=()=>Error('alliance_member_trial_policy_unavailable');
const version='2012-10-17',purposes=['control','journal'];
export const MEMBER_AWS_TRIAL_MAX_MS=600000;
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function time(v){
 if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/.test(v))throw fail();
 const ms=Date.parse(v);if(!Number.isFinite(ms)||new Date(ms).toISOString()!==v)throw fail();return ms;
}
function build(input){
 if(!exact(input,['installation','trustRecordBytes','expectedTrust','secrets','roleName','window','keyPolicies'])||
  !exact(input.window,['notBeforeUtc','notAfterUtc'])||!exact(input.secrets,purposes)||!exact(input.keyPolicies,purposes))throw fail();
 const review=reviewAwsMemberInstallation(input),m=structuredClone(input.installation),b=m.binding,r=b.resource;
 const start=time(input.window.notBeforeUtc),end=time(input.window.notAfterUtc);
 if(end<=start||end-start>MEMBER_AWS_TRIAL_MAX_MS||start<Date.parse(b.callerKey.notBeforeUtc)||end+37000>Date.parse(b.callerKey.notAfterUtc)||typeof input.roleName!=='string'||input.roleName.length>64||
  !/^federation-alliance-member-(closed|runtime)-[a-z0-9-]{1,30}$/.test(input.roleName))throw fail();
 const window={...input.window},secrets=structuredClone(input.secrets),closed=closedMemberKmsPolicy(r.accountId);
 for(const purpose of purposes){
  const s=secrets[purpose];
  if(!exact(s,['secretArn','versionId'])||typeof s.secretArn!=='string'||
   !new RegExp('^arn:aws:secretsmanager:'+r.region+':'+r.accountId+':secret:alliance-member-'+purpose+'-reader-[a-z0-9-]{1,40}-[A-Za-z0-9]{6}$').test(s.secretArn)||
   typeof s.versionId!=='string'||!/^[a-f0-9-]{32,64}$/.test(s.versionId)||!same(input.keyPolicies[purpose],closed))throw fail();
 }
 const arn=`arn:aws:lambda:${r.region}:${r.accountId}:function:${r.functionName}`,qualified=arn+':'+r.version;
 const roleArn=`arn:aws:iam::${r.accountId}:role/${input.roleName}`;
 const boundaryArn=`arn:aws:iam::${r.accountId}:policy/${input.roleName}-trial-boundary`;
 const table=`arn:aws:dynamodb:${r.region}:${r.accountId}:table/${m.nonce.tableName}`;
 const dates=()=>({DateGreaterThanEquals:{'aws:CurrentTime':window.notBeforeUtc},DateLessThan:{'aws:CurrentTime':window.notAfterUtc}});
 const regional=()=>({StringEquals:{'aws:RequestedRegion':r.region},Bool:{'aws:SecureTransport':'true'},...dates()});
 const source=()=>({...regional(),ArnEquals:{'lambda:SourceFunctionArn':arn}});
 const allow=(Sid,Action,Resource,Condition)=>({Sid,Effect:'Allow',Action,Resource,Condition});
 const nonce=source();nonce['ForAllValues:StringLike']={'dynamodb:LeadingKeys':[b.callerKey.keyId+'#*']};nonce.Null={'dynamodb:LeadingKeys':'false'};
 const actions=[
  allow('InspectOnlyMemberNonce',['dynamodb:DescribeTable','dynamodb:DescribeTimeToLive'],table,source()),
  allow('ClaimOnlyBoundCallerNonces',['dynamodb:GetItem','dynamodb:PutItem'],table,nonce),
  ...purposes.map(purpose=>{
   const c=source();c.StringEquals['secretsmanager:VersionId']=secrets[purpose].versionId;c.StringEquals['secretsmanager:VersionStage']='AWSCURRENT';
   return allow('Read'+(purpose==='control'?'Control':'Journal')+'PinnedVersion',['secretsmanager:GetSecretValue'],secrets[purpose].secretArn,c);
  }),
  allow('InspectOnlyPurposePublicKeys',['kms:GetPublicKey'],purposes.map(p=>m.signing[p].keyArn),source()),
 ];
 const signing=source();signing.StringEquals['kms:SigningAlgorithm']='ED25519_SHA_512';signing.StringEquals['kms:MessageType']='RAW';
 actions.push(allow('SignOnlyRawEd25519',['kms:Sign'],purposes.map(p=>m.signing[p].keyArn),signing));
 const runtimeActions=[...new Set(actions.flatMap(s=>s.Action))].sort();
 const deny=(Sid,Condition,Action='*')=>({Sid,Effect:'Deny',Action,Resource:'*',Condition});
 actions.push(
  deny('TrialNotStarted',{DateLessThan:{'aws:CurrentTime':window.notBeforeUtc}}),
  deny('TrialExpired',{DateGreaterThanEquals:{'aws:CurrentTime':window.notAfterUtc}}),
  deny('TrialTimeRequired',{Null:{'aws:CurrentTime':'true'}}),
  // Apply these direct-call guards only to the granted runtime actions. A
  // blanket source/network deny can also block Secrets Manager's forwarded
  // AWS-managed-key decryption, which has a different request context.
  deny('OnlyReviewedSourceFunction',{ArnNotEqualsIfExists:{'lambda:SourceFunctionArn':arn}},runtimeActions),
  deny('OnlyReviewedRegion',{StringNotEqualsIfExists:{'aws:RequestedRegion':r.region}},runtimeActions),
  deny('OnlySecureTransport',{BoolIfExists:{'aws:SecureTransport':'false'}},runtimeActions),
 );
 const identity={Version:version,Statement:actions},keyPolicies={};
 for(const purpose of purposes){
  const base=structuredClone(closed),other=base.Statement[1];
  other.Sid='NoOtherCryptographyImportOrRuntimeGrants';other.Action=other.Action.filter(a=>a!=='kms:Sign');
  const publicRead={...allow('FiniteMemberPublicKey',['kms:GetPublicKey'],'*',regional()),Principal:{AWS:roleArn}};
  const c=regional();c.StringEquals['kms:SigningAlgorithm']='ED25519_SHA_512';c.StringEquals['kms:MessageType']='RAW';
  const sign={...allow('FiniteMemberRawSignature',['kms:Sign'],'*',c),Principal:{AWS:roleArn}};
  // SourceFunctionArn is forbidden in resource policies. The exact role ARN
  // keeps permissions-boundary evaluation; identity/boundary bind the source.
  const otherSign={Sid:'NoOtherPrincipalMaySign',Effect:'Deny',Principal:'*',Action:['kms:Sign'],Resource:'*',Condition:{ArnNotEquals:{'aws:PrincipalArn':roleArn}}};
  const roleDeny=(Sid,condition)=>({Sid,Effect:'Deny',Principal:{AWS:roleArn},Action:['kms:Sign'],Resource:'*',Condition:condition});
  base.Statement.push(publicRead,sign,otherSign,
   roleDeny('MemberSignNotStarted',{DateLessThan:{'aws:CurrentTime':window.notBeforeUtc}}),
   roleDeny('MemberSignExpired',{DateGreaterThanEquals:{'aws:CurrentTime':window.notAfterUtc}}),
   roleDeny('MemberSignTimeRequired',{Null:{'aws:CurrentTime':'true'}}));
  keyPolicies[purpose]=base;
 }
 const sourceArn=`arn:aws:execute-api:${r.region}:${r.accountId}:${b.gateway.apiId}/${b.gateway.stage}/POST/member-authority`;
 const addPermission={FunctionName:arn,Qualifier:r.version,StatementId:'AllianceExactMemberGateway',Action:'lambda:InvokeFunction',Principal:'apigateway.amazonaws.com',SourceArn:sourceArn,SourceAccount:r.accountId};
 const resourcePolicy={Version:version,Statement:[{Sid:addPermission.StatementId,Effect:'Allow',Principal:{Service:addPermission.Principal},Action:addPermission.Action,Resource:qualified,Condition:{ArnLike:{'AWS:SourceArn':sourceArn},StringEquals:{'AWS:SourceAccount':r.accountId}}}]};
 if(Buffer.byteLength(JSON.stringify(identity))>6144||Object.values(keyPolicies).some(v=>Buffer.byteLength(JSON.stringify(v))>32768))throw fail();
 return {format:1,purpose:'finite-member-policy-review-only',window,installationSha256:review.installationSha256,
  trust:{sha256:review.trustSha256,minimumGeneration:review.minimumGeneration},binding:b,nonce:m.nonce,signing:m.signing,secrets,roleArn,boundaryArn,
  executionTrust:{Version:version,Statement:[{Sid:'LambdaServiceOnly',Effect:'Allow',Principal:{Service:'lambda.amazonaws.com'},Action:'sts:AssumeRole'}]},
  identity,permissionsBoundary:structuredClone(identity),keyPolicies,canonicalOriginalKeyPolicySha256:sha(closed),originalKeyPolicies:structuredClone(input.keyPolicies),
  addPermission,resourcePolicy,expectedAbsent:{secretResourcePolicies:true,nonceResourcePolicy:true,kmsGrants:true,functionUrls:true,aliases:true},
  limitations:{outboundSourcePinsVersion:false,iamLimitsRequestCount:false,iamLimitsSignedMessageContents:false,timeFenceDisablesInvocation:false,installedOrSimulated:false}};
}
export function memberAwsTrialPolicyBundle(input){try{return build(input);}catch{throw fail();}}
export function reviewMemberAwsTrialPolicyBundle({input,prepared}={}){
 try{const expected=build(input);if(Buffer.byteLength(JSON.stringify(prepared))>50000||!same(prepared,expected))throw fail();return {matches:true,sha256:sha(expected)};}catch{throw fail();}
}
