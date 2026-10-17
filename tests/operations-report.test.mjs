import test from 'node:test';import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {runOperationsReport} from '../scripts/federation-operations-report.mjs';
const at=Date.parse('2026-10-14T13:20:00.000Z');
function release(){return {schema:1,checkedAt:new Date(at).toISOString(),
 expected:[{site:'command',siteId:'e0aa8628-b13e-4ed3-a0aa-e8aff507454c',commit:'a'.repeat(40)},{site:'dossier',siteId:'012c79b9-9561-4503-b1f2-e8ca2a34732c',commit:'b'.repeat(40)}],
 deploys:[['command','e0aa8628-b13e-4ed3-a0aa-e8aff507454c','a'],['dossier','012c79b9-9561-4503-b1f2-e8ca2a34732c','b']].map(([site,siteId,c])=>({site,siteId,deployId:'1'.repeat(24),commit:c.repeat(40),state:'ready',context:'production',branch:'main',publishedAt:new Date(at-1000).toISOString()}))};}
function pages(){return {schema:1,scope:'public_homepage_availability_and_command_deck_links',checkedAt:new Date(at).toISOString(),securityVerdict:'not_assessed',accountAcceptance:'not_assessed',healthy:true,
 results:[['command','https://galacticfederation.co/'],['dossier','https://dossiertrack.co/'],['fcc','https://fcc.galacticfederation.co/']].map(([id,url])=>({id,url,status:200,dashboardLink:true,reason:'ok',healthy:true}))};}
function tools(){return {schema:1,scope:'public_tool_page_delivery',checkedAt:new Date(at).toISOString(),securityVerdict:'not_assessed',accountAcceptance:'not_assessed',healthy:true,
 results:[['command-deck','command','https://galacticfederation.co/command-deck'],['alliance','command','https://galacticfederation.co/alliance'],['journey','command','https://galacticfederation.co/journey/'],['staking','command','https://galacticfederation.co/staking'],['building','command','https://galacticfederation.co/building'],['treasury','command','https://galacticfederation.co/treasury'],['lens','dossier','https://dossiertrack.co/token-structure'],['gfof-evidence','dossier','https://dossiertrack.co/projects/gfof']].map(([id,site,url])=>({id,site,url,status:200,titleMatches:true,reason:'ok',healthy:true}))};}
test('one manual check combines passing scopes without a security verdict or raw input',async()=>{
 let calls=0,toolCalls=0;const input=release();input.raw='private-fixture-detail';const check=pages();check.raw='private-fixture-detail';const toolCheck=tools();toolCheck.raw='private-fixture-detail';
 const report=await runOperationsReport(input,{toolsChecker:async()=>{toolCalls++;return toolCheck;},checker:async()=>{calls++;return check;},now:()=>at});
 assert.equal(calls,1);assert.equal(toolCalls,1);assert.equal(report.status,'checked_scope_ok');assert.deepEqual(report.tasks,[]);
 assert.equal(report.toolPages.status,'checked_tool_pages_ok');assert.equal(report.toolPages.checks.length,8);
 assert.equal(report.releases.approvalEvidence,'operator_supplied_not_verified');assert.ok(!JSON.stringify(report).includes('private-fixture-detail'));
 assert.ok(report.limitations.some(x=>x.includes('Safe Browsing')));
});
test('invalid release binding rejects before either checker runs',async()=>{
 let calls=0;const input=release();input.expected[0].siteId='wrong';
 await assert.rejects(runOperationsReport(input,{toolsChecker:async()=>{calls++;return tools();},checker:async()=>{calls++;return pages();},now:()=>at}),/Invalid release evidence/);assert.equal(calls,0);
});
for(const tool of ['lens','gfof-evidence'])test(`a failed ${tool} route prevents a passing report even when homepages and releases pass`,async()=>{
 const t=tools();t.healthy=false;const index=t.results.findIndex(row=>row.id===tool);t.results[index]={...t.results[index],status:404,titleMatches:false,healthy:false,reason:'unexpected_status',body:'private fixture'};
 const report=await runOperationsReport(release(),{toolsChecker:async()=>t,checker:async()=>pages(),now:()=>at});
 assert.equal(report.status,'review_needed');assert.equal(report.pages.status,'checked_pages_ok');assert.equal(report.releases.status,'expected_commits_observed');
 assert.deepEqual(report.tasks.map(x=>[x.priority,x.source,x.tool]),[['P1','public_tool_page_check',tool]]);assert.ok(!JSON.stringify(report).includes('private fixture'));
});
test('malformed tool evidence cannot become a release success',async()=>{
 const t=tools();t.results[0].url='https://unapproved.invalid/';
 await assert.rejects(runOperationsReport(release(),{toolsChecker:async()=>t,checker:async()=>pages(),now:()=>at}),/Invalid tool-page evidence/);
});
test('availability investigations precede release mismatches',async()=>{
 const input=release();input.deploys[0].commit='c'.repeat(40);const check=pages();check.healthy=false;
 check.results[1]={...check.results[1],status:503,reason:'unexpected_status',healthy:false,dashboardLink:false};
 const report=await runOperationsReport(input,{toolsChecker:async()=>tools(),checker:async()=>check,now:()=>at});
 assert.equal(report.status,'review_needed');assert.deepEqual(report.tasks.map(x=>[x.priority,x.source]),[['P1','public_page_check'],['P2','release_comparison']]);
});
test('freshness is re-evaluated after the checker finishes',async()=>{
 let ticks=0;const report=await runOperationsReport(release(),{toolsChecker:async()=>tools(),checker:async()=>pages(),now:()=>ticks++===0?at:at+900001});
 assert.equal(report.status,'review_needed');assert.equal(report.pages.status,'stale_check');assert.equal(report.releases.status,'review_needed');assert.equal(report.tasks.length,4);
});
test('CLI refuses invalid UTF-8 and oversized evidence before any requests',()=>{
 for(const input of [Buffer.from([255]),Buffer.alloc(32769,32)]){
  const r=spawnSync(process.execPath,[new URL('../scripts/federation-operations-report.mjs',import.meta.url).pathname],{input,timeout:2000});
  assert.equal(r.status,2);assert.equal(r.stdout.length,0);assert.equal(r.stderr.toString(),'Operations report evidence unavailable or invalid.\n');
 }
});
test('caller mutation cannot replace the reviewed release expectation during the check',async()=>{
 const input=release();input.deploys[0].commit='c'.repeat(40);
 const report=await runOperationsReport(input,{toolsChecker:async()=>tools(),checker:async()=>{input.expected[0].commit='c'.repeat(40);return pages();},now:()=>at});
 assert.equal(report.status,'review_needed');assert.equal(report.releases.checks[0].expectedCommit,'a'.repeat(40));
});
