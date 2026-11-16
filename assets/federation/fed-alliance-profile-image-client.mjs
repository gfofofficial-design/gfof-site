import { imageId, imageVersion, profileImageContentPath, profileImageHeaders, profileImageInputLimit,
  profileImageOutputLimit, profileImagePath, profileImageStatePath, profileImageTypes } from './fed-alliance-profile-image-contract.mjs';

const knownStates = new Set(['invalid', 'forbidden', 'profile_changed', 'busy', 'unavailable', 'account_unavailable',
  'request_ended', 'unknown', 'reserved', 'uploading', 'cancelled', 'rejected', 'stale', 'cleanup_pending', 'removal_pending', 'committed']);
const unavailable = () => new Error('profile_image_unavailable');
const exact = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

export function createProfileImageClient({ origin, fetcher }) {
  if (!/^https:\/\/(?:galacticfederation\.co|deploy-preview-[1-9][0-9]*--gfof\.netlify\.app)$/.test(origin) || typeof fetcher !== 'function') throw unavailable();

  async function send(path, options, signal) {
    const { profileId, method = 'GET', operationId, version, file } = options;
    if (!imageId(profileId) || operationId !== undefined && !imageId(operationId) || version !== undefined && !imageVersion(version)) throw unavailable();
    const wantsImage = path === profileImageContentPath;
    const headers = { Accept: wantsImage ? 'image/png, application/json' : 'application/json', [profileImageHeaders.profile]: profileId };
    if (operationId !== undefined) headers[profileImageHeaders.operation] = operationId;
    if (version !== undefined) headers[profileImageHeaders.version] = String(version);
    if (file) {
      if (!profileImageTypes.includes(file.type) || !Number.isSafeInteger(file.size) || file.size < 12 || file.size > profileImageInputLimit) throw unavailable();
      headers['Content-Type'] = file.type;
    }
    const endpoint = origin + path;
    const deadline = AbortSignal.timeout(42000);
    const requestSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
    requestSignal.throwIfAborted();
    let response, reader;
    try {
      response = await fetcher(endpoint, { method, headers, body: file, signal: requestSignal,
        credentials: 'same-origin', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer' });
      requestSignal.throwIfAborted();
      if (response.redirected || response.url && response.url !== endpoint ||
          !/(?:^|,)\s*no-store\s*(?:,|$)/i.test(response.headers.get('cache-control') || '') || !response.body) throw unavailable();
      const mime = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
      const image = wantsImage && response.status === 200 && mime === 'image/png';
      if (!image && mime !== 'application/json') throw unavailable();
      const length = response.headers.get('content-length');
      const maxBytes = image ? profileImageOutputLimit : 2048;
      if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) throw unavailable();
      reader = response.body.getReader();
      const bytes = new Uint8Array(maxBytes);
      let offset = 0;
      for (;;) {
        const part = await reader.read();
        requestSignal.throwIfAborted();
        if (part.done) break;
        if (!(part.value instanceof Uint8Array) || offset + part.value.byteLength > maxBytes) throw unavailable();
        bytes.set(part.value, offset);
        offset += part.value.byteLength;
      }
      if (length !== null && Number(length) !== offset) throw unavailable();
      const body = bytes.subarray(0, offset);
      if (image) return { state: 'readable', image: new Blob([body], { type: 'image/png' }) };
      const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
      if (response.status === 200 && path === profileImageStatePath && exact(value, ['state', 'version', 'hasImage']) &&
          value.state === 'ready' && imageVersion(value.version) && typeof value.hasImage === 'boolean' && (!value.hasImage || value.version > 0)) return value;
      if (response.status === 200 && method !== 'GET' && exact(value, ['state', 'version']) &&
          value.state === 'committed' && imageVersion(value.version) && value.version === version + 1) return value;
      if (exact(value, ['state']) && knownStates.has(value.state) && (value.state !== 'committed' || method === 'GET' && path === profileImagePath)) return value;
      throw unavailable();
    } finally {
      try { void Promise.resolve(reader ? reader.cancel() : response?.body?.cancel()).catch(() => {}); } catch {}
    }
  }

  return Object.freeze({
    read: (profileId, signal) => send(profileImageStatePath, { profileId }, signal),
    content: (profileId, version, signal) => send(profileImageContentPath, { profileId, version }, signal),
    replace: (profileId, version, operationId, file, signal) => send(profileImagePath, { profileId, version, operationId, file, method: 'PUT' }, signal),
    remove: (profileId, version, operationId, signal) => send(profileImagePath, { profileId, version, operationId, method: 'DELETE' }, signal),
    status: (profileId, operationId, signal) => send(profileImagePath, { profileId, operationId }, signal),
  });
}
