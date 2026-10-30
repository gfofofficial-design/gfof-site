import test from 'node:test';
import assert from 'node:assert/strict';
import {projectAllianceConstellation as project} from '../lib/alliance-constellation-projection.mjs';
const now = '2026-10-23T17:00:00.000Z', recent = '2026-10-23T16:59:00.000Z', later = '2026-10-23T17:05:00.000Z';
const memberId = '00000000-0000-0000-0000-000000000001', imageId = '00000000-0000-0000-0000-000000000002';
const token = 'A'.repeat(32), otherToken = 'B'.repeat(32);
const options = {enabled: true, asOf: now};
function fixture() {
  return {projects: [{id: 'example-a', name: 'Example crew A', state: 'approved', logo: {id: imageId, state: 'approved', mapConsent: true}},
    {id: 'example-b', name: 'Example crew B', state: 'approved', logo: null}], members: [{id: memberId, name: 'Synthetic member', publication: 'listed', mapConsent: true,
    memberships: [{projectId: 'example-a', state: 'confirmed'}, {projectId: 'example-b', state: 'confirmed'}],
    image: {id: imageId, state: 'approved', mapConsent: true}, holdings: [{tokenId: token, shared: true, precision: 'range', atomicUnits: '12500000000000000000', decimals: 9, observedAt: recent, walletVerifiedUntil: later, readState: 'ready'}]}]};
}
const holdings = data => project(data, {...options, view: 'holdings', tokenId: token});
const denied = fn => assert.throws(fn, {message: 'constellation_unavailable'});
test('default closed does not inspect a snapshot or trigger its getters', () => {
  const source = new Proxy({}, {get() { throw Error('touched'); }, ownKeys() { throw Error('touched'); }});
  assert.deepEqual(project(source), {state: 'closed'});
  assert.throws(() => project(source, {...options, enabled: 'true'}), {message: 'constellation_configuration'});
});
test('community projection has no holdings, wallet, proof or exact amount fields', () => {
  const result = project(fixture(), options), m = result.members[0];
  assert.deepEqual(Object.keys(m), ['id', 'name', 'teamIds', 'imageId']);
  assert.deepEqual(m.teamIds, ['example-a', 'example-b']);
  assert.equal(result.members.length, 1);
  assert.equal(JSON.stringify(result).includes('12500000000000000000'), false);
  assert.equal(JSON.stringify(result).includes(token), false);
  assert.equal(Object.isFrozen(result.members[0].teamIds), true);
});
test('map consent never follows directory listing, and withheld profiles disappear', () => {
  for (const change of [{mapConsent: false}, {publication: 'unlisted'}, {publication: 'held'}, {publication: 'removed'}]) {
    const d = fixture(); Object.assign(d.members[0], change);
    assert.deepEqual(holdings(d).members, []);
  }
});
test('pending/revoked teams and unapproved projects cannot establish map membership', () => {
  for (const state of ['pending', 'revoked']) {
    const d = fixture(); d.members[0].memberships.forEach(m => m.state = state);
    assert.equal(project(d, options).members.length, 0);
  }
  const d = fixture(); d.projects[0].state = 'held'; d.projects[1].state = 'removed';
  assert.equal(project(d, options).members.length, 0);
});
test('image withdrawal and moderation preserve the text member with an initials fallback', () => {
  for (const change of [{mapConsent: false}, {state: 'held'}, {state: 'removed'}]) {
    const d = fixture(); Object.assign(d.members[0].image, change); Object.assign(d.projects[0].logo, change);
    const result = project(d, options);
    assert.equal(result.members[0].imageId, null); assert.equal(result.projects[0].logoId, null);
    assert.equal(result.members[0].name, 'Synthetic member');
  }
});
test('range disclosures cannot leak exact values through payloads or sizing metadata', () => {
  const d = fixture(), result = holdings(d), first = result.members[0].holding;
  assert.deepEqual(first, {tokenId: token, decimals: 9, observedAt: recent, precision: 'range', lowerAtomic: '10000000000000000000', upperAtomicExclusive: '100000000000000000000'});
  d.members[0].holdings[0].atomicUnits = '99999999999999999999';
  assert.deepEqual(holdings(d), result);
  d.members[0].holdings[0].atomicUnits = '0';
  assert.deepEqual(holdings(d).members[0].holding, {...first, lowerAtomic: '0', upperAtomicExclusive: '10000000000000'});
  d.members[0].holdings[0].atomicUnits = '9999999999999';
  assert.deepEqual(holdings(d).members[0].holding, {...first, lowerAtomic: '0', upperAtomicExclusive: '10000000000000'});
});
test('only explicit exact disclosure emits exact units; precision survives large integers', () => {
  const d = fixture(); d.members[0].holdings[0].precision = 'exact';
  assert.equal(holdings(d).members[0].holding.atomicUnits, '12500000000000000000');
  assert.equal(Object.hasOwn(holdings(d).members[0].holding, 'lowerAtomic'), false);
});
test('another token, consent withdrawal, stale/future reads or expired wallet control yield no holding', () => {
  for (const change of [{tokenId: otherToken}, {shared: false}, {readState: 'unavailable'},
    {observedAt: '2026-10-23T16:54:59.999Z'}, {observedAt: later}, {walletVerifiedUntil: now},
    {walletVerifiedUntil: '2026-10-23T16:50:00.000Z'}]) {
    const d = fixture(); Object.assign(d.members[0].holdings[0], change);
    const result = holdings(d); assert.equal(result.members.length, 1); assert.equal(result.members[0].holding, null);
  }
});
test('freshness boundary is exact and the host must supply a valid trusted clock', () => {
  const d = fixture(); d.members[0].holdings[0].observedAt = '2026-10-23T16:55:00.000Z';
  assert.notEqual(holdings(d).members[0].holding, null);
  for (const change of [{asOf: undefined}, {asOf: 'today'}, {asOf: '2026-10-23T12:00:00-05:00'}, {maxAgeMs: 0}, {maxAgeMs: Infinity}, {view: 'wealth'}, {tokenId: token}]) denied(() => project(d, {...options, ...change}));
});
test('raw contact data, wallet addresses and external image URLs are rejected, not forwarded', () => {
  for (const field of ['email', 'walletAddress', 'sessionId', 'signature']) {
    const d = fixture(); d.members[0][field] = 'DO_NOT_DISCLOSE';
    denied(() => project(d, options));
  }
  const d = fixture(); d.members[0].image.id = 'https://tracker.example/avatar'; denied(() => project(d, options));
});
test('duplicate identities, teams and tokens cannot inflate membership or holdings', () => {
  const member = fixture(); member.members.push(structuredClone(member.members[0])); denied(() => holdings(member));
  const team = fixture(); team.members[0].memberships.push({...team.members[0].memberships[0]}); denied(() => holdings(team));
  const tokenData = fixture(); tokenData.members[0].holdings.push({...tokenData.members[0].holdings[0]}); denied(() => holdings(tokenData));
});
test('oversized snapshots, malformed units and deceptive names fail without returning raw errors', () => {
  for (const units of ['-1', '1.5', '01', '1e6', '9'.repeat(79), 100]) {
    const d = fixture(); d.members[0].holdings[0].atomicUnits = units; denied(() => holdings(d));
  }
  const d = fixture(); d.members = Array(201).fill(d.members[0]); denied(() => project(d, options));
  for (const name of ['<img src=x>', 'Name\u202eevil', 'x'.repeat(41)]) {
    const d = fixture(); d.members[0].name = name; denied(() => project(d, options));
  }
});
test('output is detached from the trusted snapshot and order never depends on hidden amounts', () => {
  const d = fixture(); const second = structuredClone(d.members[0]); second.id = '00000000-0000-0000-0000-000000000003'; second.mapConsent = false;
  d.members.unshift(second); const result = project(d, options); d.members[1].name = 'Changed';
  assert.equal(result.members[0].name, 'Synthetic member'); assert.equal(result.members.length, 1);
});
test('community view never inspects holding records, even if their values are unavailable', () => {
  const d = fixture(); d.members[0].holdings = new Proxy([], {get() { throw Error('private holding inspected'); }});
  assert.equal(project(d, options).members.length, 1);
});
