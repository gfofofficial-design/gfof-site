import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync, createHash, sign} from 'node:crypto';
import {createMemberAuthorityService, reviewMemberAuthorityBudgets, MEMBER_AUTHORITY_BUDGETS} from './member-authority-service.mjs';
import {createMemberAuthorityTransport} from './member-authority-transport.mjs';
import {controlPolicySha256} from './control-policy.mjs';
const zero = {sequence: 0, sha256: '0'.repeat(64)};
const scope = {memberProjectRef: 'abcdefghijklmnopqrst', journalProjectRef: 'uvwxyzabcdefghijklmn', controlProjectRef: 'opqrstuvwxyzabcdefgh', epoch: '11111111-1111-4111-8111-111111111111'};
const gateway = {apiId: 'abcdefghij', region: 'us-east-2', stage: 'preview'};
const resource = {accountId: '123456789012', region: 'us-east-2', functionName: 'alliance-member-authority-synthetic', version: '7'};
const arn = `arn:aws:lambda:${resource.region}:${resource.accountId}:function:${resource.functionName}:${resource.version}`;
const key = () => { const p = generateKeyPairSync('ed25519'); return {...p, hex: Buffer.from(p.publicKey.export({format: 'jwk'}).x, 'base64url').toString('hex')}; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return {promise, resolve}; };
const tiny = {handler: 1200, nonce: 150, issuer: 700, signer: 150, reserve: 350};
function fixture({claim, controlSign, journalRead, budgets, enabled = true} = {}) {
  const caller = key(), control = key(), journal = key(), calls = {claims: 0, policy: 0, anchor: 0, tip: 0, records: 0, controlSign: 0, journalSign: 0};
  const spki = caller.publicKey.export({format: 'der', type: 'spki'});
  const binding = {gateway, resource, scope, controlVerificationKey: control.hex, journalVerificationKey: journal.hex,
    callerKey: {keyId: createHash('sha256').update(spki).digest('hex'), spki: spki.toString('base64'), notBeforeUtc: new Date(Date.now() - 60000).toISOString(), notAfterUtc: new Date(Date.now() + 3600000).toISOString()}};
  const raw = {format: 1, memberProjectRef: scope.memberProjectRef, journalProjectRef: scope.journalProjectRef, epoch: scope.epoch, revision: 2, state: 'review',
    changeId: '22222222-2222-4222-8222-222222222222', freezeId: '33333333-3333-4333-8333-333333333333', frozenAt: '2026-01-01T00:00:00.000Z', checkpointSha256: 'f'.repeat(64), floor: zero};
  const policy = {...raw, sha256: controlPolicySha256(raw)};
  const input = {enabled, binding, budgets, minimum: {control: {revision: 2, sha256: policy.sha256, floor: zero}, journal: zero},
    stores: {control: {read: async () => {calls.policy++; return structuredClone(policy);}}, anchor: {read: async () => {calls.anchor++; return {format: 1, memberProjectRef: scope.memberProjectRef, journalProjectRef: scope.journalProjectRef, epoch: scope.epoch, ...zero};}},
      journal: {tip: async () => {calls.tip++; return {projectRef: scope.memberProjectRef, epoch: scope.epoch, ...zero, enabled: true};}, records: async (q, o) => {calls.records++; return journalRead ? journalRead(q, o) : [];}}},
    signers: {control: async (bytes, o) => {calls.controlSign++; return controlSign ? controlSign(bytes, o, control, journal) : sign(null, bytes, control.privateKey);}, journal: async bytes => {calls.journalSign++; return sign(null, bytes, journal.privateKey);}},
    // Synthetic nonce capability only; no actual DynamoDB or AWS is exercised.
    claims: {claim: async (q, o) => {calls.claims++; return claim ? claim(q, o) : true;}}};
  const service = createMemberAuthorityService(input), clients = [];
  const client = () => {
    const c = createMemberAuthorityTransport({enabled: true, ...binding, signingKey: async () => caller.privateKey, transport: async (o, body) => {
      const headers = {...o.headers, host: o.hostname};
      const event = {resource: '/member-authority', path: '/member-authority', httpMethod: 'POST', headers,
        multiValueHeaders: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, [v]])), queryStringParameters: null, multiValueQueryStringParameters: null, pathParameters: null, stageVariables: null,
        isBase64Encoded: false, body: body.toString('utf8'), requestContext: {accountId: resource.accountId, apiId: gateway.apiId, stage: gateway.stage, domainName: o.hostname, resourcePath: '/member-authority', path: o.path, httpMethod: 'POST'}};
      const r = await service.handle(event, {invokedFunctionArn: arn, functionName: resource.functionName, functionVersion: resource.version, getRemainingTimeInMillis: () => 10000});
      return {statusCode: r.statusCode, headers: {'content-type': r.headers['content-type']}, body: Buffer.from(r.body)};
    }}); clients.push(c); return c;
  };
  return {service, client, calls, input, close() {service.close(); for (const c of clients) c.close();}};
}
const startup = () => ({format: 1, memberProjectRef: scope.memberProjectRef, journalProjectRef: scope.journalProjectRef, epoch: scope.epoch, bootId: 'a'.repeat(64), challenge: 'b'.repeat(64)});
const witness = () => ({projectRef: scope.memberProjectRef, epoch: scope.epoch, challenge: 'c'.repeat(64)});
const refuse = promise => assert.rejects(promise, e => e.message === 'alliance_member_authority_unavailable' && !e.cause);

