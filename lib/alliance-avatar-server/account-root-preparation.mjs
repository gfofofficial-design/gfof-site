// OFFLINE first-install review only. No SDK, network, file/key/environment
// lookup, root construction, apply, retry, restore, reset or serving authority.
import {createHash} from 'node:crypto';
import {isDeepStrictEqual as same} from 'node:util';
import {reviewAccountHandoff} from './account-handoff.mjs';
import {controlExact as exact,controlHash as hash,controlUuid as uuid} from './control-policy.mjs';
const zero='0'.repeat(64),fail=()=>Error('alliance_account_root_preparation_unavailable');
const resourceKeys=['accountId','region','tableName','tableId','rootKey','custodyId'];
const sha=value=>createHash('sha256').update(JSON.stringify(value),'utf8').digest('hex');
function resource(value){
 if(!exact(value,resourceKeys)||typeof value.accountId!=='string'||!/^\d{12}$/.test(value.accountId)||typeof value.region!=='string'||!/^us-(east|west)-[12]$/.test(value.region)||typeof value.tableName!=='string'||!/^alliance-account-authority-[a-z0-9-]{1,40}$/.test(value.tableName)||!uuid(value.tableId)||!['rootKey','custodyId'].every(k=>hash(value[k])&&value[k]!==zero)||value.rootKey===value.custodyId)throw fail();
 return Object.fromEntries(resourceKeys.map(k=>[k,value[k]]));
}
const arn=r=>`arn:aws:dynamodb:${r.region}:${r.accountId}:table/${r.tableName}`;
function identity(r,description,ttl){
 const t=description?.Table;
 if(!t||t.TableArn!==arn(r)||t.TableId!==r.tableId||t.TableName!==r.tableName||t.TableStatus!=='ACTIVE'||t.DeletionProtectionEnabled!==true||t.BillingModeSummary?.BillingMode!=='PAY_PER_REQUEST'||!same(t.KeySchema,[{AttributeName:'rootKey',KeyType:'HASH'}])||!same(t.AttributeDefinitions,[{AttributeName:'rootKey',AttributeType:'S'}])||[t.GlobalSecondaryIndexes,t.LocalSecondaryIndexes,t.Replicas].some(v=>v!==undefined&&(!Array.isArray(v)||v.length!==0))||t.StreamSpecification!==undefined&&t.StreamSpecification.StreamEnabled!==false||ttl?.TimeToLiveDescription?.TimeToLiveStatus!=='DISABLED')throw fail();
 // ItemCount is approximate and deliberately supplies no empty-history proof.
}
function build(input){
 if(!exact(input,['resource','scope','verificationKey','receipt','bytes','tableDescription','ttlDescription']))throw fail();
 const r=resource(input.resource),p=input.receipt;
 if(!exact(p,['generation','sha256'])||p.generation!==1||!hash(p.sha256)||p.sha256===zero)throw fail();
 identity(r,input.tableDescription,input.ttlDescription);
 const record=reviewAccountHandoff({bytes:input.bytes,expectedSha256:p.sha256,expectedScope:input.scope,expectedVerificationKey:input.verificationKey,minimumGeneration:1});
 if(record.format!==1||record.generation!==1||record.previousSha256!==zero||record.pending!==null||!same(record.minimum,{head:{sequence:0,sha256:zero},acknowledged:{sequence:0,sha256:zero}}))throw fail();
 const item={rootKey:{S:r.rootKey},custodyId:{S:r.custodyId},generation:{N:'1'},sha256:{S:p.sha256},bytes:{B:Buffer.from(input.bytes).toString('base64')}};
 return {format:1,purpose:'first-install-review-only',resource:r,scope:record.scope,verificationKey:record.verificationKey,receipt:{generation:1,sha256:p.sha256},
  putItem:{TableName:arn(r),Item:item,ConditionExpression:'attribute_not_exists(#root)',ExpressionAttributeNames:{'#root':'rootKey'},ReturnValues:'NONE',ReturnValuesOnConditionCheckFailure:'NONE',ReturnConsumedCapacity:'NONE'},
  getItem:{TableName:arn(r),Key:{rootKey:{S:r.rootKey}},ConsistentRead:true,ReturnConsumedCapacity:'NONE'}};
}
export function prepareInitialAccountRoot(input){try{return build(input);}catch{throw fail();}}
// Exact artifact comparison is not authorization, an IAM evaluation or custody.
export function reviewInitialAccountRoot({input,prepared}={}){
 try{const expected=build(input);if(!same(prepared,expected))throw fail();return {matches:true,sha256:sha(expected)};}catch{throw fail();}
}
// Accept CLI-shaped JSON only; B is canonical base64, not an SDK Uint8Array.
// Fresh metadata/readback must be obtained by a separately authorized operator.
export function reviewInitialAccountRootReadback({input,prepared,observation}={}){
 try{
  const review=reviewInitialAccountRoot({input,prepared});
  if(!exact(observation,['tableDescription','ttlDescription','item']))throw fail();
  identity(prepared.resource,observation.tableDescription,observation.ttlDescription);
  if(!same(observation.item,prepared.putItem.Item))throw fail();
  return {matchesSuppliedReadback:true,planSha256:review.sha256,receipt:{...prepared.receipt},access:'closed'};
 }catch{throw fail();}
}
