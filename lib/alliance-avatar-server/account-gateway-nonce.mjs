// Source-only gateway claim capability. No table creation/delete/reset, scans,
// environment lookup, default credentials, fallback, retry or expired overwrite.
import {DynamoDBClient,DescribeTableCommand,DescribeTimeToLiveCommand,GetItemCommand,PutItemCommand} from '@aws-sdk/client-dynamodb';
import {Agent} from 'node:https';
import {performance} from 'node:perf_hooks';
import {isDeepStrictEqual as same} from 'node:util';
import {controlExact as exact,controlHash as hash} from './control-policy.mjs';
const fail=(outcome='not_started')=>Object.assign(Error('alliance_gateway_nonce_unavailable'),{outcome});
const uuid=v=>typeof v==='string'&&(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/).test(v);
export function createDynamoGatewayNonceStore({enabled=false,resource,callerKeyId,credentials,openClient,timeoutMs=1500}={}){
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>2000)throw fail();let client,agent,arn;
 if(enabled===true){
  if(!exact(resource,['accountId','region','tableName','tableId','epoch'])||typeof resource.accountId!=='string'||!(/^\d{12}$/).test(resource.accountId)||typeof resource.region!=='string'||!(/^us-(east|west)-[12]$/).test(resource.region)||typeof resource.tableName!=='string'||!(/^alliance-account-nonce-[a-z0-9-]{1,40}$/).test(resource.tableName)||!uuid(resource.tableId)||!uuid(resource.epoch)||!hash(callerKeyId)||callerKeyId==='0'.repeat(64)||typeof credentials!=='function'||openClient!==undefined&&typeof openClient!=='function')throw fail();
  resource={...resource};arn=`arn:aws:dynamodb:${resource.region}:${resource.accountId}:table/${resource.tableName}`;
  // Only an explicit temporary AWS-side provider is permitted, never a key in
  // Netlify. Issuer/role provenance still needs real deployment acceptance.
  const temporary=async()=>{
   const v=await credentials(),expires=v?.expiration?.getTime?.(),now=Date.now();
   if(typeof v?.accessKeyId!=='string'||!(/^ASIA[A-Z0-9]{16}$/).test(v.accessKeyId)||typeof v.secretAccessKey!=='string'||v.secretAccessKey.length<16||v.secretAccessKey.length>128||typeof v.sessionToken!=='string'||v.sessionToken.length<16||v.sessionToken.length>8192||!Number.isFinite(expires)||expires<now+timeoutMs+60000||expires>now+3600000)throw fail();
   return {accessKeyId:v.accessKeyId,secretAccessKey:v.secretAccessKey,sessionToken:v.sessionToken,expiration:new Date(expires)};
  };
  agent=new Agent({keepAlive:true,maxSockets:2,maxTotalSockets:2,minVersion:'TLSv1.2',rejectUnauthorized:true});
  const config={region:resource.region,endpoint:`https://dynamodb.${resource.region}.amazonaws.com`,credentials:temporary,maxAttempts:1,retryMode:'standard',endpointDiscoveryEnabled:false,useFipsEndpoint:false,useDualstackEndpoint:false,requestHandler:{httpsAgent:agent,connectionTimeout:400,requestTimeout:700,throwOnRequestTimeout:true}};
  try{client=openClient?openClient(config):new DynamoDBClient(config);if(typeof client?.send!=='function'||typeof client?.destroy!=='function')throw fail();}catch{agent.destroy();throw fail();}
 }
 let closed=false,faulted=false,active=false,controller;
 async function claim(input,{signal}={}){
  if(enabled!==true||closed||faulted||active||signal?.aborted)throw fail();
  let q;
  try{
   if(!exact(input,['keyId','nonce','requestSha256','expiresAt'])||input.keyId!==callerKeyId||typeof input.nonce!=='string'||!(/^[a-f0-9]{32}$/).test(input.nonce)||!hash(input.requestSha256)||!Number.isSafeInteger(input.expiresAt))throw fail();
   q={...input};const remaining=q.expiresAt-Math.floor(Date.now()/1000);if(remaining<1||remaining>61)throw fail();
  }catch{throw fail();}
  // Epoch is audit metadata, NEVER a fresh nonce namespace. A config-only epoch
  // change must not let the same key/request bypass an existing consumption.
  const nonceKey=`${q.keyId}#${q.nonce}`;
  const item={nonceKey:{S:nonceKey},epoch:{S:resource.epoch},keyId:{S:q.keyId},nonce:{S:q.nonce},requestSha256:{S:q.requestSha256},expiresAt:{N:String(q.expiresAt)}};
  active=true;let dispatched=false,onAbort;const c=new AbortController(),abort=()=>c.abort(),started=performance.now();controller=c;
  signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  const stopped=new Promise((_,reject)=>{onAbort=()=>reject(fail());c.signal.addEventListener('abort',onAbort,{once:true});}),timer=setTimeout(abort,timeoutMs);
  const check=()=>{if(closed||faulted||c.signal.aborted||performance.now()-started>=timeoutMs||Math.floor(Date.now()/1000)>=q.expiresAt)throw fail();};
  const send=async command=>{
   const r=await Promise.race([Promise.resolve().then(()=>{check();return client.send(command,{abortSignal:c.signal});}),stopped]);check();
   if(r?.$metadata?.httpStatusCode!==200||r.$metadata.attempts!==1||r.$metadata.totalRetryDelay!==0)throw fail();return r;
  };
  async function identity(){
   const [d,ttl]=await Promise.all([send(new DescribeTableCommand({TableName:resource.tableName})),send(new DescribeTimeToLiveCommand({TableName:resource.tableName}))]);check();const t=d.Table;
   if(!t||t.TableArn!==arn||t.TableId!==resource.tableId||t.TableName!==resource.tableName||t.TableStatus!=='ACTIVE'||t.DeletionProtectionEnabled!==true||t.BillingModeSummary?.BillingMode!=='PAY_PER_REQUEST'||!same(t.KeySchema,[{AttributeName:'nonceKey',KeyType:'HASH'}])||!same(t.AttributeDefinitions,[{AttributeName:'nonceKey',AttributeType:'S'}])||[t.GlobalSecondaryIndexes,t.LocalSecondaryIndexes,t.Replicas].some(v=>v!==undefined&&(!Array.isArray(v)||v.length!==0))||t.StreamSpecification!==undefined&&t.StreamSpecification.StreamEnabled!==false||ttl.TimeToLiveDescription?.TimeToLiveStatus!=='ENABLED'||ttl.TimeToLiveDescription.AttributeName!=='expiresAt')throw fail();
  }
  try{
   await identity();check();
   const command=new PutItemCommand({TableName:resource.tableName,Item:item,ConditionExpression:'attribute_not_exists(#key)',ExpressionAttributeNames:{'#key':'nonceKey'},ReturnValues:'NONE',ReturnValuesOnConditionCheckFailure:'NONE',ReturnConsumedCapacity:'NONE',ReturnItemCollectionMetrics:'NONE'});
   dispatched=true;let duplicate=false;
   try{await send(command);}catch(e){check();if(e?.name!=='ConditionalCheckFailedException'||e.$metadata?.httpStatusCode!==400||e.$metadata.attempts!==1||e.$metadata.totalRetryDelay!==0)throw e;duplicate=true;}
   if(duplicate){await identity();check();return false;}
   const observed=await send(new GetItemCommand({TableName:resource.tableName,Key:{nonceKey:{S:nonceKey}},ConsistentRead:true,ReturnConsumedCapacity:'NONE'}));check();
   if(!same(observed.Item,item))throw fail();
   await identity();check();return true;
  }catch{faulted=true;try{client?.destroy();}catch{}agent?.destroy();throw fail(dispatched?'unknown':'not_started');}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);c.signal.removeEventListener('abort',onAbort);c.abort();active=false;controller=undefined;}
 }
 return Object.freeze({claim,close(){closed=true;controller?.abort();try{client?.destroy();}catch{}agent?.destroy();}});
}
