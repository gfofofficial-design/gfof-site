// Fictional checkpoint/policy metadata only. Never used by installed runtime.
import {randomUUID} from 'node:crypto';
import {feedbackRecoveryFixture} from '../lib/alliance-avatar-server/feedback-recovery.fixture.mjs';
import {controlPolicySha256} from '../lib/alliance-avatar-server/control-policy.mjs';
import {reportReviewCheckpointSha256} from '../lib/alliance-avatar-server/report-review-recovery.mjs';
export function ingressCheckpoint(){
 const f=feedbackRecoveryFixture();f.gate.close();
 return {...f.checkpoint,format:5,reportReview:{format:1,closed:true,expiredReports:0,tables:[{table:'alliance_report_review.control',rows:1,sha256:'a'.repeat(64)},{table:'alliance_report_review.reviews',rows:0,sha256:'0'.repeat(64)}]}};
}
export function ingressPolicy(cp,overrides={}){
 const value={format:1,memberProjectRef:cp.memberProjectRef,journalProjectRef:cp.journalProjectRef,epoch:cp.epoch,state:'serve',revision:20,changeId:randomUUID(),freezeId:cp.freezeId,frozenAt:cp.capturedAt,checkpointSha256:reportReviewCheckpointSha256(cp),floor:{sequence:cp.journal.sequence,sha256:cp.journal.sha256},...overrides};
 // The import is public metadata hashing, with no provider or private input.
 return {...value,sha256:controlPolicySha256(value)};
}
