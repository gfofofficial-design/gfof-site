// Public, source-reviewed station data. Never store prospects or private agreements here.
export const HOST_STATION = Object.freeze({
  id: 'gfof',
  name: 'Galactic Federation of Finance',
  symbol: 'GFOF',
  badge: 'GF',
  relationship: 'host',
  summary: 'On-chain tools, financial missions and a public record of the work being built.',
  mint: 'Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV',
  website: 'https://galacticfederation.co/',
  evidence: 'https://galacticfederation.co/treasury#current-mint-lock',
});

// Add a partner only after consent, identity and publication approval are recorded.
// This file is downloadable; a hidden/pending entry would still disclose a prospect.
export const PARTNER_STATIONS = Object.freeze([]);

const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function validMint(value) {
  if (typeof value !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) return false;
  let number = 0n;
  for (const character of value) number = number * 58n + BigInt(alphabet.indexOf(character));
  let bytes = 0;
  while (number) { bytes++; number >>= 8n; }
  return bytes + value.match(/^1*/)[0].length === 32;
}

function text(value, limit) {
  return typeof value === 'string' && value.length > 0 && value.length <= limit &&
    value === value.trim() && !/[\u0000-\u001f\u007f<>]/.test(value);
}

export function safeWebsite(value) {
  if (typeof value !== 'string' || !value.startsWith('https://') || value.length > 500 || /[\s\\]/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      url.hostname.includes('.') && !url.hostname.endsWith('.') && !url.hostname.startsWith('.');
  } catch { return false; }
}

function reviewDate(value) {
  if (typeof value !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(time) && new Date(time).toISOString().slice(0,10) === value;
}

export function approvedPartner(station) {
  if (!station || typeof station !== 'object' || Array.isArray(station)) return false;
  const review = station.review;
  return station.relationship === 'partner' && station.id !== 'gfof' &&
    typeof station.id === 'string' && /^[a-z][a-z0-9-]{1,31}$/.test(station.id) &&
    text(station.name, 70) && text(station.summary, 220) &&
    typeof station.symbol === 'string' && /^[A-Z0-9]{1,12}$/.test(station.symbol) &&
    typeof station.badge === 'string' && /^[A-Z0-9]{1,3}$/.test(station.badge) &&
    validMint(station.mint) && safeWebsite(station.website) && safeWebsite(station.evidence) &&
    review?.consent === 'confirmed' && review?.identity === 'confirmed' &&
    review?.publication === 'approved' &&
    reviewDate(review?.date) &&
    typeof review?.reference === 'string' && /^ALLIANCE-[A-Z0-9-]{6,48}$/.test(review.reference);
}

export function publishedStations(partners = PARTNER_STATIONS) {
  if (!Array.isArray(partners) || partners.length > 24) return [HOST_STATION];
  const counts = new Map();
  for (const entry of partners) {
    if (entry && typeof entry.id === 'string') counts.set(entry.id, (counts.get(entry.id) || 0) + 1);
  }
  return [HOST_STATION, ...partners.filter(entry => approvedPartner(entry) && counts.get(entry.id) === 1)];
}

export function stationLinks(station) {
  if (station !== HOST_STATION && !approvedPartner(station)) throw Error('Unpublished station');
  return Object.freeze({
    lens: 'https://dossiertrack.co/token-structure?mint=' + encodeURIComponent(station.mint),
    explorer: 'https://solscan.io/token/' + encodeURIComponent(station.mint),
    website: station.website,
    evidence: station.evidence,
  });
}

export function stationChoice(rawId, stations = publishedStations()) {
  const station = stations.find(entry => entry.id === rawId);
  return {station: station || HOST_STATION, unavailable: !!rawId && !station};
}

export function matchingStations(query, stations = publishedStations()) {
  const needle = typeof query === 'string' ? query.slice(0,60).trim().toLowerCase() : '';
  return stations.filter(entry => (entry.name + ' ' + entry.symbol).toLowerCase().includes(needle));
}
