// Default-off composition, not a Lambda entrypoint. No resource/key discovery,
// imports, grants, deployment, initialization or automatic retry occurs here.
import {createMemberAuthorityHandler} from './member-authority-transport.mjs';
import {createAnchoredControlAuthority} from './control-authority.mjs';
import {createAnchoredJournalWitness} from './anchored-witness.mjs';
import {performance} from 'node:perf_hooks';

const fail = () => Error('alliance_member_service_unavailable');
const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v) &&
  Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
export const MEMBER_AUTHORITY_BUDGETS = Object.freeze({handler: 5500, nonce: 1500, issuer: 3000, signer: 1200, reserve: 1000});
export function reviewMemberAuthorityBudgets(input = MEMBER_AUTHORITY_BUDGETS) {
  if (!exact(input, Object.keys(MEMBER_AUTHORITY_BUDGETS)) ||
      Object.values(input).some(v => !Number.isSafeInteger(v) || v < 1) ||
      input.handler > 5500 || input.nonce > 2000 || input.issuer > 3500 || input.signer > 1200 ||
      input.signer >= input.issuer || input.nonce + input.issuer + input.reserve > input.handler) throw fail();
  return Object.freeze({...input});
}
const unavailable = () => ({statusCode: 503, isBase64Encoded: false,
  headers: {'content-type': 'application/json', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff'},
  body: '{"state":"unavailable"}'});

export function createMemberAuthorityService({enabled = false, binding, minimum, stores, signers, claims, budgets} = {}) {
  if (typeof enabled !== 'boolean') throw fail();
  let closed = false, handler;
  const issuers = [], stages = new Set();
  // Injected stores, signers and the durable claims store remain caller-owned.
  // Closing this service aborts its work and closes only its own issuers/handler.
  const close = () => {
    closed = true;
    for (const controller of stages) controller.abort();
    handler?.close();
    for (const issuer of issuers) issuer.close();
  };
  async function stage(ms, signal, work) {
    if (closed || !(signal instanceof AbortSignal) || signal.aborted) throw fail();
    const c = new AbortController(), started = performance.now(); stages.add(c);
    const abort = () => c.abort(); let onAbort;
    signal.addEventListener('abort', abort, {once: true}); if (signal.aborted) abort();
    const stopped = new Promise((_, reject) => {
      onAbort = () => reject(fail()); c.signal.addEventListener('abort', onAbort, {once: true});
      if (c.signal.aborted) onAbort();
    });
    const timer = setTimeout(abort, ms);
    const check = () => { if (closed || c.signal.aborted || performance.now() - started >= ms) throw fail(); };
    try {
      const value = await Promise.race([Promise.resolve().then(() => {check(); return work(c.signal);}), stopped]);
      check(); return value;
    } catch { throw fail(); }
    finally {
      clearTimeout(timer); signal.removeEventListener('abort', abort);
      c.signal.removeEventListener('abort', onAbort); c.abort(); stages.delete(c);
    }
  }
  if (enabled) try {
    const b = reviewMemberAuthorityBudgets(budgets);
    if (!exact(binding, ['gateway', 'resource', 'scope', 'callerKey', 'controlVerificationKey', 'journalVerificationKey']) ||
        !exact(minimum, ['control', 'journal']) || !exact(stores, ['control', 'anchor', 'journal']) ||
        !exact(signers, ['control', 'journal']) || !['read'].every(k => typeof stores.control?.[k] === 'function' && typeof stores.anchor?.[k] === 'function') ||
        !['tip', 'records'].every(k => typeof stores.journal?.[k] === 'function') ||
        typeof signers.control !== 'function' || typeof signers.journal !== 'function' || typeof claims?.claim !== 'function') throw fail();
    const scope = binding.scope;
    const control = createAnchoredControlAuthority({enabled: true,
      memberProjectRef: scope.memberProjectRef, journalProjectRef: scope.journalProjectRef, epoch: scope.epoch,
      verificationKey: binding.controlVerificationKey, minimum: minimum.control,
      store: stores.control, anchorStore: stores.anchor, timeoutMs: b.issuer,
      signBytes: (bytes, {signal}) => stage(b.signer, signal, inner => signers.control(bytes, {signal: inner}))});
    issuers.push(control);
    const witness = createAnchoredJournalWitness({enabled: true,
      projectRef: scope.memberProjectRef, journalProjectRef: scope.journalProjectRef, epoch: scope.epoch,
      verificationKey: binding.journalVerificationKey, minimum: minimum.journal,
      store: stores.journal, anchorStore: stores.anchor, timeoutMs: b.issuer,
      signBytes: (bytes, {signal}) => stage(b.signer, signal, inner => signers.journal(bytes, {signal: inner}))});
    issuers.push(witness);
    handler = createMemberAuthorityHandler({enabled: true, ...binding, control, witness, timeoutMs: b.handler,
      claims: {claim: (input, {signal}) => stage(b.nonce, signal, inner => claims.claim(input, {signal: inner}))}});
  } catch { close(); throw fail(); }
  return Object.freeze({
    async handle(event, context) {
      if (!enabled || closed) return unavailable();
      try { return await handler.handle(event, context); }
      catch { close(); return unavailable(); }
    }, close,
  });
}
