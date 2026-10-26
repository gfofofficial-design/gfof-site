import test from 'node:test';
import assert from 'node:assert/strict';
import {reportReviewRecord,reportReviewPage,reportReviewCommand} from '../assets/federation/fed-alliance-report-review-contract.mjs';
import {createAllianceReportReviewStore} from '../lib/alliance-avatar-server/report-review-store.mjs';
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const row=(n=1)=>({id:id(n),kind:'idea',target:id(20),contextState:'available',contextLoaded:false,targetTitle:null,targetSummary:null,createdAt:'2026-10-01T12:00:00.000Z',reviewedAt:null,disposition:'unreviewed',expiresAt:'2026-12-30T12:00:00.000Z'});
test('exact report contract excludes reporter identities and arbitrary text',()=>{
 assert.deepEqual(reportReviewRecord(row()),row());
 for(const extra of [{reporter:id(3)},{owner:id(3)},{detail:'private text'},{role:'owner'}])assert.throws(()=>reportReviewRecord({...row(),...extra}));
});
test('only an explicit selected read carries bounded target text, never challenge text',()=>{
 const r={...row(),contextLoaded:true,targetTitle:'Fictional chart labels',targetSummary:'Add an equivalent text summary for each chart.'};
 assert.equal(reportReviewRecord(r).targetTitle,r.targetTitle);assert.throws(()=>reportReviewPage({items:[r],next:null}));
 for(const patch of [{contextLoaded:false},{kind:'challenge'},{targetSummary:'x'.repeat(601)},{contextState:'removed'}])assert.throws(()=>reportReviewRecord({...r,...patch}));
});
test('expiry follows 90 elapsed days or 30 days after first review across daylight saving',()=>{
 const r={...row(),reviewedAt:'2026-10-25T09:00:00.000Z',disposition:'owner_follow_up',expiresAt:'2026-11-24T09:00:00.000Z'};
 assert.deepEqual(reportReviewRecord(r),r);
 for(const expiresAt of ['2026-11-24T10:00:00.000Z','2026-12-30T12:00:00.000Z'])assert.throws(()=>reportReviewRecord({...r,expiresAt}));
 assert.throws(()=>reportReviewRecord({...r,reviewedAt:'2026-09-25T09:00:00.000Z'}));
});
test('review states and timestamp pairs are strict',()=>{
 for(const patch of [{reviewedAt:'2026-10-25T09:00:00.000Z'},{disposition:'no_action'},{disposition:'resolved'},{contextState:'hidden'},{kind:'credentials'},{id:'0'.repeat(36)}])assert.throws(()=>reportReviewRecord({...row(),...patch}));
});
test('bounded pagination rejects duplicate, out-of-order and forged cursors',()=>{
 assert.deepEqual(reportReviewPage({items:[row(1),row(2)],next:id(2)},{limit:2}).items.length,2);
 for(const page of [{items:[row(1),row(1)],next:null},{items:[row(2),row(1)],next:null},{items:[row(1)],next:id(2)},{items:[row(1),row(2),row(3)],next:null}])assert.throws(()=>reportReviewPage(page,{limit:2}));
 assert.throws(()=>reportReviewPage({items:[row(1)],next:null},{after:id(2)}));
});
test('review command has explicit expected state and no arbitrary notes or clock',()=>{
 const command={id:id(1),expected:'unreviewed',disposition:'no_action'};assert.deepEqual(reportReviewCommand(command),command);
 for(const patch of [{expected:null},{disposition:'unreviewed'},{notes:'private'},{reviewedAt:'2026-10-25T00:00:00.000Z'},{owner:true}])assert.throws(()=>reportReviewCommand({...command,...patch}));
});
test('disabled store opens no pool and cannot load or review',async()=>{
 let calls=0;const s=await createAllianceReportReviewStore({openPool(){calls++;throw Error('not permitted');}});
 await assert.rejects(s.list(id(1),id(2)));await assert.rejects(s.review(id(1),id(2),{id:id(3),expected:'unreviewed',disposition:'no_action'}));await s.close();assert.equal(calls,0);
});
