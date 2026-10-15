import test from 'node:test';import assert from 'node:assert/strict';
import {buildOperationsBrief} from '../lib/operations-brief-core.mjs';
import {runOperationsBrief} from '../scripts/federation-operations-brief.mjs';
const now=Date.parse('2026-10-13T18:00:00Z');
function sample(){return {schema:1,scope:'public_homepage_availability_and_command_deck_links',checkedAt:new Date(now).toISOString(),securityVerdict:'not_assessed',accountAcceptance:'not_assessed',healthy:true,results:[['command','https://galacticfederation.co/'],['dossier','https://dossiertrack.co/'],['fcc','https://fcc.galacticfederation.co/']].map(([id,url])=>({id,url,status:200,dashboardLink:true,reason:'ok',healthy:true}))};}
test('healthy pages never become a security or full-service verdict',()=>{
 const result=buildOperationsBrief(sample(),{now});assert.equal(result.status,'checked_pages_ok');assert.deepEqual(result.repairs,[]);
 assert.ok(result.limitations.some(x=>x.includes('Safe Browsing')));assert.equal(result.evidenceStatus,'supplied_check_not_authenticated');
});
test('repair queue puts availability before navigation with bounded evidence',()=>{
 const s=sample();s.healthy=false;s.results[0]={...s.results[0],reason:'dashboard_link_missing',healthy:false,dashboardLink:false};
 s.results[1]={...s.results[1],status:503,reason:'unexpected_status',healthy:false,dashboardLink:false,body:'private diagnostic'};
 const r=buildOperationsBrief(s,{now});assert.deepEqual(r.repairs.map(x=>x.priority),['P1','P2']);assert.equal(r.repairs[0].site,'dossier');assert.ok(!JSON.stringify(r).includes('private diagnostic'));
});
test('stale evidence requires a new check instead of a current repair verdict',()=>{
 const s=sample();const r=buildOperationsBrief(s,{now:now+900001});assert.equal(r.status,'stale_check');assert.deepEqual(r.repairs,[]);
 assert.throws(()=>buildOperationsBrief(s,{now:now-1}),/Invalid operations evidence/);
});
test('unknown targets, duplicate evidence and inconsistent results are rejected',()=>{
 for(const mutate of [s=>s.results[0].url='https://evil.invalid/',s=>s.results[1]=s.results[0],s=>s.results[0].reason='custom private message',s=>s.results[0].healthy=false,s=>s.healthy=false,s=>s.results[0].status=503,s=>s.securityVerdict='safe']){
  const s=sample();mutate(s);assert.throws(()=>buildOperationsBrief(s,{now}),/Invalid operations evidence/);
 }
});
test('runner calls the finite checker once and performs no repair',async()=>{
 let calls=0;const r=await runOperationsBrief({checker:async()=>{calls++;return sample();},now:()=>now});assert.equal(calls,1);assert.equal(r.status,'checked_pages_ok');
});
