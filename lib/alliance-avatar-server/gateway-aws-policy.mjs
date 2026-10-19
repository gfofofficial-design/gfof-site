// Offline policy artifacts only. No SDK, IAM calls, deployment, role creation,
// installation approval, credentials or effective-permission simulation.
import {createHash} from 'node:crypto';
import {isDeepStrictEqual as same} from 'node:util';
import {controlExact as exact,controlHash as hash,controlUuid as uuid} from './control-policy.mjs';
import {authorityArn} from './account-authority-wire.mjs';
const fail=()=>Error('alliance_gateway_policy_unavailable'),version='2012-10-17';
function configuration(v){
 if(!exact(v,['gateway','bridge','authority','nonce','root','roles','callerKeyId']))throw fail();
 const authority=authorityArn(v.authority),a=v.authority,b=v.bridge,g=v.gateway,n=v.nonce,r=v.root;
 if(!exact(b,['accountId','region','functionName','version'])||b.accountId!==a.accountId||b.region!==a.region||typeof b.functionName!=='string'||!(/^alliance-account-gateway-[a-z0-9-]{1,39}$/).test(b.functionName)||typeof b.version!=='string'||!(/^[1-9]\d{0,8}$/).test(b.version)||!exact(g,['apiId','stage'])||typeof g.apiId!=='string'||!(/^[a-z0-9]{10}$/).test(g.apiId)||typeof g.stage!=='string'||!(/^[a-z][a-z0-9_-]{0,31}$/).test(g.stage))throw fail();
 if(!exact(n,['tableName','tableId','epoch'])||typeof n.tableName!=='string'||!(/^alliance-account-nonce-[a-z0-9-]{1,40}$/).test(n.tableName)||!uuid(n.tableId)||!uuid(n.epoch)||!exact(r,['tableName','tableId','rootKey','custodyId'])||typeof r.tableName!=='string'||!(/^alliance-account-authority-[a-z0-9-]{1,40}$/).test(r.tableName)||!uuid(r.tableId)||r.tableId===n.tableId||![r.rootKey,r.custodyId,v.callerKeyId].every(x=>hash(x)&&x!=='0'.repeat(64))||r.rootKey===r.custodyId)throw fail();
 if(!exact(v.roles,['gateway','authority'])||typeof v.roles.gateway!=='string'||!(/^alliance-account-gateway-role-[a-z0-9-]{1,32}$/).test(v.roles.gateway)||typeof v.roles.authority!=='string'||!(/^alliance-account-authority-role-[a-z0-9-]{1,30}$/).test(v.roles.authority))throw fail();
 return {v:structuredClone(v),authority,bridge:`arn:aws:lambda:${b.region}:${b.accountId}:function:${b.functionName}:${b.version}`};
}
function buildPolicyBundle(input){
 const {v,authority,bridge}=configuration(input),a=v.authority,b=v.bridge;
 const unqualified=arn=>arn.slice(0,arn.lastIndexOf(':')),table=name=>`arn:aws:dynamodb:${a.region}:${a.accountId}:table/${name}`;
 const condition=source=>({ArnEquals:{'lambda:SourceFunctionArn':source},StringEquals:{'aws:RequestedRegion':a.region},Bool:{'aws:SecureTransport':'true'}});
 const statement=(Sid,Action,Resource,Condition)=>({Sid,Effect:'Allow',Action,Resource,Condition});
 const metadata=(sid,resource,source)=>statement(sid,['dynamodb:DescribeTable','dynamodb:DescribeTimeToLive'],resource,condition(source));
 const gatewayItems=condition(unqualified(bridge));gatewayItems['ForAllValues:StringLike']={'dynamodb:LeadingKeys':[`${v.callerKeyId}#*`]};gatewayItems.Null={'dynamodb:LeadingKeys':'false'};
 const rootItems=condition(unqualified(authority));rootItems['ForAllValues:StringEquals']={'dynamodb:LeadingKeys':[v.root.rootKey]};rootItems.Null={'dynamodb:LeadingKeys':'false'};
 const gatewayIdentity={Version:version,Statement:[statement('InvokePinnedAuthority',['lambda:InvokeFunction'],authority,condition(unqualified(bridge))),metadata('InspectNonceTable',table(v.nonce.tableName),unqualified(bridge)),statement('ClaimOwnKeyNonces',['dynamodb:GetItem','dynamodb:PutItem'],table(v.nonce.tableName),gatewayItems)]};
 const authorityIdentity={Version:version,Statement:[metadata('InspectAuthorityTable',table(v.root.tableName),unqualified(authority)),statement('OwnRootRecord',['dynamodb:GetItem','dynamodb:PutItem'],table(v.root.tableName),rootItems)]};
 const executionTrust={Version:version,Statement:[{Sid:'LambdaServiceOnly',Effect:'Allow',Principal:{Service:'lambda.amazonaws.com'},Action:'sts:AssumeRole'}]};
 const sourceArn=`arn:aws:execute-api:${a.region}:${a.accountId}:${v.gateway.apiId}/${v.gateway.stage}/POST/checkpoint`;
 const gatewayAddPermission={FunctionName:unqualified(bridge),Qualifier:b.version,StatementId:'AllianceExactRestGateway',Action:'lambda:InvokeFunction',Principal:'apigateway.amazonaws.com',SourceArn:sourceArn,SourceAccount:a.accountId};
 const gatewayResourcePolicy={Version:version,Statement:[{Sid:'AllianceExactRestGateway',Effect:'Allow',Principal:{Service:'apigateway.amazonaws.com'},Action:'lambda:InvokeFunction',Resource:bridge,Condition:{ArnLike:{'AWS:SourceArn':sourceArn},StringEquals:{'AWS:SourceAccount':a.accountId}}}]};
 return {format:1,binding:v,roleArns:{gateway:`arn:aws:iam::${a.accountId}:role/${v.roles.gateway}`,authority:`arn:aws:iam::${a.accountId}:role/${v.roles.authority}`},gatewayIdentity,authorityIdentity,gatewayBoundary:structuredClone(gatewayIdentity),authorityBoundary:structuredClone(authorityIdentity),gatewayExecutionTrust:structuredClone(executionTrust),authorityExecutionTrust:structuredClone(executionTrust),gatewayAddPermission,gatewayResourcePolicy,expectedAbsent:{authorityResourcePolicy:true,tableResourcePolicies:true,functionUrls:true}};
}
export function gatewayAwsPolicyBundle(input){try{return buildPolicyBundle(input);}catch{throw fail();}}
// Exact artifact comparison, NOT an IAM evaluator or proof of installed state.
export function reviewGatewayAwsPolicyBundle({configuration:input,bundle}={}){
 try{if(Buffer.byteLength(JSON.stringify(bundle))>20000)throw fail();const expected=gatewayAwsPolicyBundle(input);if(!same(bundle,expected))throw fail();return {matches:true,sha256:createHash('sha256').update(JSON.stringify(expected),'utf8').digest('hex')};}catch{throw fail();}
}
