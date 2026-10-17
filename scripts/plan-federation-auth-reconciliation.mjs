// Offline metadata planner only. No file, network, database or deletion operations.
const LIMIT = 10000;
const REF = /^[a-z]{20}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CASE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

function reject(code) { throw new Error(code); }
function shape(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) reject('invalid_shape');
  const actual = Object.keys(value);
  if (actual.length !== keys.length || actual.some(key => !keys.includes(key))) reject('invalid_fields');
}
function ref(value) { if (typeof value !== 'string' || !REF.test(value)) reject('invalid_project_ref'); }
function uuid(value) {
  if (typeof value !== 'string' || !UUID.test(value) || value === ZERO_UUID) reject('invalid_user_or_identity_id');
}
function instant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) reject('invalid_utc_time');
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().replace('.000Z', 'Z') !== value.replace('.000Z', 'Z')) reject('invalid_utc_time');
  return parsed;
}
function rows(value) { if (!Array.isArray(value) || value.length > LIMIT) reject('invalid_row_limit'); }
function count(value) { if (!Number.isSafeInteger(value) || value < 0) reject('invalid_count'); }

/**
 * Accept normalized metadata, never raw Auth rows. Isolation and ledger coverage
 * are operator attestations; this function cannot independently establish them.
 * Returned UUIDs are private operator data and must not enter public logs/Git.
 */
export function planAuthReconciliation(input) {
  shape(input, ['schemaVersion', 'sourceProjectRef', 'targetProjectRef', 'backup', 'inventory', 'ledger', 'isolation']);
  if (input.schemaVersion !== 1) reject('invalid_schema_version');
  ref(input.sourceProjectRef); ref(input.targetProjectRef);
  if (input.sourceProjectRef === input.targetProjectRef) reject('source_is_restore_target');

  shape(input.backup, ['projectRef', 'capturedAtUtc', 'archiveSha256']);
  shape(input.inventory, ['projectRef', 'observedAtUtc', 'users', 'identities', 'sessionRows', 'refreshTokenRows']);
  shape(input.ledger, ['projectRef', 'completeThroughUtc', 'entries']);
  shape(input.isolation, ['signupClosed', 'outboundDeliveryClosed', 'productionConnected']);
  if (input.backup.projectRef !== input.sourceProjectRef || input.ledger.projectRef !== input.sourceProjectRef ||
      input.inventory.projectRef !== input.targetProjectRef) reject('project_binding_mismatch');
  if (typeof input.backup.archiveSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(input.backup.archiveSha256)) reject('invalid_archive_hash');
  const backupAt = instant(input.backup.capturedAtUtc);
  const observedAt = instant(input.inventory.observedAtUtc);
  const ledgerThrough = instant(input.ledger.completeThroughUtc);
  if (backupAt > observedAt) reject('backup_after_inventory');
  for (const key of ['signupClosed', 'outboundDeliveryClosed', 'productionConnected']) {
    if (typeof input.isolation[key] !== 'boolean') reject('invalid_isolation_attestation');
  }
  count(input.inventory.sessionRows); count(input.inventory.refreshTokenRows);
  rows(input.inventory.users); rows(input.inventory.identities); rows(input.ledger.entries);

  const userIds = new Set();
  for (const user of input.inventory.users) {
    shape(user, ['id']); uuid(user.id);
    if (userIds.has(user.id)) reject('duplicate_user_id');
    userIds.add(user.id);
  }
  const identityIds = new Set(), identitiesByUser = new Map();
  const reasons = new Set();
  for (const identity of input.inventory.identities) {
    shape(identity, ['id', 'userId']); uuid(identity.id); uuid(identity.userId);
    if (identityIds.has(identity.id)) reject('duplicate_identity_id');
    identityIds.add(identity.id);
    if (!userIds.has(identity.userId)) reasons.add('orphan_identity');
    const linked = identitiesByUser.get(identity.userId) || [];
    linked.push(identity.id); identitiesByUser.set(identity.userId, linked);
  }

  const cases = new Map(), confirmed = new Set();
  for (const entry of input.ledger.entries) {
    shape(entry, ['projectRef', 'caseRef', 'userId', 'recordedAtUtc', 'outcome']);
    if (entry.projectRef !== input.sourceProjectRef) reject('ledger_project_mismatch');
    uuid(entry.userId);
    if (typeof entry.caseRef !== 'string' || !CASE.test(entry.caseRef)) reject('invalid_case_ref');
    const recordedAt = instant(entry.recordedAtUtc);
    if (recordedAt > ledgerThrough || recordedAt > observedAt) reject('ledger_entry_after_cutoff');
    if (!['confirmed_deleted', 'pending', 'failed'].includes(entry.outcome)) reject('invalid_deletion_outcome');
    const caseValue = `${entry.userId}|${recordedAt}|${entry.outcome}`;
    if (cases.has(entry.caseRef) && cases.get(entry.caseRef) !== caseValue) reject('conflicting_case_ref');
    cases.set(entry.caseRef, caseValue);
    if (entry.outcome !== 'confirmed_deleted') { reasons.add('unresolved_deletion_case'); continue; }
    confirmed.add(entry.userId);
    if (recordedAt <= backupAt && userIds.has(entry.userId)) reasons.add('pre_backup_deletion_present');
  }

  if (!input.isolation.signupClosed || !input.isolation.outboundDeliveryClosed || input.isolation.productionConnected) reasons.add('restore_not_isolated');
  if (input.inventory.sessionRows || input.inventory.refreshTokenRows) reasons.add('restored_session_rows_present');
  if (ledgerThrough < observedAt) reasons.add('ledger_coverage_stale');
  if (reasons.size) return { status: 'blocked', reasons: [...reasons].sort(), removals: [] };

  const removals = [...confirmed].filter(id => userIds.has(id)).sort().map(userId => ({
    userId, identityIds: [...(identitiesByUser.get(userId) || [])].sort(),
  }));
  return {
    status: removals.length ? 'reviewable_removal_plan' : 'reviewable_no_removal',
    reasons: [], removals,
    counts: {
      inventoriedUsers: userIds.size, inventoriedIdentities: identityIds.size,
      confirmedDeletedUsers: confirmed.size, alreadyAbsentUsers: [...confirmed].filter(id => !userIds.has(id)).length,
      candidateUsers: removals.length, candidateIdentities: removals.reduce((sum, item) => sum + item.identityIds.length, 0),
    },
  };
}
