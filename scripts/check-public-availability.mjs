import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const plan = JSON.parse(readFileSync(new URL('../config/public-availability.json', import.meta.url), 'utf8'));
const allowed = new Map([
  ['federation', 'https://galacticfederation.co/'],
  ['dossier', 'https://dossiertrack.co/'],
  ['fcc', 'https://fcc.galacticfederation.co/'],
]);
if (plan.schemaVersion !== 1 || plan.targets.length !== allowed.size ||
    new Set(plan.targets.map(t => t.id)).size !== allowed.size ||
    plan.targets.some(t => allowed.get(t.id) !== t.url || typeof t.titleIncludes !== 'string' || !t.titleIncludes.trim()) ||
    !Number.isInteger(plan.timeoutMs) || plan.timeoutMs < 1 || plan.timeoutMs > 20000 ||
    plan.maxBytes !== 65536) throw new Error('Invalid public monitoring plan.');

export async function checkPublicAvailability({ fetcher = fetch, timeoutMs = plan.timeoutMs } = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 20000) throw new Error('Invalid check deadline.');
  const results = await Promise.all(plan.targets.map(async target => {
    const start = performance.now(), controller = new AbortController();
    let responseStatus = null, onAbort, reason = 'unavailable';
    const aborted = new Promise((_, reject) => {
      onAbort = () => reject(new Error('deadline'));
      controller.signal.addEventListener('abort', onAbort, { once: true });
    });
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const work = (async () => {
      const response = await fetcher(target.url, { method: 'GET', redirect: 'error', cache: 'no-store', signal: controller.signal });
      responseStatus = response.status;
      if (response.status !== 200) return 'unexpected_status';
      if (!/^text\/html(?:;|$)/i.test(response.headers.get('content-type') || '')) return 'unexpected_content_type';
      if (!response.body) return 'missing_body';
      const reader = response.body.getReader(), decoder = new TextDecoder();
      let bytes = 0, text = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return 'missing_title';
        const remaining = plan.maxBytes - bytes;
        const chunk = value.byteLength > remaining ? value.subarray(0, remaining) : value;
        bytes += chunk.byteLength;
        text += decoder.decode(chunk, { stream: true });
        const title = text.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
        if (title) return title[1].toLowerCase().includes(target.titleIncludes.toLowerCase()) ? 'ok' : 'unexpected_title';
        if (bytes === plan.maxBytes) return 'content_limit';
      }
    })();
    try { reason = await Promise.race([work, aborted]); }
    catch { reason = controller.signal.aborted ? 'timeout' : 'unavailable'; }
    finally {
      clearTimeout(timer);
      controller.signal.removeEventListener('abort', onAbort);
      controller.abort();
    }
    return { id: target.id, url: target.url, available: reason === 'ok', status: responseStatus, reason,
      durationMs: Math.round(performance.now() - start) };
  }));
  return { checkedAt: new Date().toISOString(), scope: 'public_homepage_availability_only',
    available: results.every(r => r.available), results };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await checkPublicAvailability();
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exitCode = result.available ? 0 : 1;
}
