// Unmounted server-side data minimizer. No database, wallet, network or browser I/O.
// The caller must independently authorize the audience and obtain current consent,
// membership, moderation, image and wallet-control decisions from trusted stores.
// Input booleans/records are NOT proof of authorization. Never accept them from a client.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PROJECT = /^[a-z][a-z0-9-]{1,39}$/;
const TOKEN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const BAD_TEXT = /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069<>]/u;
function refuse() { throw Error('constellation_unavailable'); }
function shape(value, keys) {
  if (!value || ![Object.prototype, null].includes(Object.getPrototypeOf(value)) ||
      Object.getOwnPropertySymbols(value).length ||
      Object.keys(value).sort().join(',') !== [...keys].sort().join(',') ||
      Object.values(Object.getOwnPropertyDescriptors(value)).some(d => !Object.hasOwn(d, 'value'))) refuse();
}
function oneOf(value, values) { if (!values.includes(value)) refuse(); }
function list(value, max) { if (!Array.isArray(value) || value.length > max) refuse(); }
function id(value, pattern = UUID) { if (typeof value !== 'string' || !pattern.test(value)) refuse(); return value; }
function text(value, max) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || BAD_TEXT.test(value)) refuse();
  return value.trim();
}
function time(value) {
  if (typeof value !== 'string') refuse();
  const ms = Date.parse(value);
  if (!Number.isFinite(ms) || new Date(ms).toISOString() !== value) refuse();
  return ms;
}
function unique(seen, value) { if (seen.has(value)) refuse(); seen.add(value); }
function image(value) {
  if (value === null) return null;
  shape(value, ['id', 'state', 'mapConsent']);
  id(value.id); oneOf(value.state, ['approved', 'held', 'removed']);
  oneOf(value.mapConsent, [true, false]);
  return value.state === 'approved' && value.mapConsent ? value.id : null;
}
function holding(value, tokenId, now, maxAgeMs) {
  shape(value, ['tokenId', 'shared', 'precision', 'atomicUnits', 'decimals', 'observedAt', 'walletVerifiedUntil', 'readState']);
  id(value.tokenId, TOKEN); oneOf(value.shared, [true, false]);
  // Nonselected or undisclosed tokens never contribute to the payload or sizing.
  if (value.tokenId !== tokenId || value.shared !== true) return null;
  oneOf(value.precision, ['exact', 'range']); oneOf(value.readState, ['ready', 'unavailable']);
  if (value.readState !== 'ready') return null;
  const observed = time(value.observedAt), verifiedUntil = time(value.walletVerifiedUntil);
  if (observed > now || now - observed > maxAgeMs || verifiedUntil <= now) return null;
  if (!Number.isInteger(value.decimals) || value.decimals < 0 || value.decimals > 18 ||
      typeof value.atomicUnits !== 'string' || !/^(0|[1-9][0-9]{0,77})$/.test(value.atomicUnits)) refuse();
  const base = {tokenId, decimals: value.decimals, observedAt: value.observedAt, precision: value.precision};
  if (value.precision === 'exact') return {...base, atomicUnits: value.atomicUnits};
  // Only a coarse band reaches the consumer. No exact amount, hidden sizing
  // weight, wallet address, provider diagnostic or proof expiry is returned.
  const units = BigInt(value.atomicUnits);
  const scale = 10n ** BigInt(value.decimals);
  const edges = [0n, 10000n, 50000n, 100000n, 500000n, 1000000n].map(n => n * scale);
  let lower, upper;
  for (let i = 1; i < edges.length; i++) {
    if (units < edges[i]) { lower = edges[i - 1]; upper = edges[i]; break; }
  }
  if (lower === undefined) { lower = 10n ** BigInt(value.atomicUnits.length - 1); upper = lower * 10n; }
  return {...base, lowerAtomic: String(lower), upperAtomicExclusive: String(upper)};
}
function freeze(value) {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}

export function projectAllianceConstellation(snapshot, {enabled = false, asOf, view = 'community', tokenId = null, maxAgeMs = 300000} = {}) {
  if (enabled === false) return Object.freeze({state: 'closed'});
  if (enabled !== true) throw Error('constellation_configuration');
  try {
    const now = time(asOf);
    oneOf(view, ['community', 'holdings']);
    if (!Number.isSafeInteger(maxAgeMs) || maxAgeMs < 1000 || maxAgeMs > 3600000) refuse();
    if (view === 'holdings') id(tokenId, TOKEN); else if (tokenId !== null) refuse();
    shape(snapshot, ['projects', 'members']);
    list(snapshot.projects, 50); list(snapshot.members, 200);
    const projects = new Map(), projectIds = new Set();
    for (const p of snapshot.projects) {
      shape(p, ['id', 'name', 'state', 'logo']); id(p.id, PROJECT); unique(projectIds, p.id);
      oneOf(p.state, ['approved', 'held', 'removed']);
      if (p.state !== 'approved') continue;
      const logoId = image(p.logo);
      projects.set(p.id, {id: p.id, name: text(p.name, 70), logoId});
    }
    const members = [], memberIds = new Set();
    for (const m of snapshot.members) {
      shape(m, ['id', 'name', 'publication', 'mapConsent', 'memberships', 'image', 'holdings']);
      id(m.id); unique(memberIds, m.id);
      oneOf(m.publication, ['listed', 'unlisted', 'held', 'removed']); oneOf(m.mapConsent, [true, false]);
      if (m.publication !== 'listed' || m.mapConsent !== true) continue;
      list(m.memberships, 8);
      const teamIds = [], seenTeams = new Set();
      for (const membership of m.memberships) {
        shape(membership, ['projectId', 'state']); id(membership.projectId, PROJECT);
        unique(seenTeams, membership.projectId); oneOf(membership.state, ['confirmed', 'pending', 'revoked']);
        if (membership.state === 'confirmed' && projects.has(membership.projectId)) teamIds.push(membership.projectId);
      }
      if (!teamIds.length) continue;
      const member = {id: m.id, name: text(m.name, 40), teamIds: teamIds.sort(), imageId: image(m.image)};
      if (view === 'holdings') {
        list(m.holdings, 20);
        const seenTokens = new Set(); let selected = null;
        for (const h of m.holdings) {
          shape(h, ['tokenId', 'shared', 'precision', 'atomicUnits', 'decimals', 'observedAt', 'walletVerifiedUntil', 'readState']);
          id(h.tokenId, TOKEN); unique(seenTokens, h.tokenId);
          const projected = holding(h, tokenId, now, maxAgeMs);
          if (projected) selected = projected;
        }
        member.holding = selected;
      }
      members.push(member);
    }
    // Order is independent of undisclosed amounts. One member ID may have many
    // team IDs, but is never duplicated or counted once per holding.
    members.sort((a, b) => a.id.localeCompare(b.id));
    return freeze({state: 'ready', asOf, view, tokenId, scope: 'bounded-snapshot',
      projects: [...projects.values()].sort((a, b) => a.id.localeCompare(b.id)), members});
  } catch { refuse(); }
}
