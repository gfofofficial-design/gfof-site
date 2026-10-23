// Synthetic AWS responses only; the native caller supplies real disposable PG/TLS
// transports. No cloud resource, credential lookup or real signing key is used.
import {createHash} from 'node:crypto';
import {allianceTrustRecordBytes} from './trust-record.mjs';
import {createAwsMemberAuthorityRuntime} from './member-aws-runtime.mjs';
export async function nativeMemberAwsRuntime({binding,policy,control,journal,password,controlKey,witnessKey}){
 const zero={sequence:0,sha256:'0'.repeat(64)},s=binding.scope,r=binding.resource,nonces=new Map(),metadata=()=>({httpStatusCode:200,attempts:1,totalRetryDelay:0});
 const signing={control:{accountId:r.accountId,region:r.region,keyArn:`arn:aws:kms:${r.region}:${r.accountId}:key/55555555-5555-4555-8555-555555555555`},journal:{accountId:r.accountId,region:r.region,keyArn:`arn:aws:kms:${r.region}:${r.accountId}:key/66666666-6666-4666-8666-666666666666`}};
 const installation={format:1,binding,nonce:{accountId:r.accountId,region:r.region,tableName:'alliance-member-nonce-native-synthetic',tableId:'77777777-7777-4777-8777-777777777777',epoch:s.epoch},signing};
 const bytes=allianceTrustRecordBytes({format:1,...s,generation:1,previousSha256:zero.sha256,controlMinimum:{revision:policy.revision,sha256:policy.sha256,floor:zero},removalMinimum:zero,controlVerificationKey:binding.controlVerificationKey,journalVerificationKey:binding.journalVerificationKey});
 const env={AWS_REGION:r.region,AWS_EXECUTION_ENV:'AWS_Lambda_nodejs24.x',AWS_LAMBDA_FUNCTION_NAME:r.functionName,AWS_LAMBDA_FUNCTION_VERSION:r.version,AWS_LAMBDA_INITIALIZATION_TYPE:'on-demand',AWS_ACCESS_KEY_ID:'ASIA'+'S'.repeat(16),AWS_SECRET_ACCESS_KEY:'S'.repeat(40),AWS_SESSION_TOKEN:'synthetic-native-member-runtime-only'};
 const runtime=await createAwsMemberAuthorityRuntime({enabled:true,installation,trustRecordBytes:bytes,expectedTrust:{sha256:createHash('sha256').update(bytes).digest('hex'),minimumGeneration:1},
  connections:{control:{...control.connection,password},journal:{...journal.connection,password}},openControlPool:control.openPool,openJournalPool:journal.openPool,readEnvironment:()=>env,
  openDynamoClient:()=>({destroy(){},async send(command){
   const name=command.constructor.name,q=command.input,n=installation.nonce;
   if(name==='DescribeTableCommand')return {$metadata:metadata(),Table:{TableArn:`arn:aws:dynamodb:${r.region}:${r.accountId}:table/${n.tableName}`,TableId:n.tableId,TableName:n.tableName,TableStatus:'ACTIVE',DeletionProtectionEnabled:true,BillingModeSummary:{BillingMode:'PAY_PER_REQUEST'},KeySchema:[{AttributeName:'nonceKey',KeyType:'HASH'}],AttributeDefinitions:[{AttributeName:'nonceKey',AttributeType:'S'}]}};
   if(name==='DescribeTimeToLiveCommand')return {$metadata:metadata(),TimeToLiveDescription:{TimeToLiveStatus:'ENABLED',AttributeName:'expiresAt'}};
   if(name==='PutItemCommand'){if(nonces.has(q.Item.nonceKey.S))throw Object.assign(Error('synthetic consumed nonce'),{name:'ConditionalCheckFailedException',$metadata:{...metadata(),httpStatusCode:400}});nonces.set(q.Item.nonceKey.S,q.Item);return {$metadata:metadata()};}
   if(name==='GetItemCommand')return {$metadata:metadata(),Item:nonces.get(q.Key.nonceKey.S)};
   throw Error('unexpected synthetic nonce command');
  }}),openKmsClient:()=>({destroy(){},async send(command){
   const q=command.input,key=q.KeyId===signing.control.keyArn?controlKey:q.KeyId===signing.journal.keyArn?witnessKey:null;if(!key)throw Error('unexpected synthetic signer');
   if(command.constructor.name==='GetPublicKeyCommand')return {$metadata:metadata(),KeyId:q.KeyId,KeyUsage:'SIGN_VERIFY',KeySpec:'ECC_NIST_EDWARDS25519',PublicKey:key.pair.publicKey.export({format:'der',type:'spki'}),SigningAlgorithms:['ED25519_SHA_512','ED25519_PH_SHA_512']};
   if(command.constructor.name!=='SignCommand'||q.MessageType!=='RAW')throw Error('unexpected synthetic signing command');
   return {$metadata:metadata(),KeyId:q.KeyId,SigningAlgorithm:'ED25519_SHA_512',Signature:key.signBytes(q.Message)};
  }})});
 return {handler:runtime.handler,close:runtime.close,nonceCount:()=>nonces.size};
}
