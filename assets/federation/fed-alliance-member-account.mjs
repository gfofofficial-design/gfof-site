// Explicit, default-closed account/member composition. No login, refresh,
// token parsing, storage, startup request or provider configuration discovery.
import {mountAllianceMemberPage} from './fed-alliance-member-page.mjs';
const ORIGIN = /^https:\/\/(?:galacticfederation\.co|deploy-preview-[1-9][0-9]*--gfof\.netlify\.app)$/;
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const SESSION = '/api/federation-account/session';

export function mountAllianceAccountMemberPage(document, {
  enabled = false, collaborationEnabled = false, feedbackEnabled = false, reportReviewEnabled = false, origin, fetcher = globalThis.fetch,
  locks = globalThis.navigator?.locks, events = globalThis,
  createChannel = name => new BroadcastChannel(name), timeoutMs = 12000,
} = {}) {
  if (typeof reportReviewEnabled !== 'boolean' || reportReviewEnabled && (!enabled || !feedbackEnabled) || typeof feedbackEnabled !== 'boolean' || feedbackEnabled && (!enabled || !collaborationEnabled) || typeof collaborationEnabled !== 'boolean' || collaborationEnabled && !enabled || typeof enabled !== 'boolean' || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 12000 ||
      enabled && (!ORIGIN.test(origin) || typeof fetcher !== 'function' ||
        document.location?.origin !== origin || typeof document.addEventListener !== 'function')) {
    throw Error('member_account_configuration');
  }
  const button = document.getElementById('ap-account-check');
  const status = document.getElementById('ap-account-status');
  const surface = document.getElementById('ap-member-surface');
  const firstProfileAction = document.getElementById('ap-read');
  const accountLink = document.getElementById('ap-account-link');
  const signInHelp = document.getElementById('workspace-sign-in-help');
  const draftHelp = document.getElementById('ap-account-help');
  if (!button || !status || !surface || !firstProfileAction || !accountLink) throw Error('member_account_configuration');
  const page = mountAllianceMemberPage(document, {
    enabled, collaborationEnabled, feedbackEnabled, reportReviewEnabled, origin, fetcher,
    onSignInRequired: () => close('Sign in again to reopen your profile setup. Earlier interrupted requests may still need reconciliation.'),
  });
  let disposed = false, epoch = 0, generation = 0, flight = null, channel = null, accountId = null, resumeFocus = null;
  const visible = () => document.visibilityState === 'visible';
  function updateAccountButton() {
    button.disabled = !enabled || disposed || !visible() || accountId !== null;
    button.setAttribute('aria-disabled', String(button.disabled || flight !== null));
  }
  const say = text => { status.textContent = text; };
  function setSignInPrompt(show) {
    if (!enabled) return;
    accountLink.hidden = !show && !signInHelp;
    if (signInHelp) {
      accountLink.textContent = show ? 'Sign in to Federation' : 'Manage account or sign out';
      signInHelp.hidden = !show;
      button.hidden = !show;
      if (draftHelp) draftHelp.hidden = !show;
    }
  }
  function close(message = 'Profile setup is closed. Open profile setup to check sign-in again. Earlier interrupted requests may still need reconciliation.') {
    if (disposed) return;
    const focused = surface.contains(document.activeElement) || (resumeFocus && document.activeElement === document.body);
    epoch++; accountId = null; resumeFocus = null; surface.hidden = true;
    setSignInPrompt(true);
    flight?.controller.abort(); page.detach(); say(message); updateAccountButton();
    if (enabled && visible() && focused) accountLink.focus();
  }
  async function readSession(signal, turn) {
    const valid = () => {
      if (signal.aborted || disposed || turn !== epoch || !visible()) throw Error('closed');
    };
    valid();
    const endpoint = origin + SESSION;
    const response = await fetcher(endpoint, {
      method: 'GET', credentials: 'same-origin', cache: 'no-store', redirect: 'error',
      headers: {Accept: 'application/json'}, signal,
    });
    let reader;
    const cancel = () => {
      try { void Promise.resolve(reader ? reader.cancel() : response.body?.cancel()).catch(() => {}); } catch {}
    };
    signal.addEventListener('abort', cancel, {once: true});
    try {
      valid();
      if (response.redirected || response.url && response.url !== endpoint) throw Error('response');
      if (response.status === 401) return null;
      if (response.status !== 200 || !/^application\/json(?:;|$)/i.test(response.headers.get('content-type') || '') ||
          !/(?:^|,)\s*no-store\s*(?:,|$)/i.test(response.headers.get('cache-control') || '')) throw Error('response');
      const length = response.headers.get('content-length');
      if (length !== null && (!/^\d+$/.test(length) || Number(length) > 32768)) throw Error('response');
      reader = response.body?.getReader();
      if (!reader) throw Error('response');
      const chunks = []; let bytes = 0;
      for (;;) {
        const part = await reader.read(); valid();
        if (part.done) break;
        if (!(part.value instanceof Uint8Array) || (bytes += part.value.byteLength) > 32768) throw Error('response');
        chunks.push(part.value);
      }
      const out = new Uint8Array(bytes); let offset = 0;
      for (const part of chunks) { out.set(part, offset); offset += part.byteLength; }
      const data = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(out));
      // The ID is a private, memory-only draft-visibility binding. It is never
      // rendered, persisted, broadcast or passed as a member request's actor.
      if (data?.signedIn !== true || !UUID.test(data.user?.id || '')) throw Error('response');
      valid(); return data.user.id;
    } finally { signal.removeEventListener('abort', cancel); cancel(); }
  }
  async function verify(preserve = false) {
    if (!enabled || disposed || !visible() || flight) return false;
    const previous = preserve ? accountId : null;
    if (previous) { epoch++; surface.hidden = true; } else close();
    const turn = epoch, controller = new AbortController(), current = {controller};
    flight = current; updateAccountButton(); say('Checking your Federation sign-in.');
    const work = () => readSession(controller.signal, turn);
    const job = Promise.resolve().then(() => {
      if (controller.signal.aborted || turn !== epoch) throw Error('closed');
      return typeof locks?.request === 'function'
        ? locks.request('gf-account-session', {mode: 'exclusive', signal: controller.signal}, work)
        : work(); // Read only; never exchanges a rotating refresh token.
    });
    // Occupy the latch until actual work settles even if it ignores cancellation.
    void job.finally(() => { if (flight === current) { flight = null; updateAccountButton(); } }).catch(() => {});
    let abort;
    const stopped = new Promise((_, reject) => {
      abort = () => reject(Error('closed'));
      controller.signal.addEventListener('abort', abort, {once: true});
    });
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const verifiedId = await Promise.race([job, stopped]);
      if (disposed || turn !== epoch || !visible() || controller.signal.aborted) return false;
      if (!verifiedId) { close('Sign in to Federation, then return and open profile setup.'); return false; }
      if (previous && verifiedId !== previous) {
        close('The account changed. The earlier draft was cleared. Open profile setup for this account.'); return false;
      }
      if (!previous && !page.attach(++generation)) throw Error('attach');
      accountId = verifiedId; surface.hidden = false;
      if (!previous && (document.activeElement === button || document.activeElement === accountLink)) firstProfileAction.focus();
      setSignInPrompt(false);
      updateAccountButton();
      if (previous && document.activeElement === document.body && surface.contains?.(resumeFocus) && !resumeFocus.disabled) resumeFocus.focus();
      resumeFocus = null;
      say('Sign-in checked. Each member request still verifies your current session.'); return true;
    } catch {
      if (!disposed && turn === epoch) close('Could not check sign-in. Try Open profile setup again when it is available. If it stays unavailable, reload the page.');
      return false;
    } finally { clearTimeout(timer); controller.signal.removeEventListener('abort', abort); }
  }
  const onCheck = () => accountId === null && verify();
  const onVisibility = () => {
    if (!visible()) {
      resumeFocus = surface.contains?.(document.activeElement) ? document.activeElement : null;
      surface.hidden = enabled;
      if (flight) close();
      updateAccountButton();
    } else if (accountId && surface.hidden) { void verify(true); }
    else updateAccountButton();
  };
  const onHide = () => close();
  const onShow = event => { if (event.persisted) close(); };
  const onMessage = event => {
    // A channel hint can only clear content, never establish a session.
    if (event.data?.type === 'signed-out' && typeof event.data.remoteRevoked === 'boolean') close();
  };
  setSignInPrompt(true);
  surface.hidden = true;
  if (enabled) {
    button.addEventListener('click', onCheck);
    document.addEventListener('visibilitychange', onVisibility);
    events.addEventListener?.('pagehide', onHide); events.addEventListener?.('pageshow', onShow);
    try { channel = createChannel('gf-account-status'); channel.addEventListener('message', onMessage); } catch { channel = null; }
  }
  updateAccountButton();
  return Object.freeze({check: () => verify(), close, dispose() {
    if (disposed) return;
    close(); disposed = true;
    button.removeEventListener('click', onCheck);
    document.removeEventListener?.('visibilitychange', onVisibility);
    events.removeEventListener?.('pagehide', onHide); events.removeEventListener?.('pageshow', onShow);
    try { channel?.removeEventListener('message', onMessage); channel?.close(); } catch {}
    channel = null; page.dispose(); updateAccountButton();
  }});
}
