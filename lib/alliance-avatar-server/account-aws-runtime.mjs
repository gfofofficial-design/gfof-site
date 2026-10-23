// Disabled/unmounted AWS handler compositions. No exported live handler, cloud
// install, root initialization, request-derived identity or credential output.
import {createHash} from 'node:crypto';
import {controlExact as exact} from './control-policy.mjs';
import {gatewayAwsPolicyBundle} from './gateway-aws-policy.mjs';
import {reviewGatewayCallerKey} from './gateway-signing-key.mjs';
import {authorityPolicy,authorityReceipt} from './account-authority-wire.mjs';
import {createLambdaInvocationRuntime} from './lambda-invocation-runtime.mjs';
import {createLambdaExecutionRoleProvider} from './aws-runtime-credentials.mjs';
import {createDynamoGatewayNonceStore} from './account-gateway-nonce.mjs';
import {createLambdaAccountCheckpointAuthority,createAccountAuthorityLambdaHandler} from './account-lambda-authority.mjs';
import {createAccountGatewayHandler} from './account-gateway.mjs';
import {createDynamoAccountCheckpointStore} from './account-dynamodb-store.mjs';
import {createAccountCheckpointAuthority} from './account-checkpoint-authority.mjs';
const fail=()=>Error('alliance_account_aws_unavailable');
export const AWS_ACCOUNT_BUDGETS=Object.freeze({gateway:5500,nonce:1000,invoke:4000,handler:3500,authority:3000,root:800});
const unavailable=()=>({statusCode:503,isBase64Encoded:false,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'},body:'{"state":"unavailable"}'});
function installation(value){
 if(!exact(value,['format','configuration','scope','verificationKey','minimum','callerKey'])||value.format!==1||Buffer.byteLength(JSON.stringify(value))>15000)throw fail();
 const copy=structuredClone(value),bundle=gatewayAwsPolicyBundle(copy.configuration);
 authorityPolicy(copy.scope,copy.verificationKey);authorityReceipt(copy.minimum);
 if(reviewGatewayCallerKey(copy.callerKey).keyId!==copy.configuration.callerKeyId)throw fail();
 return {copy,bundle};
}
// Public manifest integrity only, not effective IAM or platform attestation.
export function reviewAwsAccountInstallation(value){try{const {copy}=installation(value);return {format:1,sha256:createHash('sha256').update(JSON.stringify(copy)).digest('hex')};}catch{throw fail();}}
function composition({enabled=false,installation:input,readEnvironment,openLambdaClient,openDynamoClient}={},kind){
 const owned=[];let adapter,inner,closed=false;
 const close=()=>{closed=true;for(const item of [...owned].reverse())try{item.close();}catch{}};
 if(enabled===true)try{
  if(openLambdaClient!==undefined&&typeof openLambdaClient!=='function'||openDynamoClient!==undefined&&typeof openDynamoClient!=='function')throw fail();
  const {copy:m}=installation(input),c=m.configuration,source=kind==='gateway'?c.bridge:c.authority,b=AWS_ACCOUNT_BUDGETS;
  adapter=createLambdaInvocationRuntime({enabled:true,resource:source,minimumRemainingMs:(kind==='gateway'?b.gateway:b.handler)+500,readEnvironment});owned.push(adapter);
  const credentials=createLambdaExecutionRoleProvider({enabled:true,kind,resource:source,readRuntime:adapter.readRuntime});owned.push(credentials);
  const runtime={credentials,credentialProfile:'lambda-execution-role',credentialSource:source};
  if(kind==='gateway'){
   const claims=createDynamoGatewayNonceStore({enabled:true,resource:{accountId:source.accountId,region:source.region,...c.nonce},callerKeyId:c.callerKeyId,...runtime,openClient:openDynamoClient,timeoutMs:b.nonce});owned.push(claims);
   const authority=createLambdaAccountCheckpointAuthority({enabled:true,resource:c.authority,scope:m.scope,verificationKey:m.verificationKey,minimum:m.minimum,...runtime,openClient:openLambdaClient,timeoutMs:b.invoke});owned.push(authority);
   inner=createAccountGatewayHandler({enabled:true,gateway:{...c.gateway,region:source.region},resource:c.authority,bridge:c.bridge,scope:m.scope,verificationKey:m.verificationKey,callerKey:m.callerKey,claims,authority,timeoutMs:b.gateway});
  }else{
   const store=createDynamoAccountCheckpointStore({enabled:true,scope:m.scope,verificationKey:m.verificationKey,resource:{accountId:source.accountId,region:source.region,...c.root},...runtime,openClient:openDynamoClient,timeoutMs:b.root});owned.push(store);
   const authority=createAccountCheckpointAuthority({enabled:true,scope:m.scope,verificationKey:m.verificationKey,minimum:m.minimum,store,timeoutMs:b.authority});owned.push(authority);
   inner=createAccountAuthorityLambdaHandler({enabled:true,resource:c.authority,scope:m.scope,verificationKey:m.verificationKey,authority,timeoutMs:b.handler});
  }
 }catch{close();throw fail();}
 return Object.freeze({
  async handler(event,trustedContext){
   if(enabled!==true||closed){if(kind==='gateway')return unavailable();throw fail();}
   try{return await adapter.run(trustedContext,()=>inner(event,trustedContext));}
   catch{if(kind==='gateway')return unavailable();throw fail();}
  },
  close
 });
}
export const createAwsAccountGatewayRuntime=options=>composition(options,'gateway');
export const createAwsAccountAuthorityRuntime=options=>composition(options,'authority');
