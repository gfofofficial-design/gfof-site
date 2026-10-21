import test from 'node:test';
import assert from 'node:assert/strict';
import {gatewayAwsPolicyBundle as baseline} from './gateway-aws-policy.mjs';
import {gatewayAwsTrialPolicyBundle as build,reviewGatewayAwsTrialPolicyBundle as review,GATEWAY_AWS_TRIAL_MAX_MS} from './gateway-aws-trial-policy.mjs';

// Fictional resources and fixed dates; no account state, environment or keys.
const configuration=()=>({gateway:{apiId:'abcdefghij',stage:'preview'},bridge:{accountId:'123456789012',region:'us-east-2',functionName:'alliance-account-gateway-synthetic',version:'3'},authority:{accountId:'123456789012',region:'us-east-2',functionName:'alliance-account-authority-synthetic',version:'7'},nonce:{tableName:'alliance-account-nonce-synthetic',tableId:'11111111-2222-3333-4444-555555555555',epoch:'22222222-3333-4444-5555-666666666666'},root:{tableName:'alliance-account-authority-synthetic',tableId:'33333333-4444-5555-6666-777777777777',rootKey:'c'.repeat(64),custodyId:'d'.repeat(64)},roles:{gateway:'alliance-account-gateway-role-synthetic',authority:'alliance-account-authority-role-synthetic'},callerKeyId:'a'.repeat(64)});
const input=()=>({configuration:configuration(),window:{notBeforeUtc:'2030-01-01T00:00:00.000Z',notAfterUtc:'2030-01-01T00:10:00.000Z'}});
const names=['gatewayIdentity','authorityIdentity','gatewayBoundary','authorityBoundary'];
const error=/^Error: alliance_gateway_trial_policy_unavailable$/;

test('finite policy preserves every original permission and adds the same half-open window to all four documents',()=>{
 const i=input(),before=structuredClone(i),p=build(i),base=baseline(i.configuration);
 assert.deepEqual(i,before);assert.equal(GATEWAY_AWS_TRIAL_MAX_MS,600000);
 for(const name of names){
  const allows=p.bundle[name].Statement.filter(s=>s.Effect==='Allow');
  assert.equal(allows.length,base[name].Statement.length);
  for(const [index,statement] of allows.entries()){
   const copy=structuredClone(statement);
   assert.deepEqual(copy.Condition.DateGreaterThanEquals,{'aws:CurrentTime':i.window.notBeforeUtc});
   assert.deepEqual(copy.Condition.DateLessThan,{'aws:CurrentTime':i.window.notAfterUtc});
   delete copy.Condition.DateGreaterThanEquals;delete copy.Condition.DateLessThan;
   assert.deepEqual(copy,base[name].Statement[index]);
  }
 }
 for(const name of Object.keys(base).filter(k=>!names.includes(k)))assert.deepEqual(p.bundle[name],base[name]);
 assert.deepEqual(p.bundle.gatewayBoundary,p.bundle.gatewayIdentity);
 assert.deepEqual(p.bundle.authorityBoundary,p.bundle.authorityIdentity);
 assert.equal(p.purpose,'finite-trial-policy-review-only');
});

test('each identity and boundary explicitly denies early, expired and missing-clock requests without IfExists',()=>{
 const i=input(),p=build(i);
 for(const name of names){
  const denials=p.bundle[name].Statement.filter(s=>s.Effect==='Deny');
  assert.deepEqual(denials,[
   {Sid:'TrialNotStarted',Effect:'Deny',Action:'*',Resource:'*',Condition:{DateLessThan:{'aws:CurrentTime':i.window.notBeforeUtc}}},
   {Sid:'TrialExpired',Effect:'Deny',Action:'*',Resource:'*',Condition:{DateGreaterThanEquals:{'aws:CurrentTime':i.window.notAfterUtc}}},
   {Sid:'TrialTimeRequired',Effect:'Deny',Action:'*',Resource:'*',Condition:{Null:{'aws:CurrentTime':'true'}}},
  ]);
  assert.equal(JSON.stringify(p.bundle[name]).includes('IfExists'),false);
 }
});

test('date conditions have no gap at the start or end, and missing time cannot match an allow',()=>{
 // Small condition characterization, not an AWS IAM evaluator/simulator.
 const i=input(),p=build(i),start=Date.parse(i.window.notBeforeUtc),end=Date.parse(i.window.notAfterUtc);
 const matches=(condition,now)=>Object.entries(condition).every(([operator,keys])=>Object.entries(keys).every(([key,value])=>{
  assert.equal(key,'aws:CurrentTime');
  if(operator==='Null')return (now===undefined)===(value==='true');
  if(now===undefined)return false;
  const target=Date.parse(value);
  if(operator==='DateLessThan')return now<target;
  if(operator==='DateGreaterThanEquals')return now>=target;
  throw Error('unsupported fixture operator');
 }));
 for(const name of names){
  const statements=p.bundle[name].Statement;
  const allow=statements.find(s=>s.Effect==='Allow');
  const timeAllow={DateGreaterThanEquals:allow.Condition.DateGreaterThanEquals,DateLessThan:allow.Condition.DateLessThan};
  for(const [now,expected] of [[undefined,false],[start-1,false],[start,true],[start+1,true],[end-1,true],[end,false],[end+1,false]]){
   assert.equal(matches(timeAllow,now),expected);
   assert.equal(statements.some(s=>s.Effect==='Deny'&&matches(s.Condition,now)),!expected);
  }
 }
});

