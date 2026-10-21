// AWS-side invocation adapter only. Import/default-off construction reads no
// environment values. Injected environments are for trusted composition/tests.
import {AsyncLocalStorage} from 'node:async_hooks';
import {controlExact as exact} from './control-policy.mjs';
const fail=()=>Error('alliance_lambda_invocation_unavailable');
const environment=()=>process.env;
export function createLambdaInvocationRuntime({enabled=false,resource,minimumRemainingMs=6000,readEnvironment=environment}={}){
 if(!Number.isInteger(minimumRemainingMs)||minimumRemainingMs<100||minimumRemainingMs>7000)throw fail();
 let expected,arn,active,closed=false;const local=new AsyncLocalStorage();
 if(enabled===true){
  if(!exact(resource,['accountId','region','functionName','version'])||typeof resource.accountId!=='string'||!/^\d{12}$/.test(resource.accountId)||typeof resource.region!=='string'||!/^us-(east|west)-[12]$/.test(resource.region)||typeof resource.functionName!=='string'||!/^alliance-account-(gateway|authority)-[a-z0-9-]{1,37}$/.test(resource.functionName)||typeof resource.version!=='string'||!(/^[1-9]\d{0,8}$/).test(resource.version)||typeof readEnvironment!=='function')throw fail();
  expected=Object.freeze({...resource});arn=`arn:aws:lambda:${expected.region}:${expected.accountId}:function:${expected.functionName}:${expected.version}`;
 }
 function context(value,minimum){
  if(!value||value.functionName!==expected.functionName||value.functionVersion!==expected.version||value.invokedFunctionArn!==arn||typeof value.getRemainingTimeInMillis!=='function')throw fail();
  const remaining=value.getRemainingTimeInMillis();if(!Number.isFinite(remaining)||remaining<minimum)throw fail();
 }
 const check=scope=>{if(enabled!==true||closed||!scope||scope!==active||!scope.alive||scope.controller.signal.aborted)throw fail();context(scope.context,100);};
 return Object.freeze({
  async run(trustedContext,operation){
   if(enabled!==true||closed||active||typeof operation!=='function')throw fail();
   try{context(trustedContext,minimumRemainingMs);}catch{throw fail();}
   const scope={context:trustedContext,alive:true,controller:new AbortController()};let onAbort;
   active=scope;
   const stopped=new Promise((_,reject)=>{onAbort=()=>reject(fail());scope.controller.signal.addEventListener('abort',onAbort,{once:true});});
   try{return await local.run(scope,()=>Promise.race([Promise.resolve().then(()=>{check(scope);return operation({signal:scope.controller.signal});}),stopped]));}
   catch{throw fail();}
   finally{scope.alive=false;scope.controller.signal.removeEventListener('abort',onAbort);scope.controller.abort();if(active===scope)active=undefined;}
  },
  readRuntime(){
   try{
    const scope=local.getStore();check(scope);
    const env=readEnvironment();check(scope);
    // Validate only the supported standard Node24/on-demand runtime before
    // reading any credential field. No metadata/default-provider fallback.
    if(!env||typeof env!=='object'||env.AWS_REGION!==expected.region||env.AWS_EXECUTION_ENV!=='AWS_Lambda_nodejs24.x'||env.AWS_LAMBDA_FUNCTION_NAME!==expected.functionName||env.AWS_LAMBDA_FUNCTION_VERSION!==expected.version||env.AWS_LAMBDA_INITIALIZATION_TYPE!=='on-demand')throw fail();
    check(scope);
    const credentials={accessKeyId:env.AWS_ACCESS_KEY_ID,secretAccessKey:env.AWS_SECRET_ACCESS_KEY,sessionToken:env.AWS_SESSION_TOKEN};
    check(scope);return {context:scope.context,region:expected.region,credentials};
   }catch{throw fail();}
  },
  close(){closed=true;if(active){active.alive=false;active.controller.abort();}}
 });
}
