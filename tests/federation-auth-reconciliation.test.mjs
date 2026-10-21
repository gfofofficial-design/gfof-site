import test from 'node:test';
import assert from 'node:assert/strict';
import { planAuthReconciliation } from '../scripts/plan-federation-auth-reconciliation.mjs';

// Fictional identifiers only; no project, user, credential or hosted connection.
const SOURCE = 's'.repeat(20), TARGET = 't'.repeat(20);
const KEEP = '10000000-0000-4000-8000-000000000001';
const REMOVE = '10000000-0000-4000-8000-000000000002';
const ABSENT = '10000000-0000-4000-8000-000000000003';
const IDENTITY = '20000000-0000-4000-8000-000000000001';
function entry(userId = REMOVE, caseRef = 'synthetic-case-1') {
  return { projectRef: SOURCE, caseRef, userId, recordedAtUtc: '2026-10-10T03:00:00Z', outcome: 'confirmed_deleted' };
}
function fixture() {
  return {
    schemaVersion: 1, sourceProjectRef: SOURCE, targetProjectRef: TARGET,
    backup: { projectRef: SOURCE, capturedAtUtc: '2026-10-10T01:00:00Z', archiveSha256: 'a'.repeat(64) },
    inventory: { projectRef: TARGET, observedAtUtc: '2026-10-11T01:00:00Z', users: [{ id: KEEP }, { id: REMOVE }],
      identities: [{ id: IDENTITY, userId: REMOVE }], sessionRows: 0, refreshTokenRows: 0 },
    ledger: { projectRef: SOURCE, completeThroughUtc: '2026-10-11T01:00:00Z', entries: [entry()] },
    isolation: { signupClosed: true, outboundDeliveryClosed: true, productionConnected: false },
  };
}

test('plans exact deleted UUID and linked identities while retaining the other user', () => {
  const input = fixture(), before = JSON.stringify(input);
  const result = planAuthReconciliation(input);
  assert.equal(result.status, 'reviewable_removal_plan');
  assert.deepEqual(result.removals, [{ userId: REMOVE, identityIds: [IDENTITY] }]);
  assert.equal(result.counts.candidateUsers, 1); assert.equal(result.counts.candidateIdentities, 1);
  assert.equal(JSON.stringify(input), before);
});
test('already-absent deletion and identical duplicates remain idempotent', () => {
  const input = fixture(); input.ledger.entries.push(entry(), entry(REMOVE, 'synthetic-case-2'), entry(ABSENT, 'synthetic-case-3'));
  const result = planAuthReconciliation(input);
  assert.equal(result.counts.candidateUsers, 1); assert.equal(result.counts.confirmedDeletedUsers, 2);
  assert.equal(result.counts.alreadyAbsentUsers, 1);
  input.inventory.users = [{ id: KEEP }]; input.inventory.identities = [];
  assert.equal(planAuthReconciliation(input).status, 'reviewable_no_removal');
});
test('source target confusion and foreign ledger entries are refused', () => {
  for (const mutate of [x => { x.targetProjectRef = SOURCE; }, x => { x.inventory.projectRef = SOURCE; },
    x => { x.backup.projectRef = TARGET; }, x => { x.ledger.projectRef = TARGET; }, x => { x.ledger.entries[0].projectRef = TARGET; }]) {
    const input = fixture(); mutate(input); assert.throws(() => planAuthReconciliation(input), /source_is_restore_target|project_binding_mismatch|ledger_project_mismatch/);
  }
});
test('unverified or failed deletions and ambiguous case identity block a plan', () => {
  for (const outcome of ['pending', 'failed']) {
    const input = fixture(); input.ledger.entries[0].outcome = outcome;
    assert.deepEqual(planAuthReconciliation(input), { status: 'blocked', reasons: ['unresolved_deletion_case'], removals: [] });
  }
  const input = fixture(); input.ledger.entries.push(entry(KEEP));
  assert.throws(() => planAuthReconciliation(input), /conflicting_case_ref/);
});
test('open signup, delivery or production connection block even an otherwise valid plan', () => {
  for (const [field, value] of [['signupClosed', false], ['outboundDeliveryClosed', false], ['productionConnected', true]]) {
    const input = fixture(); input.isolation[field] = value;
    assert.deepEqual(planAuthReconciliation(input), { status: 'blocked', reasons: ['restore_not_isolated'], removals: [] });
  }
});
test('old sessions, orphan identities and duplicate inventory IDs cannot slip through', () => {
  for (const field of ['sessionRows', 'refreshTokenRows']) {
    const input = fixture(); input.inventory[field] = 1;
    assert.deepEqual(planAuthReconciliation(input).reasons, ['restored_session_rows_present']);
  }
  const orphan = fixture(); orphan.inventory.identities[0].userId = ABSENT;
  assert.deepEqual(planAuthReconciliation(orphan).reasons, ['orphan_identity']);
  const duplicate = fixture(); duplicate.inventory.users.push({ id: REMOVE });
  assert.throws(() => planAuthReconciliation(duplicate), /duplicate_user_id/);
  const identityDuplicate = fixture(); identityDuplicate.inventory.identities.push({ id: IDENTITY, userId: KEEP });
  assert.throws(() => planAuthReconciliation(identityDuplicate), /duplicate_identity_id/);
});
test('stale coverage, future rows and a pre-backup deleted account require review', () => {
  const stale = fixture(); stale.ledger.completeThroughUtc = '2026-10-10T04:00:00Z';
  assert.deepEqual(planAuthReconciliation(stale).reasons, ['ledger_coverage_stale']);
  const future = fixture(); future.ledger.entries[0].recordedAtUtc = '2026-10-12T00:00:00Z';
  assert.throws(() => planAuthReconciliation(future), /ledger_entry_after_cutoff/);
  const before = fixture(); before.ledger.entries[0].recordedAtUtc = '2026-10-10T00:00:00Z';
  assert.deepEqual(planAuthReconciliation(before), { status: 'blocked', reasons: ['pre_backup_deletion_present'], removals: [] });
});
test('raw Auth fields, credentials, approximate identifiers and invalid dates are refused without echoes', () => {
  for (const mutate of [x => { x.inventory.users[0].email = 'synthetic@example.invalid'; },
    x => { x.inventory.users[0].encrypted_password = 'synthetic-secret'; },
    x => { x.ledger.entries[0].userId = 'synthetic@example.invalid'; },
    x => { x.ledger.entries[0].recordedAtUtc = '2026-02-30T00:00:00Z'; },
    x => { x.ledger.entries[0].caseRef = 'synthetic@example.invalid'; },
    x => { x.inventory.observedAtUtc = '2026-10-11T01:00:00-05:00'; }]) {
    const input = fixture(); mutate(input);
    assert.throws(() => planAuthReconciliation(input), error => !/synthetic@example|synthetic-secret/.test(error.message));
  }
});
test('bounded input, typed attestations and malformed records fail before planning', () => {
  for (const mutate of [x => { x.inventory.users = Array(10001).fill({ id: KEEP }); }, x => { x.isolation.signupClosed = 'true'; },
    x => { x.inventory.sessionRows = -1; }, x => { x.ledger.entries[0].outcome = 'unverified'; },
    x => { x.backup.archiveSha256 = 'https://synthetic.invalid/'; }, x => { x.inventory.users[0] = null; }]) {
    const input = fixture(); mutate(input); assert.throws(() => planAuthReconciliation(input));
  }
});