test('noncanonical and impossible timestamps, reversed, empty and excessive windows refuse',()=>{
 for(const value of [null,0,'2030-01-01','2030-01-01T00:00:00Z','2030-01-01T00:00:00+00:00','2030-01-01T00:00:00.001Z','2030-02-30T00:00:00.000Z','not-public-secret']){
  const i=input();i.window.notBeforeUtc=value;assert.throws(()=>build(i),error);
 }
 for(const end of ['2030-01-01T00:00:00.000Z','2029-12-31T23:59:59.000Z','2030-01-01T00:10:01.000Z']){
  const i=input();i.window.notAfterUtc=end;assert.throws(()=>build(i),error);
 }
 const i=input();i.window.notAfterUtc='2030-01-01T00:00:01.000Z';assert.doesNotThrow(()=>build(i));
});

test('unknown fields, unsupported policy resources and default/missing input cannot create a proposal',()=>{
 for(const patch of [i=>{i.extra=true;},i=>{i.window.extra=true;},i=>{delete i.window;},i=>{i.configuration.authority.version='$LATEST';},i=>{i.configuration.root.rootKey='*';},i=>{i.configuration.bridge.region='us-west-2';}]){
  const i=input();patch(i);assert.throws(()=>build(i),error);
 }
 for(const i of [undefined,null,{},false])assert.throws(()=>build(i),error);
});

test('reviewer refuses lost or weakened expiry, widened permissions and substitutions in every document',()=>{
 const i=input();
 for(const name of names)for(const change of [
  p=>{delete p.bundle[name].Statement[0].Condition.DateLessThan;},
  p=>{p.bundle[name].Statement[0].Condition.DateLessThan={'aws:CurrentTime':'2030-01-01T00:11:00.000Z'};},
  p=>{p.bundle[name].Statement[0].Resource='*';},
  p=>{p.bundle[name].Statement=p.bundle[name].Statement.filter(s=>s.Sid!=='TrialExpired');},
  p=>{p.bundle[name].Statement.find(s=>s.Sid==='TrialTimeRequired').Effect='Allow';},
  p=>{p.bundle[name].Statement.push({Effect:'Allow',Action:'*',Resource:'*'});},
 ]){const prepared=build(i);change(prepared);assert.throws(()=>review({input:i,prepared}),error);}
});

test('review binds exact window, original resource-policy/trust artifacts and stable public digest',()=>{
 const i=input(),prepared=build(i),r=review({input:i,prepared});assert.match(r.sha256,/^[a-f0-9]{64}$/);
 assert.deepEqual(review({input:i,prepared:structuredClone(prepared)}),r);
 const reordered=Object.fromEntries(Object.entries(prepared).reverse());
 assert.deepEqual(review({input:i,prepared:reordered}),r,'equivalent artifact field order must not change the reviewed digest');
 for(const patch of [p=>{p.window.notAfterUtc='2030-01-01T00:11:00.000Z';},p=>{p.bundle.gatewayResourcePolicy.Statement[0].Principal='*';},p=>{p.bundle.gatewayExecutionTrust.Statement[0].Principal={AWS:'*'};},p=>{p.extra=true;}]){
  const p=structuredClone(prepared);patch(p);assert.throws(()=>review({input:i,prepared:p}),error);
 }
 const changed=input();changed.window.notAfterUtc='2030-01-01T00:09:00.000Z';assert.throws(()=>review({input:changed,prepared}),error);
 assert.throws(()=>review({input:i,prepared:{detail:'x'.repeat(30001)}}),error);
 assert.throws(()=>review(),error);
});

test('offline proposals do not claim freshness and cannot modify another proposal or the baseline',()=>{
 const i=input(),base=baseline(i.configuration),one=build(i),two=build(i);
 one.bundle.gatewayIdentity.Statement[0].Condition.DateLessThan['aws:CurrentTime']='2040-01-01T00:00:00.000Z';
 assert.deepEqual(two,build(i));assert.deepEqual(base,baseline(i.configuration));
 assert.equal(Object.hasOwn(two,'installed'),false);assert.equal(Object.hasOwn(two,'fresh'),false);
 const past=input();past.window={notBeforeUtc:'2020-01-01T00:00:00.000Z',notAfterUtc:'2020-01-01T00:01:00.000Z'};
 assert.equal(review({input:past,prepared:build(past)}).matches,true);
});
