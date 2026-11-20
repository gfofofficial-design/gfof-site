import { AVATAR_LIMITS } from './alliance-avatar-runtime/limits.mjs';
import { imageId, imageVersion, profileImageHeaders as headers, profileImagePath, profileImageStatePath,
  profileImageContentPath, profileImageTypes } from '../assets/federation/fed-alliance-profile-image-contract.mjs';

export function allianceImageRoute(path, method) {
  if (method === 'GET' && path === profileImageStatePath) return 'summary';
  if (method === 'GET' && path === profileImageContentPath) return 'content';
  if (path !== profileImagePath) return null;
  if (method === 'GET') return 'status';
  if (method === 'PUT') return 'replace';
  return method === 'DELETE' ? 'remove' : null;
}

const privateHeaders = { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store',
  'CDN-Cache-Control': 'no-store', 'Netlify-CDN-Cache-Control': 'no-store', Vary: 'Cookie',
  'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow' };
const reply = (status, value) => new Response(JSON.stringify(value), { status, headers: privateHeaders });
const states = new Set(['invalid', 'forbidden', 'profile_changed', 'sign_in_required', 'busy', 'unavailable',
  'account_unavailable', 'request_ended', 'unknown', 'reserved', 'uploading', 'cancelled', 'rejected', 'stale',
  'cleanup_pending', 'removal_pending', 'committed']);
const statusCodes = { invalid: 400, forbidden: 403, profile_changed: 409, sign_in_required: 401 };
const invalid = () => reply(400, { state: 'invalid' });

async function readUpload(request) {
  const rawLength = request.headers.get('content-length');
  const limit = AVATAR_LIMITS.inputBytes;
  if (!request.body || rawLength !== null && (!/^[1-9]\d*$/.test(rawLength) || Number(rawLength) > limit)) return null;
  const reader = request.body.getReader();
  try {
    const bytes = new Uint8Array(rawLength === null ? limit : Number(rawLength));
    let size = 0;
    for (;;) {
      const part = await reader.read();
      request.signal.throwIfAborted();
      if (part.done) break;
      if (!(part.value instanceof Uint8Array) || size + part.value.byteLength > bytes.length) return null;
      bytes.set(part.value, size);
      size += part.value.byteLength;
    }
    if (size === 0 || rawLength !== null && Number(rawLength) !== size) return null;
    return bytes.subarray(0, size);
  } finally { void reader.cancel().catch(() => {}); }
}

// The enclosing member HTTP application owns admission, deadline and cancellation.
export async function handleAllianceMemberImage(request, action, origin, service) {
  const from = request.headers.get('origin');
  const site = request.headers.get('sec-fetch-site');
  if (request.headers.has('authorization') || from !== null && from !== origin || site !== null && site !== 'same-origin' ||
      request.method !== 'GET' && from !== origin) return reply(403, { state: 'forbidden' });

  const expectedProfileId = request.headers.get(headers.profile);
  const operationId = request.headers.get(headers.operation);
  const rawVersion = request.headers.get(headers.version);
  const needsVersion = action !== 'summary' && action !== 'status';
  const needsOperation = action !== 'summary' && action !== 'content';
  if (!imageId(expectedProfileId) || (needsOperation ? !imageId(operationId) : operationId !== null)) return invalid();
  const version = Number(rawVersion);
  if (needsVersion ? (!/^(?:0|[1-9]\d*)$/.test(rawVersion ?? '') || !imageVersion(version) ||
      (action === 'content' ? version === 0 : version === Number.MAX_SAFE_INTEGER)) : rawVersion !== null) return invalid();

  let input = {};
  if (action === 'replace') {
    const mime = request.headers.get('content-type');
    if (!profileImageTypes.includes(mime) || request.headers.has('content-encoding')) return invalid();
    const bytes = await readUpload(request);
    if (!bytes) return invalid();
    input = { operationId, version, bytes, mime };
  } else {
    if (request.body || request.headers.has('transfer-encoding') || ![null, '0'].includes(request.headers.get('content-length'))) return invalid();
    if (action === 'content') input = { version };
    if (action === 'status') input = { operationId };
    if (action === 'remove') input = { operationId, version, confirm: 'remove_my_image' };
  }

  request.signal.throwIfAborted();
  const result = await service.handle(request, input, { expectedProfileId });
  const state = result?.state;
  if (action === 'content' && state === 'readable' && result.response instanceof Response) return result.response;
  if (action === 'summary' && state === 'ready' && imageVersion(result.version) && typeof result.hasImage === 'boolean') {
    return reply(200, { state, version: result.version, hasImage: result.hasImage });
  }
  if (action === 'replace' || action === 'remove') {
    if (state === 'committed') return result.version === version + 1 ? reply(200, { state, version: result.version }) : reply(200, { state: 'unknown' });
  }
  return states.has(state) ? reply(statusCodes[state] || 200, { state }) : reply(503, { state: 'unavailable' });
}