test('default off performs no store, signer or nonce work and never exports a live handler', async () => {
  const bad = new Proxy({}, {get() {throw Error('capability touched');}});
  const service = createMemberAuthorityService({stores: bad, signers: bad, claims: bad});
  assert.equal((await service.handle({}, {})).statusCode, 503); service.close();
  assert.deepEqual(Object.keys(service), ['handle', 'close']);
  assert.throws(() => createMemberAuthorityService({enabled: 'true'}), {message: 'alliance_member_service_unavailable'});
});
test('budgets reserve nonce then issuer time, with the signer nested instead of added twice', () => {
  assert.deepEqual(reviewMemberAuthorityBudgets(), MEMBER_AUTHORITY_BUDGETS);
  assert.equal(Object.isFrozen(reviewMemberAuthorityBudgets()), true);
  const input = {...tiny}, copy = reviewMemberAuthorityBudgets(input); input.issuer = 1; assert.equal(copy.issuer, 700);
  for (const patch of [{issuer: 8000}, {handler: 5501}, {nonce: 2001}, {signer: 1201}, {signer: 3000}, {reserve: 1001}, {extra: 1}, {nonce: 1.5}, {issuer: Infinity}]) {
    assert.throws(() => reviewMemberAuthorityBudgets({...MEMBER_AUTHORITY_BUDGETS, ...patch}), {message: 'alliance_member_service_unavailable'});
  }
});
test('real anchored issuers cross the signed transport using the explicit member budget plan', async () => {
  const f = fixture(); try {
    const client = f.client();
    assert.equal(JSON.parse(await client.readDecision(startup())).decision.state, 'review');
    assert.equal(JSON.parse(await client.readWitness(witness())).anchor.sequence, 0);
    assert.deepEqual(f.calls, {claims: 2, policy: 2, anchor: 4, tip: 2, records: 1, controlSign: 1, journalSign: 1});
  } finally {f.close();}
});
test('invalid budget plans and cross-purpose keys are refused before any signing', () => {
  const f = fixture(); try {
    assert.throws(() => createMemberAuthorityService({...f.input, budgets: {...MEMBER_AUTHORITY_BUDGETS, issuer: 8000}}));
    assert.throws(() => createMemberAuthorityService({...f.input, binding: {...f.input.binding, journalVerificationKey: f.input.binding.controlVerificationKey}}));
    assert.equal(f.calls.claims, 0); assert.equal(f.calls.controlSign, 0);
  } finally {f.close();}
});
test('a late uncertain nonce completion cannot dispatch an issuer or admit another request', async () => {
  const wait = deferred(), f = fixture({budgets: tiny, claim: () => wait.promise});
  try {
    await refuse(f.client().readDecision(startup()));
    assert.equal(f.calls.claims, 1); assert.equal(f.calls.policy, 0);
    wait.resolve(true); await tick();
    await refuse(f.client().readDecision(startup()));
    assert.equal(f.calls.claims, 1); assert.equal(f.calls.policy, 0);
  } finally {f.close();}
});
test('signer timeout quarantines the host and a late signature cannot trigger a final read', async () => {
  const wait = deferred(); let lateSignature;
  const f = fixture({budgets: tiny, controlSign: (bytes, o, pair) => {lateSignature = sign(null, bytes, pair.privateKey); return wait.promise;}});
  try {
    await refuse(f.client().readDecision(startup()));
    assert.equal(f.calls.policy, 1); assert.equal(f.calls.controlSign, 1);
    wait.resolve(lateSignature); await tick();
    await refuse(f.client().readDecision(startup()));
    assert.equal(f.calls.policy, 1); assert.equal(f.calls.claims, 1);
  } finally {f.close();}
});
test('outer issuer deadline cancels a stalled journal read before any signing', async () => {
  const wait = deferred(), f = fixture({budgets: tiny, journalRead: () => wait.promise});
  try {
    await refuse(f.client().readWitness(witness()));
    assert.equal(f.calls.records, 1); assert.equal(f.calls.journalSign, 0); assert.equal(f.calls.tip, 1);
    wait.resolve([]); await tick();
    await refuse(f.client().readWitness(witness()));
    assert.equal(f.calls.claims, 1); assert.equal(f.calls.journalSign, 0); assert.equal(f.calls.tip, 1);
  } finally {f.close();}
});
test('wrong signer purpose cannot produce a verified control decision', async () => {
  const f = fixture({controlSign: (bytes, o, control, journal) => sign(null, bytes, journal.privateKey)});
  try {await refuse(f.client().readDecision(startup())); assert.equal(f.calls.controlSign, 1); assert.equal(f.calls.policy, 1);}
  finally {f.close();}
});
test('service closure during nonce admission aborts the stage and prevents late dispatch', async () => {
  const wait = deferred(), entered = deferred(); let claimSignal;
  const f = fixture({claim: (q, {signal}) => {claimSignal = signal; entered.resolve(); return wait.promise;}});
  try {
    const pending = f.client().readDecision(startup()); await entered.promise; f.service.close();
    await refuse(pending); assert.equal(claimSignal.aborted, true);
    wait.resolve(true); await tick(); assert.equal(f.calls.policy, 0); assert.equal(f.calls.claims, 1);
  } finally {f.close();}
});
test('provider diagnostics remain unavailable and are never reflected in the reply', async () => {
  const f = fixture({claim: () => {throw Error('PRIVATE_PROVIDER_DETAIL');}});
  try {await refuse(f.client().readDecision(startup())); assert.equal(f.calls.policy, 0);}
  finally {f.close();}
});
