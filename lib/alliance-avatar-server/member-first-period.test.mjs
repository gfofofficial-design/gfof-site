import test from 'node:test';
import assert from 'node:assert/strict';
import {syntheticFirstPeriodMemberEntry as fixture} from './member-first-period.fixture.mjs';
import {memberAwsFixedPeriodPolicyBundle as build,reviewMemberAwsFixedPeriodPolicyBundle as review,MEMBER_AWS_FIRST_PERIOD_MAX_MS} from './member-aws-first-period-policy.mjs';
import {createFirstPeriodMemberEntry as create,firstPeriodMemberEntrySource as source} from './member-first-period-entry.mjs';
const start=Date.parse('2026-10-24T12:00:00.000Z'),day=86400000,end=start+30*day-40000;
const inaccessible=new Proxy({},{get(){throw Error('request inspected');},ownKeys(){throw Error('request inspected');}});
function local(wall=start){
 const state={wall,mono:100,opens:0,closes:0,calls:0,timers:[]};
 const entry=create({configuration:fixture(),now:()=>state.wall,monotonic:()=>state.mono,schedule:(fn,ms)=>{const timer={fn,ms,unref(){}};state.timers.push(timer);return timer;},cancel:t=>{if(t)t.cancelled=true;},openRuntime:async options=>{state.opens++;state.options=options;return {handler:async()=>{state.calls++;return {statusCode:200};},close:async()=>{state.closes++;}};}});
 return {state,entry};
}
test('first-period policy is bounded by thirty days and caller expiry; every capability has fixed date fences',()=>{
 const c=fixture(),p=c.policyInput,b=build(p);assert.equal(MEMBER_AWS_FIRST_PERIOD_MAX_MS,30*day);assert.deepEqual(review({input:p,prepared:b}).matches,true);assert.deepEqual(b.identity,b.permissionsBoundary);assert.equal(b.renewal.automatic,false);assert.equal(Date.parse(b.renewal.latestEndUtc),Date.parse(b.renewal.callerNotAfterUtc)-37000);
 for(const statement of b.identity.Statement.filter(s=>s.Effect==='Allow')){assert.equal(statement.Condition.DateGreaterThanEquals['aws:CurrentTime'],p.window.notBeforeUtc);assert.equal(statement.Condition.DateLessThan['aws:CurrentTime'],p.window.notAfterUtc);}
 for(const change of [i=>i.window.notAfterUtc='2026-11-23T12:00:01.000Z',i=>i.installation.binding.callerKey.notAfterUtc='2026-11-23T11:59:50.000Z',i=>i.secrets.control.password='forbidden']){const x=fixture().policyInput;change(x);assert.throws(()=>build(x));}
 b.identity.Statement[0].Resource='*';assert.throws(()=>review({input:p,prepared:b}));
});
test('thirty-day entry uses bounded timers and survives past the platform timer maximum without renewing authority',async()=>{
 const {state,entry}=local();try{
  assert.equal((await entry.handler({},{})).statusCode,200);assert.equal(state.opens,1);assert.equal(state.timers[0].ms,day);
  state.wall+=25*day;state.mono+=25*day;state.timers[0].fn();assert.equal(state.timers.at(-1).ms,day);assert.equal((await entry.handler({},{})).statusCode,200);assert.equal(state.opens,1);
  assert.equal(state.options.installation.binding.callerKey.notAfterUtc,'2026-11-23T12:00:00.000Z');
  state.wall=end;state.mono=100+30*day;assert.equal((await entry.handler(inaccessible,inaccessible)).statusCode,503);
 }finally{await entry.close();}assert.equal(state.closes,1);assert.ok(state.timers.every(t=>t.ms<=day));
});
test('before-start and expired cold entries inspect no request or capability; expiry cannot reopen',async()=>{
 const early=local(start-1);assert.equal((await early.entry.handler(inaccessible,inaccessible)).statusCode,503);assert.equal(early.state.opens,0);early.state.wall=start;assert.equal((await early.entry.handler({},{})).statusCode,200);await early.entry.close();
 const late=local(end);assert.equal((await late.entry.handler(inaccessible,inaccessible)).statusCode,503);late.state.wall=start;assert.equal((await late.entry.handler(inaccessible,inaccessible)).statusCode,503);await late.entry.close();assert.equal(late.state.opens,0);
});
test('clock regression or policy/private-reference mismatch retires/refuses the entry',async()=>{
 const {state,entry}=local();assert.equal((await entry.handler({},{})).statusCode,200);state.mono--;assert.equal((await entry.handler(inaccessible,inaccessible)).statusCode,503);await entry.close();assert.equal(state.closes,1);
 for(const change of [c=>c.expectedPolicySha256='0'.repeat(64),c=>c.connectionSecrets.control.versionId='9'.repeat(32),c=>c.enabled=true]){const c=fixture();change(c);assert.throws(()=>create({configuration:c}));}
});
test('generated entry embeds only pinned public configuration and the handler; no activation or test overrides',()=>{
 const text=source(fixture());assert.match(text,/createFirstPeriodMemberEntry\(\{configuration\}\)/);assert.match(text,/export const handler=/);assert.equal(/process\.env|event\.enabled|openRuntime:|schedule:|password/.test(text),false);
});
