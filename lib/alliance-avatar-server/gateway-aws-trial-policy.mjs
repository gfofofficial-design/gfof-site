// Offline proposal only: no clock, SDK, installer, credentials or live handler.
import {createHash} from 'node:crypto';
import {isDeepStrictEqual as same} from 'node:util';
import {controlExact as exact} from './control-policy.mjs';
import {gatewayAwsPolicyBundle} from './gateway-aws-policy.mjs';

const fail=()=>Error('alliance_gateway_trial_policy_unavailable');
export const GATEWAY_AWS_TRIAL_MAX_MS=600000;
const policyNames=['gatewayIdentity','authorityIdentity','gatewayBoundary','authorityBoundary'];
function timestamp(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/.test(value))throw fail();
 const ms=Date.parse(value);if(!Number.isFinite(ms)||new Date(ms).toISOString()!==value)throw fail();return ms;
}
function build(input){
 if(!exact(input,['configuration','window'])||!exact(input.window,['notBeforeUtc','notAfterUtc']))throw fail();
 const start=timestamp(input.window.notBeforeUtc),end=timestamp(input.window.notAfterUtc);
 if(end<=start||end-start>GATEWAY_AWS_TRIAL_MAX_MS)throw fail();
 const window={notBeforeUtc:input.window.notBeforeUtc,notAfterUtc:input.window.notAfterUtc};
 const bundle=gatewayAwsPolicyBundle(input.configuration);
 for(const name of policyNames){
  const policy=bundle[name];
  for(const statement of policy.Statement){
   statement.Condition.DateGreaterThanEquals={'aws:CurrentTime':window.notBeforeUtc};
   statement.Condition.DateLessThan={'aws:CurrentTime':window.notAfterUtc};
  }
  // Explicit denials also constrain other grants to these same principals.
  // Actual policy installation/evaluation and old-producer exclusion are separate.
  policy.Statement.push(
   {Sid:'TrialNotStarted',Effect:'Deny',Action:'*',Resource:'*',Condition:{DateLessThan:{'aws:CurrentTime':window.notBeforeUtc}}},
   {Sid:'TrialExpired',Effect:'Deny',Action:'*',Resource:'*',Condition:{DateGreaterThanEquals:{'aws:CurrentTime':window.notAfterUtc}}},
   {Sid:'TrialTimeRequired',Effect:'Deny',Action:'*',Resource:'*',Condition:{Null:{'aws:CurrentTime':'true'}}},
  );
 }
 return {format:1,purpose:'finite-trial-policy-review-only',window,bundle};
}
export function gatewayAwsTrialPolicyBundle(input){try{return build(input);}catch{throw fail();}}
// Byte/artifact agreement only. Does not establish freshness or installed IAM.
export function reviewGatewayAwsTrialPolicyBundle({input,prepared}={}){
 try{
  const expected=build(input);
  if(Buffer.byteLength(JSON.stringify(prepared))>30000||!same(prepared,expected))throw fail();
  return {matches:true,sha256:createHash('sha256').update(JSON.stringify(expected)).digest('hex')};
 }catch{throw fail();}
}
