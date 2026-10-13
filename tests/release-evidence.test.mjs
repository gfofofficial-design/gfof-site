import test from 'node:test';import assert from 'node:assert/strict';
import {buildReleaseFreshnessBrief} from '../lib/release-evidence-core.mjs';
import {spawnSync} from 'node:child_process';
const now=Date.parse('2026-10-13T18:00:00Z');
const sites=[['command','e0aa8628-b13e-4ed3-a0aa-e8aff507454c'],['dossier','012c79b9-9561-4503-b1f2-e8ca2a34732c']];
function input(){return {schema:1,checkedAt:new Date(now).toISOString(),expected:sites.map(([site,siteId])=>({site,siteId,commit:'a'.repeat(40)})),deploys:sites.map(([site,siteId])=>({site,siteId,deployId:'b'.repeat(24),commit:'a'.repeat(40),state:'ready',context:'production',branch:'main',publishedAt:new Date(now-1000).toISOString()}))};}
test('published production commits match independently supplied expectations',()=>{
 const r=buildReleaseFreshnessBrief(input(),{now});assert.equal(r.status,'expected_commits_observed');assert.deepEqual(r.tasks,[]);
 assert.equal(r.approvalEvidence,'operator_supplied_not_verified');assert.match(r.checks[0].commitEvidenceUrl,/github.com\/gfofofficial-design\/gfof-site\/commit\//);
});
test('mismatch becomes review task without outage or release-order inference',()=>{
 const i=input();i.deploys[0].commit='c'.repeat(40);i.deploys[0].error='private diagnostic';
 const r=buildReleaseFreshnessBrief(i,{now});assert.equal(r.status,'review_needed');assert.equal(r.tasks[0].reason,'unexpected_commit');assert.ok(!JSON.stringify(r).includes('private diagnostic'));
});
test('preview or unpublished deploy never satisfies production acceptance',()=>{
 for(const change of [{context:'deploy-preview'},{state:'building'},{publishedAt:null},{branch:'review/test'}]){
  const i=input();Object.assign(i.deploys[0],change);assert.equal(buildReleaseFreshnessBrief(i,{now}).checks[0].reason,'not_published_production');
 }
});
test('missing, stale and unknown-commit evidence stays explicit',()=>{
 const i=input();i.deploys=[];assert.equal(buildReleaseFreshnessBrief(i,{now}).checks[0].reason,'missing_published_evidence');
 assert.equal(buildReleaseFreshnessBrief(input(),{now:now+900001}).checks[0].reason,'stale_evidence');
 const n=input();n.deploys[0].commit=null;assert.equal(buildReleaseFreshnessBrief(n,{now}).checks[0].reason,'commit_unavailable');
});
test('wrong targets, duplicate rows, bad dates and invalid commits refuse',()=>{
 for(const mutate of [i=>i.deploys[0].siteId='wrong',i=>i.deploys[1]=i.deploys[0],i=>i.expected[1]=i.expected[0],i=>i.expected[0].commit='main',i=>i.checkedAt='tomorrow',i=>i.deploys[0].publishedAt=new Date(now+1).toISOString()]){
  const i=input();mutate(i);assert.throws(()=>buildReleaseFreshnessBrief(i,{now}),/Invalid release evidence/);
 }
 assert.throws(()=>buildReleaseFreshnessBrief(input(),{now:now-1}),/Invalid release evidence/);
});
test('CLI accepts a fresh reviewed snapshot without network access',()=>{
 const i=input();i.checkedAt=new Date().toISOString();i.deploys.forEach(d=>{d.publishedAt=i.checkedAt;});
 const r=spawnSync(process.execPath,['scripts/check-release-evidence.mjs'],{input:JSON.stringify(i),encoding:'utf8'});
 assert.equal(r.status,0);assert.equal(JSON.parse(r.stdout).status,'expected_commits_observed');
});
test('CLI rejects oversized and malformed input without echoing diagnostics',()=>{
 for(const input of ['private-example-invalid-json','x'.repeat(32769),Buffer.from([0xff])]){
  const r=spawnSync(process.execPath,['scripts/check-release-evidence.mjs'],{input,encoding:'utf8'});
  assert.equal(r.status,2);assert.equal(r.stdout,'');assert.equal(r.stderr,'Release evidence unavailable or invalid.\n');
 }
});
