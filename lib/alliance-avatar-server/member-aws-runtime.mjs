// Default-off member composition. No root/checkpoint initialization, environment
// activation flag, resource discovery, password lookup, write adapter or retry.
import {createHash} from 'node:crypto';
import {controlExact as exact,controlUuid as uuid} from './control-policy.mjs';
import {reviewMemberAuthorityBinding} from './member-authority-transport.mjs';
import {allianceTrustRecord} from './trust-record.mjs';
import {createMemberAuthorityService,MEMBER_AUTHORITY_BUDGETS} from './member-authority-service.mjs';
import {createLambdaInvocationRuntime} from './lambda-invocation-runtime.mjs';
import {createLambdaExecutionRoleProvider} from './aws-runtime-credentials.mjs';
import {createDynamoMemberAuthorityNonceStore} from './account-gateway-nonce.mjs';
import {createMemberKmsSigner} from './member-kms-signer.mjs';
import {createAllianceControlStore,createAllianceAnchorStore} from './control-store.mjs';
import {createJournalAuthorityReader} from './journal-store.mjs';
const fail=()=>Error('alliance_member_aws_unavailable');
const unavailable=()=>({statusCode:503,isBase64Encoded:false,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'},body:'{"state":"unavailable"}'});
function installation(value,bytes,expectedTrust){
 if(!exact(value,['format','binding','nonce','signing'])||value.format!==1||Buffer.byteLength(JSON.stringify(value))>15000||
  !exact(expectedTrust,['sha256','minimumGeneration']))throw fail();
 const m=structuredClone(value),b=reviewMemberAuthorityBinding(m.binding),r=b.resource,s=b.scope;
 const trust=allianceTrustRecord({bytes,expectedSha256:expectedTrust.sha256,minimumGeneration:expectedTrust.minimumGeneration,expectedScope:s});
 if(trust.controlVerificationKey!==b.controlVerificationKey||trust.journalVerificationKey!==b.journalVerificationKey)throw fail();
 if(!exact(m.nonce,['accountId','region','tableName','tableId','epoch'])||m.nonce.accountId!==r.accountId||m.nonce.region!==r.region||
  typeof m.nonce.tableName!=='string'||!/^alliance-member-nonce-[a-z0-9-]{1,40}$/.test(m.nonce.tableName)||!uuid(m.nonce.tableId)||m.nonce.epoch!==s.epoch||
  !exact(m.signing,['control','journal']))throw fail();
 for(const name of ['control','journal']){
  const k=m.signing[name];
  if(!exact(k,['accountId','region','keyArn'])||k.accountId!==r.accountId||k.region!==r.region||typeof k.keyArn!=='string'||
   !new RegExp('^arn:aws:kms:'+r.region+':'+r.accountId+':key/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$').test(k.keyArn))throw fail();
 }
 if(m.signing.control.keyArn===m.signing.journal.keyArn)throw fail();
 return {m,b,trust};
}
// The digest and generation are separate operator inputs, not learned from an
// event, database or the restored installation/record. Custody remains external.
export function reviewAwsMemberInstallation({installation:value,trustRecordBytes,expectedTrust}={}){
 try{
  const {m,trust}=installation(value,trustRecordBytes,expectedTrust);
  return {format:1,installationSha256:createHash('sha256').update(JSON.stringify(m)).digest('hex'),
   trustSha256:expectedTrust.sha256,minimumGeneration:expectedTrust.minimumGeneration,recordGeneration:trust.generation};
 }catch{throw fail();}
}
export async function createAwsMemberAuthorityRuntime({enabled=false,installation:input,trustRecordBytes,expectedTrust,connections,
 readEnvironment,openControlPool,openJournalPool,openKmsClient,openDynamoClient}={}){
 if(typeof enabled!=='boolean')throw fail();
 const owned=[];let adapter,service,closed=false,closing;
 const close=()=>{
  if(closing)return closing;closed=true;
  const pending=[];
  for(const item of [...owned].reverse())try{pending.push(Promise.resolve(item.close()).catch(()=>{}));}catch{}
  closing=Promise.all(pending).then(()=>undefined);return closing;
 };
 if(enabled)try{
  // Validate all public bindings/pins before inspecting connection secrets or
  // opening a pool/client. Inputs are not exposed in diagnostics or responses.
  const {m,b,trust}=installation(input,trustRecordBytes,expectedTrust),r=b.resource,s=b.scope;
  if(!exact(connections,['control','journal'])||[openControlPool,openJournalPool,openKmsClient,openDynamoClient].some(f=>f!==undefined&&typeof f!=='function'))throw fail();
  adapter=createLambdaInvocationRuntime({enabled:true,resource:r,minimumRemainingMs:MEMBER_AUTHORITY_BUDGETS.handler+500,readEnvironment});owned.push(adapter);
  const credentials=createLambdaExecutionRoleProvider({enabled:true,kind:'member-authority',resource:r,readRuntime:adapter.readRuntime});owned.push(credentials);
  const controlConnection={...connections.control},journalConnection={...connections.journal};
  const controlOptions={enabled:true,deploymentProfile:'supabase-managed',connectionProfile:'direct',...s,connection:controlConnection,openPool:openControlPool,timeoutMs:1500};
  const control=await createAllianceControlStore(controlOptions);owned.push(control);
  const anchor=await createAllianceAnchorStore({...controlOptions,writeEnabled:false});owned.push(anchor);
  const journal=await createJournalAuthorityReader({enabled:true,projectRef:s.memberProjectRef,journalProjectRef:s.journalProjectRef,
   epoch:s.epoch,connection:journalConnection,openPool:openJournalPool,timeoutMs:1500});owned.push(journal);
  const signerScope={memberProjectRef:s.memberProjectRef,journalProjectRef:s.journalProjectRef,epoch:s.epoch};
  const signers={};
  for(const purpose of ['control','journal']){
   const signer=createMemberKmsSigner({enabled:true,purpose,scope:signerScope,resource:m.signing[purpose],verificationKey:b[purpose+'VerificationKey'],
    credentials,credentialSource:r,openClient:openKmsClient,timeoutMs:MEMBER_AUTHORITY_BUDGETS.signer});owned.push(signer);signers[purpose]=signer.signBytes;
  }
  const claims=createDynamoMemberAuthorityNonceStore({enabled:true,resource:m.nonce,callerKeyId:b.callerKey.keyId,
   credentials,credentialProfile:'lambda-execution-role',credentialSource:r,openClient:openDynamoClient,timeoutMs:MEMBER_AUTHORITY_BUDGETS.nonce});owned.push(claims);
  service=createMemberAuthorityService({enabled:true,binding:b,minimum:{control:trust.controlMinimum,journal:trust.removalMinimum},stores:{control,anchor,journal},signers,claims});owned.push(service);
 }catch{await close();throw fail();}
 return Object.freeze({
  async handler(event,trustedContext){
   if(!enabled||closed)return unavailable();
   try{return await adapter.run(trustedContext,()=>service.handle(event,trustedContext));}catch{return unavailable();}
  },close
 });
}
