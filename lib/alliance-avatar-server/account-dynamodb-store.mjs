// Source-only authority backing store. NEVER give this client/CAS to the app.
// No table/item creation, reset, delete, restore, env lookup or default credentials.
import {DynamoDBClient,DescribeTableCommand,DescribeTimeToLiveCommand,GetItemCommand,PutItemCommand} from '@aws-sdk/client-dynamodb';
import {Agent} from 'node:https';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {isDeepStrictEqual as same} from 'node:util';
import {accountHandoffBytes,reviewAccountHandoff} from './account-handoff.mjs';
import {controlExact as exact,controlHash as hash} from './control-policy.mjs';
const zero='0'.repeat(64),sha=b=>createHash('sha256').update(b).digest('hex');
const fail=(outcome='not_started')=>Object.assign(Error('alliance_account_dynamodb_unavailable'),{outcome});
function receipt(v){
 if(!exact(v,['generation','sha256'])||!Number.isSafeInteger(v.generation)||v.generation<1||v.generation>2147483646||!hash(v.sha256)||v.sha256===zero)throw fail();
 return {generation:v.generation,sha256:v.sha256};
}
export function createDynamoAccountCheckpointStore({enabled=false,scope,verificationKey,resource,credentials,openClient,timeoutMs=2000}={}){
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>2500)throw fail();let client,agent,arn;
 if(enabled===true){
  if(!exact(resource,['accountId','region','tableName','tableId','rootKey','custodyId'])||!/^\d{12}$/.test(resource.accountId)||!/^us-(east|west)-[12]$/.test(resource.region)||!/^alliance-account-authority-[a-z0-9-]{1,40}$/.test(resource.tableName)||!(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/).test(resource.tableId)||!['rootKey','custodyId'].every(k=>hash(resource[k])&&resource[k]!==zero)||resource.rootKey===resource.custodyId||typeof credentials!=='function'||openClient!==undefined&&typeof openClient!=='function')throw fail();
  resource={...resource};scope=structuredClone(scope);
  accountHandoffBytes({format:1,scope,generation:1,previousSha256:zero,verificationKey,minimum:{head:{sequence:0,sha256:zero},acknowledged:{sequence:0,sha256:zero}},pending:null});
  arn=`arn:aws:dynamodb:${resource.region}:${resource.accountId}:table/${resource.tableName}`;
  agent=new Agent({keepAlive:true,maxSockets:2,maxTotalSockets:2,minVersion:'TLSv1.2',rejectUnauthorized:true});
  const config={region:resource.region,endpoint:`https://dynamodb.${resource.region}.amazonaws.com`,credentials,maxAttempts:1,retryMode:'standard',endpointDiscoveryEnabled:false,useFipsEndpoint:false,useDualstackEndpoint:false,requestHandler:{httpsAgent:agent,connectionTimeout:500,requestTimeout:800,throwOnRequestTimeout:true}};
  try{client=openClient?openClient(config):new DynamoDBClient(config);if(typeof client?.send!=='function'||typeof client?.destroy!=='function')throw fail();}catch{agent.destroy();throw fail();}
 }
 let closed=false,active=false,controller;
 function canonical(bytes,r){
  if(!(bytes instanceof Uint8Array)||bytes.byteLength<1||bytes.byteLength>4096)throw fail();const copy=Buffer.from(bytes),pin=receipt(r);
  const record=reviewAccountHandoff({bytes:copy,expectedSha256:pin.sha256,expectedScope:scope,expectedVerificationKey:verificationKey,minimumGeneration:pin.generation});
  if(record.generation!==pin.generation)throw fail();return {bytes:copy,receipt:pin,record};
 }
 function decode(item){
  if(!exact(item,['rootKey','custodyId','generation','sha256','bytes'])||!exact(item.rootKey,['S'])||item.rootKey.S!==resource.rootKey||!exact(item.custodyId,['S'])||item.custodyId.S!==resource.custodyId||!exact(item.generation,['N'])||!/^\d{1,10}$/.test(item.generation.N)||String(Number(item.generation.N))!==item.generation.N||!exact(item.sha256,['S'])||!exact(item.bytes,['B']))throw fail();
  return canonical(item.bytes.B,{generation:Number(item.generation.N),sha256:item.sha256.S});
 }
 async function operation(input,{signal}={},write=false){
  if(enabled!==true||closed||signal?.aborted||active)throw fail();let next,expected;
  if(write)try{
   if(!exact(input,['expected','bytes']))throw fail();expected=receipt(input.expected);
   if(!(input.bytes instanceof Uint8Array)||input.bytes.byteLength<1||input.bytes.byteLength>4096)throw fail();const bytes=Buffer.from(input.bytes);
   next=canonical(bytes,{generation:expected.generation+1,sha256:sha(bytes)});if(next.record.previousSha256!==expected.sha256)throw fail();
  }catch{throw fail();}
  active=true;let dispatched=false,onAbort;
  const c=new AbortController(),abort=()=>c.abort(),started=performance.now();controller=c;signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  const stopped=new Promise((_,reject)=>{onAbort=()=>reject(fail());c.signal.addEventListener('abort',onAbort,{once:true});}),timer=setTimeout(abort,timeoutMs);
  const check=()=>{if(closed||c.signal.aborted||performance.now()-started>=timeoutMs)throw fail();};
  const send=async command=>{
   const result=await Promise.race([Promise.resolve().then(()=>{check();return client.send(command,{abortSignal:c.signal});}),stopped]);check();
   if(result?.$metadata?.httpStatusCode!==200||result.$metadata.attempts!==1||result.$metadata.totalRetryDelay!==0)throw fail();return result;
  };
  const identity=async()=>{
   const [description,ttl]=await Promise.all([send(new DescribeTableCommand({TableName:resource.tableName})),send(new DescribeTimeToLiveCommand({TableName:resource.tableName}))]);check();const t=description.Table;
   if(!t||t.TableArn!==arn||t.TableId!==resource.tableId||t.TableName!==resource.tableName||t.TableStatus!=='ACTIVE'||t.DeletionProtectionEnabled!==true||t.BillingModeSummary?.BillingMode!=='PAY_PER_REQUEST'||!same(t.KeySchema,[{AttributeName:'rootKey',KeyType:'HASH'}])||!same(t.AttributeDefinitions,[{AttributeName:'rootKey',AttributeType:'S'}])||[t.GlobalSecondaryIndexes,t.LocalSecondaryIndexes,t.Replicas].some(v=>v!==undefined&&(!Array.isArray(v)||v.length!==0))||t.StreamSpecification!==undefined&&t.StreamSpecification.StreamEnabled!==false||ttl.TimeToLiveDescription?.TimeToLiveStatus!=='DISABLED')throw fail();
  };
  const read=async()=>decode((await send(new GetItemCommand({TableName:resource.tableName,Key:{rootKey:{S:resource.rootKey}},ConsistentRead:true,ReturnConsumedCapacity:'NONE'}))).Item);
  try{
   await identity();check();const before=await read();check();
   if(!write)return {bytes:Buffer.from(before.bytes),receipt:{...before.receipt}};
   if(!same(expected,before.receipt))return {state:'conflict',receipt:{...before.receipt}};
   const Item={rootKey:{S:resource.rootKey},custodyId:{S:resource.custodyId},generation:{N:String(next.receipt.generation)},sha256:{S:next.receipt.sha256},bytes:{B:Buffer.from(next.bytes)}};
   const command=new PutItemCommand({TableName:resource.tableName,Item,ConditionExpression:'attribute_exists(#key) AND #custody = :custody AND #generation = :generation AND #sha = :sha AND #bytes = :bytes',ExpressionAttributeNames:{'#key':'rootKey','#custody':'custodyId','#generation':'generation','#sha':'sha256','#bytes':'bytes'},ExpressionAttributeValues:{':custody':{S:resource.custodyId},':generation':{N:String(expected.generation)},':sha':{S:expected.sha256},':bytes':{B:Buffer.from(before.bytes)}},ReturnValues:'NONE',ReturnValuesOnConditionCheckFailure:'NONE',ReturnConsumedCapacity:'NONE'});
   let conflict=false;dispatched=true;
   try{await send(command);}catch(e){
    check();if(e?.name!=='ConditionalCheckFailedException'||e.$metadata?.httpStatusCode!==400||e.$metadata.attempts!==1||e.$metadata.totalRetryDelay!==0)throw e;conflict=true;
   }
   await identity();check();
   if(conflict){const current=await read();check();return {state:'conflict',receipt:{...current.receipt}};}
   // The trusted authority performs a fresh full read before releasing evidence.
   return {state:'committed',receipt:{...next.receipt}};
  }catch{throw fail(dispatched?'unknown':'not_started');}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);c.signal.removeEventListener('abort',onAbort);c.abort();active=false;controller=undefined;}
 }
 return Object.freeze({read:options=>operation(null,options),compareAndSet:(input,options)=>operation(input,options,true),close(){closed=true;controller?.abort();client?.destroy();agent?.destroy();}});
}
