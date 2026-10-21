import test from 'node:test';
import assert from 'node:assert/strict';
import {AsyncResource} from 'node:async_hooks';
import {spawnSync} from 'node:child_process';
import {createLambdaInvocationRuntime as createRuntime} from './lambda-invocation-runtime.mjs';
const resource={accountId:'123456789012',region:'us-east-2',functionName:'alliance-account-gateway-synthetic',version:'3'};
const context=()=>({functionName:resource.functionName,functionVersion:resource.version,invokedFunctionArn:`arn:aws:lambda:${resource.region}:${resource.accountId}:function:${resource.functionName}:${resource.version}`,getRemainingTimeInMillis:()=>10000});
const environment=()=>({AWS_REGION:resource.region,AWS_EXECUTION_ENV:'AWS_Lambda_nodejs24.x',AWS_LAMBDA_FUNCTION_NAME:resource.functionName,AWS_LAMBDA_FUNCTION_VERSION:resource.version,AWS_LAMBDA_INITIALIZATION_TYPE:'on-demand',AWS_ACCESS_KEY_ID:'ASIA'+'G'.repeat(16),AWS_SECRET_ACCESS_KEY:'G'.repeat(40),AWS_SESSION_TOKEN:'synthetic-memory-only-gateway'});
const error=/^Error: alliance_lambda_invocation_unavailable$/;
test('invocation adapter import/default-off/string flags do not read environment or execute operations',async()=>{
 let reads=0,operations=0;for(const enabled of [false,undefined,'true']){const r=createRuntime({enabled,readEnvironment:()=>reads++});await assert.rejects(r.run(context(),()=>operations++),error);assert.throws(()=>r.readRuntime(),error);r.close();}assert.equal(reads,0);assert.equal(operations,0);
});
test('invocation adapter refuses malformed expected binding without discovering runtime metadata',()=>{
 for(const patch of [{resource:{...resource,version:'live'}},{resource:{...resource,region:'http://other.invalid'}},{resource:{...resource,extra:1}},{minimumRemainingMs:7001},{readEnvironment:null}])assert.throws(()=>createRuntime({enabled:true,resource,...patch}),error);
});
test('wrong actual context, aliases and low remaining time do not read even public environment fields',async()=>{
 let reads=0;const r=createRuntime({enabled:true,resource,readEnvironment:()=>{reads++;return environment();}});
 try{for(const patch of [{functionName:'other'},{functionVersion:'4'},{invokedFunctionArn:context().invokedFunctionArn.replace(':3',':live')},{invokedFunctionArn:context().invokedFunctionArn.replace('123456789012','999999999999')},{getRemainingTimeInMillis:()=>5999},{getRemainingTimeInMillis:()=>NaN}])await assert.rejects(r.run({...context(),...patch},()=>r.readRuntime()),error);assert.equal(reads,0);}finally{r.close();}
});
test('outside invocation and unsupported platform metadata refuse before credential field access',async()=>{
 for(const patch of [{AWS_REGION:'us-west-2'},{AWS_EXECUTION_ENV:'AWS_Lambda_nodejs22.x'},{AWS_LAMBDA_FUNCTION_NAME:'other'},{AWS_LAMBDA_FUNCTION_VERSION:'$LATEST'},{AWS_LAMBDA_INITIALIZATION_TYPE:'lambda-managed-instances'}]){
  let credentials=0;const env=new Proxy({...environment(),...patch},{get(t,k){if(['AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','AWS_SESSION_TOKEN'].includes(k))credentials++;return t[k];}}),r=createRuntime({enabled:true,resource,readEnvironment:()=>env});
  try{assert.throws(()=>r.readRuntime(),error);await assert.rejects(r.run(context(),()=>r.readRuntime()),error);assert.equal(credentials,0);}finally{r.close();}
 }
});
test('only eight explicit platform fields are read; credentials change without caching or event fallback',async()=>{
 let env=environment();const accessed=[];const r=createRuntime({enabled:true,resource,readEnvironment:()=>new Proxy(env,{get(t,k){accessed.push(k);return t[k];},ownKeys(){throw Error('must not enumerate environment');}})});
 try{await r.run(context(),()=>{assert.equal(r.readRuntime().credentials.accessKeyId,env.AWS_ACCESS_KEY_ID);env={...env,AWS_ACCESS_KEY_ID:'ASIA'+'H'.repeat(16)};const next=r.readRuntime();assert.equal(next.credentials.accessKeyId,env.AWS_ACCESS_KEY_ID);assert.deepEqual(Object.keys(next.credentials),['accessKeyId','secretAccessKey','sessionToken']);assert.equal(Object.hasOwn(next.credentials,'expiration'),false);});assert.deepEqual([...new Set(accessed)].sort(),Object.keys(environment()).sort());}finally{r.close();}
});
test('a callback retained by an ended invocation cannot borrow a subsequent invocation context',async()=>{
 let reads=0,late;const r=createRuntime({enabled:true,resource,readEnvironment:()=>{reads++;return environment();}});
 try{await r.run(context(),()=>{late=AsyncResource.bind(()=>r.readRuntime());assert.equal(r.readRuntime().region,resource.region);});assert.throws(late,error);await r.run(context(),()=>{assert.throws(late,error);assert.equal(r.readRuntime().region,resource.region);});assert.equal(reads,2);}finally{r.close();}
});
test('one active invocation refuses a concurrent one, then permits a fresh invocation without stale state',async()=>{
 let enter,release,reads=0;const ready=new Promise(r=>enter=r),r=createRuntime({enabled:true,resource,readEnvironment:()=>{reads++;return environment();}});
 try{const pending=r.run(context(),async()=>{enter();await new Promise(res=>release=res);return r.readRuntime().region;});await ready;await assert.rejects(r.run(context(),()=>r.readRuntime()),error);assert.equal(reads,0);release();assert.equal(await pending,resource.region);await r.run(context(),()=>r.readRuntime());assert.equal(reads,2);}finally{release?.();r.close();}
});
test('close cancels invocation admission and a delayed callback cannot read environment afterward',async()=>{
 let enter,release,reads=0;const ready=new Promise(r=>enter=r),r=createRuntime({enabled:true,resource,readEnvironment:()=>{reads++;return environment();}});
 try{const pending=r.run(context(),async()=>{enter();await new Promise(res=>release=res);return r.readRuntime();});await ready;r.close();await assert.rejects(pending,error);release();await new Promise(res=>setImmediate(res));await assert.rejects(r.run(context(),()=>r.readRuntime()),error);assert.equal(reads,0);}finally{release?.();r.close();}
});
test('context mutation and raw environment failures are sanitized without outputting diagnostics',async()=>{
 const ctx=context(),r=createRuntime({enabled:true,resource,readEnvironment:()=>{throw Error('private-environment-detail');}});try{await assert.rejects(r.run(ctx,()=>r.readRuntime()),error);ctx.functionVersion='4';await assert.rejects(r.run(ctx,()=>r.readRuntime()),error);}finally{r.close();}
});
test('concrete process-environment adapter runs only in a child with an explicitly synthetic environment',()=>{
 const moduleUrl=new URL('./lambda-invocation-runtime.mjs',import.meta.url).href;
 const code=`import {createLambdaInvocationRuntime} from ${JSON.stringify(moduleUrl)};const resource=${JSON.stringify(resource)};const r=createLambdaInvocationRuntime({enabled:true,resource});const context={...resource,functionVersion:resource.version,invokedFunctionArn:'arn:aws:lambda:'+resource.region+':'+resource.accountId+':function:'+resource.functionName+':'+resource.version,getRemainingTimeInMillis:()=>10000};await r.run(context,()=>{const value=r.readRuntime();if(value.credentials.accessKeyId!=='ASIA'+'G'.repeat(16)||Object.hasOwn(value.credentials,'expiration'))throw Error('synthetic_check_failed');});r.close();console.log('synthetic_environment_pass');`;
 const result=spawnSync(process.execPath,['--input-type=module','--eval',code],{env:environment(),encoding:'utf8',timeout:5000});assert.equal(result.status,0,result.stderr);assert.equal(result.stdout.trim(),'synthetic_environment_pass');
});
