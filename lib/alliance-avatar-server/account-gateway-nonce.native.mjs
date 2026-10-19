// Disposable DynamoDB Local acceptance only, invoked inside the existing isolated
// runner. No AWS endpoint, production table, credential or key is used.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomUUID,createHash,generateKeyPairSync} from 'node:crypto';
import {DynamoDBClient,CreateTableCommand,DescribeTableCommand,DeleteTableCommand,UpdateTableCommand,UpdateTimeToLiveCommand} from '@aws-sdk/client-dynamodb';
import {createDynamoGatewayNonceStore} from './account-gateway-nonce.mjs';
import {createGatewayAccountCheckpointAuthority,createAccountGatewayHandler} from './account-gateway.mjs';
export async function runGatewayNonceFixture({admin,config,restart}={}){
 if(process.env.ALLIANCE_DYNAMO_TEST_CONFIRM!=='synthetic_account_dynamodb'||process.getuid?.()!==0||config?.endpoint!=='http://127.0.0.1:8557'||typeof restart!=='function')throw Error('Isolated synthetic nonce fixture required');
 const links=JSON.parse(execFileSync('ip',['-j','link','show'],{encoding:'utf8'}));if(links.length!==1||links[0].ifname!=='lo')throw Error('Loopback-only fixture required');
 const pair=generateKeyPairSync('ed25519'),der=pair.publicKey.export({format:'der',type:'spki'}),keyId=createHash('sha256').update(der).digest('hex');
 const r={accountId:'000000000000',region:'us-east-2',tableName:'alliance-account-nonce-fixture-'+randomUUID().replaceAll('-','').slice(0,16),tableId:randomUUID(),epoch:randomUUID()};
 const stores=[];let created=false,putAttempts=0,lostReply=false,badIdentity=false,replaceAfterPut=false;
 const claim=()=>({keyId,nonce:randomUUID().replaceAll('-',''),requestSha256:'c'.repeat(64),expiresAt:Math.floor(Date.now()/1000)+61});
 const make=()=>{
  const store=createDynamoGatewayNonceStore({enabled:true,resource:r,callerKeyId:keyId,timeoutMs:2000,credentials:async()=>config.credentials,openClient:()=>{
   const c=new DynamoDBClient(config);return {destroy:()=>c.destroy(),async send(command,options){
    assert.ok(['DescribeTableCommand','DescribeTimeToLiveCommand','PutItemCommand','GetItemCommand'].includes(command.constructor.name));
    assert.equal(command.input.TableName,r.tableName);if(command.constructor.name==='PutItemCommand')putAttempts++;
    const value=await c.send(command,options);
    if(command.constructor.name==='DescribeTableCommand'){
     // Local3.3.2 lacks AWS TableId/ARN. Only these fields are TEST projections.
     assert.equal(value.Table.TableArn,`arn:aws:dynamodb:ddblocal:000000000000:table/${r.tableName}`);assert.equal(value.Table.TableId,undefined);
     value.Table.TableArn=`arn:aws:dynamodb:${r.region}:${r.accountId}:table/${r.tableName}`;value.Table.TableId=badIdentity?randomUUID():r.tableId;
    }
    if(command.constructor.name==='PutItemCommand'){if(replaceAfterPut){replaceAfterPut=false;badIdentity=true;}if(lostReply){lostReply=false;throw Error('Synthetic lost reply after REAL nonce commit');}}
    return value;
   }};
  }});stores.push(store);return store;
 };
 const ttl=(enabled,attribute='expiresAt')=>admin.send(new UpdateTimeToLiveCommand({TableName:r.tableName,TimeToLiveSpecification:{Enabled:enabled,AttributeName:attribute}}));
 try{
  await admin.send(new CreateTableCommand({TableName:r.tableName,KeySchema:[{AttributeName:'nonceKey',KeyType:'HASH'}],AttributeDefinitions:[{AttributeName:'nonceKey',AttributeType:'S'}],BillingMode:'PAY_PER_REQUEST',DeletionProtectionEnabled:true}));created=true;await ttl(true);
  const original=claim(),a=make();assert.equal(await a.claim(original),true);assert.equal(await make().claim({...original,requestSha256:'d'.repeat(64)}),false);
  console.log('PASS actual nonce conditional PutItem and strong readback grant once; same nonce with changed digest denies; ARN/TableId projection is TEST ONLY');
  const competing=claim(),before=putAttempts,race=await Promise.all([make().claim(competing),make().claim(competing)]);assert.deepEqual(race.sort(),[false,true]);assert.equal(putAttempts-before,2);
  console.log('PASS two independent SDK nonce clients race in REAL DynamoDB Local: one true, one false, no expired-overwrite condition or retry');
  for(const s of stores)s.close();await restart();assert.equal(await make().claim(original),false);
  console.log('PASS consumed nonce survives actual emulator process stop/restart and fresh store construction; no AWS or physical-power-loss claim');
  const uncertain=claim(),lost=make();lostReply=true;const putsBefore=putAttempts;await assert.rejects(lost.claim(uncertain),e=>e.outcome==='unknown');assert.equal(putAttempts,putsBefore+1);await assert.rejects(lost.claim(uncertain));assert.equal(putAttempts,putsBefore+1);assert.equal(await make().claim(uncertain),false);
  console.log('PASS lost reply AFTER a REAL nonce commit returns unknown, faults that store, and fresh client rejects replay without granting');
  const driftStart=putAttempts;await ttl(false);await assert.rejects(make().claim(claim()),e=>e.outcome==='not_started');assert.equal(putAttempts,driftStart);await ttl(true);
  await ttl(false);await ttl(true,'otherExpiry');await assert.rejects(make().claim(claim()),e=>e.outcome==='not_started');assert.equal(putAttempts,driftStart);await ttl(false,'otherExpiry');await ttl(true);
  await admin.send(new UpdateTableCommand({TableName:r.tableName,DeletionProtectionEnabled:false}));await assert.rejects(make().claim(claim()),e=>e.outcome==='not_started');assert.equal(putAttempts,driftStart);await admin.send(new UpdateTableCommand({TableName:r.tableName,DeletionProtectionEnabled:true}));
  console.log('PASS actual disabled/wrong-attribute TTL and deletion-protection drift refuse before nonce writes; privileged repair is fixture-only');
  const changed=claim();replaceAfterPut=true;await assert.rejects(make().claim(changed),e=>e.outcome==='unknown');badIdentity=false;assert.equal(await make().claim(changed),false);
  console.log('PASS projected table-instance drift after real nonce write withholds authorization and retains the one-use record');
  // Actual signature verification + actual nonce store; HTTP/trusted context and
  // authority are SYNTHETIC, not a hosted gateway or real IAM acceptance.
  const gateway={apiId:'abcdefghij',region:r.region,stage:'preview'},resource={accountId:r.accountId,region:r.region,functionName:'alliance-account-authority-synthetic',version:'7'},bridge={...resource,functionName:'alliance-account-gateway-synthetic',version:'3'},scope={memberProjectRef:'abcdefghijklmnopqrst',journalProjectRef:'uvwxyzabcdefghijklmn',controlProjectRef:'opqrstuvwxyzabcdefgh',epoch:r.epoch},minimum={generation:1,sha256:'e'.repeat(64)},callerKey={keyId,spki:der.toString('base64')};
  let reads=0,saved;const authority={read:async()=>{reads++;return minimum;},advance:async()=>{throw Error('Unexpected write');},close(){}};
  const configHandler={enabled:true,gateway,resource,bridge,scope,verificationKey:'b'.repeat(64),callerKey,authority};
  const handler=createAccountGatewayHandler({...configHandler,claims:make()}),context={functionName:bridge.functionName,functionVersion:bridge.version,invokedFunctionArn:`arn:aws:lambda:${r.region}:${r.accountId}:function:${bridge.functionName}:${bridge.version}`,getRemainingTimeInMillis:()=>10000};
  const client=createGatewayAccountCheckpointAuthority({enabled:true,gateway,resource,scope,verificationKey:'b'.repeat(64),minimum,callerKey,signingKey:async()=>pair.privateKey,transport:async(options,body)=>{
   const headers={...options.headers,host:options.hostname};saved={httpMethod:'POST',resource:'/checkpoint',path:'/checkpoint',isBase64Encoded:false,queryStringParameters:null,multiValueQueryStringParameters:null,pathParameters:null,stageVariables:null,headers,multiValueHeaders:Object.fromEntries(Object.entries(headers).map(([k,v])=>[k,[v]])),body:body.toString('utf8'),requestContext:{accountId:r.accountId,apiId:gateway.apiId,stage:gateway.stage,domainName:options.hostname,resourcePath:'/checkpoint',httpMethod:'POST',path:options.path}};
   const out=await handler(saved,context);return {statusCode:out.statusCode,headers:{'content-type':out.headers['content-type']},body:Buffer.from(out.body)};
  }});
  try{assert.deepEqual(await client.read(),minimum);assert.equal(reads,1);const second=createAccountGatewayHandler({...configHandler,claims:make()});assert.equal((await second(structuredClone(saved),context)).statusCode,503);assert.equal(reads,1);}finally{client.close();}
  console.log('PASS real Ed25519 signed gateway request grants one synthetic authority read through REAL nonce storage; fresh handler replay performs no second read');
 }finally{
  for(const s of stores)s.close();if(created){await admin.send(new UpdateTableCommand({TableName:r.tableName,DeletionProtectionEnabled:false}));await admin.send(new DeleteTableCommand({TableName:r.tableName}));await assert.rejects(admin.send(new DescribeTableCommand({TableName:r.tableName})),e=>e.name==='ResourceNotFoundException');}
 }
 console.log('PASS exact synthetic nonce table and SDK clients removed; no AWS resources, real keys, IAM or hosted TTL/replay acceptance');
}
