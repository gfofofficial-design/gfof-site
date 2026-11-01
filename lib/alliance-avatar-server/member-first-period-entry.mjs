// Explicitly dated first-period entry only. Trusted configuration comes from the
// packaged module, never an event, context, environment flag or resource lookup.
import {performance} from 'node:perf_hooks';
import {controlExact as exact} from './control-policy.mjs';
import {reviewMemberAwsFixedPeriodPolicyBundle} from './member-aws-first-period-policy.mjs';
import {reviewMemberConnectionSecrets} from './member-connection-secrets.mjs';
import {createAwsMemberAuthorityRuntime} from './member-aws-runtime.mjs';
const fail=()=>Error('alliance_member_first_period_entry_unavailable');
const unavailable=()=>({statusCode:503,isBase64Encoded:false,headers:{'content-type':'application/json','cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'},body:'{"state":"unavailable"}'});
const RESERVE_MS=6500,MAX_TIMER_MS=86400000;
export function reviewFirstPeriodMemberEntry(input){
 try{
  if(!exact(input,['policyInput','policy','connectionSecrets','expectedPolicySha256']))throw fail();
  const checked=reviewMemberAwsFixedPeriodPolicyBundle({input:input.policyInput,prepared:input.policy});
  if(checked.sha256!==input.expectedPolicySha256)throw fail();
  const value=structuredClone(input),p=value.policyInput;
  value.policyInput.trustRecordBytes=Buffer.from(p.trustRecordBytes);
  const c=reviewMemberConnectionSecrets({resource:p.installation.binding.resource,scope:p.installation.binding.scope,bindings:value.connectionSecrets});
  for(const purpose of ['control','journal']){
   if(c.bindings[purpose].secretArn!==p.secrets[purpose].secretArn||c.bindings[purpose].versionId!==p.secrets[purpose].versionId)throw fail();
  }
  return value;
 }catch{throw fail();}
}
// Test capabilities are constructor-only. Generated entry bytes supply no
// override and expose only handler; requests cannot select a factory or clock.
export function createFirstPeriodMemberEntry({configuration,openRuntime=createAwsMemberAuthorityRuntime,now=Date.now,monotonic=()=>performance.now(),schedule=setTimeout,cancel=clearTimeout}={}){
 let c;try{c=reviewFirstPeriodMemberEntry(configuration);if([openRuntime,now,monotonic,schedule,cancel].some(f=>typeof f!=='function'))throw fail();}catch{throw fail();}
 const start=Date.parse(c.policy.window.notBeforeUtc),end=Date.parse(c.policy.window.notAfterUtc);
 let closed=false,busy=false,pending,runtime,timer,deadline,lastWall,lastMono,closing;
 const close=()=>{
  if(closing)return closing;closed=true;cancel(timer);
  closing=Promise.resolve(pending).catch(()=>undefined).then(async r=>{try{await (r??runtime)?.close();}catch{}});
  return closing;
 };
 function remaining(){
  if(closed)throw fail();
  const wall=now(),mono=monotonic();
  if(!Number.isFinite(wall)||!Number.isFinite(mono)||mono<0||wall>=end||lastWall!==undefined&&(wall<lastWall||mono<lastMono)){void close();throw fail();}
  // A before-start call does not open clients or permanently consume the period.
  if(wall<start)return null;
  if(deadline===undefined)deadline=mono+Math.min(end-wall,end-start);
  lastWall=wall;lastMono=mono;
  const left=Math.min(end-wall,deadline-mono);
  if(left<=0){void close();throw fail();}return left;
 }
 function arm(left){
  timer=schedule(()=>{
   if(closed)return;
   try{const next=remaining();if(next===null){void close();return;}arm(next);}catch{void close();}
  },Math.min(left,MAX_TIMER_MS));timer?.unref?.();
 }
 return Object.freeze({
  async handler(event,context){
   // Admission checks precede even reading the event/context or opening a client.
   if(closed||busy)return unavailable();busy=true;
   try{
    const left=remaining();if(left===null||left<RESERVE_MS)return unavailable();
    if(!pending){
     arm(left);
     pending=Promise.resolve().then(()=>{
      remaining();return openRuntime({enabled:true,installation:c.policyInput.installation,trustRecordBytes:c.policyInput.trustRecordBytes,
       expectedTrust:c.policyInput.expectedTrust,connectionSecrets:c.connectionSecrets});
     });
    }
    runtime=await pending;remaining();
    const result=await runtime.handler(event,context);remaining();return result;
   }catch{void close();return unavailable();}
   finally{busy=false;}
  },close
 });
}
// Called by an offline packager only. Public configuration and an independent
// reviewed digest are embedded as code literals; no plaintext credential fits.
export function firstPeriodMemberEntrySource(configuration){
 const c=reviewFirstPeriodMemberEntry(configuration),bytes=c.policyInput.trustRecordBytes;
 delete c.policyInput.trustRecordBytes;
 return `// Fixed reviewed first period; no event/environment activation or discovery.\nimport {createFirstPeriodMemberEntry} from './lib/alliance-avatar-server/member-first-period-entry.mjs';\nconst configuration=${JSON.stringify(c)};\nconfiguration.policyInput.trustRecordBytes=Buffer.from(${JSON.stringify(bytes.toString('base64'))},'base64');\nconst entry=createFirstPeriodMemberEntry({configuration});\nexport const handler=(event,context)=>entry.handler(event,context);\n`;
}
