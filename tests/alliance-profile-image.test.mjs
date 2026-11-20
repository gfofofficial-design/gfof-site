import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mountAllianceAccountMemberPage } from '../assets/federation/fed-alliance-member-account.mjs';
import { profileImageHeaders, profileImagePath, profileImageStatePath, profileImageContentPath,
  profileImageInputLimit, profileImageOutputLimit } from '../assets/federation/fed-alliance-profile-image-contract.mjs';
import { AVATAR_LIMITS } from '../lib/alliance-avatar-runtime/limits.mjs';
import { memberHttpFixture, fields, origin, operation } from './alliance-member-http.fixture.mjs';
import { profileDocument } from './alliance-profile-document.fixture.mjs';

const workspace = readFileSync(new URL('../member-workspace.html', import.meta.url), 'utf8');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWMQjG34DwADXwHuQa7szAAAAABJRU5ErkJggg==', 'base64');
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

function editor(t, fetcher, options = {}) {
  const { doc, get } = profileDocument(workspace);
  const view = get('image-preview');
  const input = get('image-file');
  const draws = [];
  const channel = new EventTarget();
  channel.close = () => {};
  view.getContext = () => ({ drawImage: bitmap => draws.push(bitmap.bytes) });
  get('member-surface').append(get('image'), get('image-file'), view, get('image-load'), get('image-save'));
  Object.defineProperty(input, 'value', { set(value) { if (value === '') this.files = []; } });
  let next = 200;
  const page = mountAllianceAccountMemberPage(doc, { origin, enabled: true, imageEnabled: true,
    events: new EventTarget(), createChannel: () => channel, fetcher,
    imageOptions: {
      makeOperationId: () => operation(++next),
      decode: async blob => ({ width: 1, height: 1, bytes: Buffer.from(await blob.arrayBuffer()), close() {} }),
      ...options,
    },
  });
  t.after(() => page.dispose());
  return { doc, get, page, draws,
    click: id => get('image-' + id).emit('click'),
    async choose(bytes = png, type = 'image/png') {
      input.files = [new File([bytes], 'fictional-upload', { type })];
      await input.emit('change');
    },
    signOut: () => channel.dispatchEvent(new MessageEvent('message', { data: { type: 'signed-out', remoteRevoked: true } })),
  };
}

async function saveText(ui, name = fields().name) {
  assert.equal(await ui.page.check(), true);
  await ui.get('read').emit('click');
  for (const [field, value] of Object.entries({ ...fields(), name })) {
    const element = ui.get(field);
    if (typeof value === 'boolean') element.checked = value;
    else element.value = value;
    await element.emit('input');
  }
  await ui.get('form').emit('submit');
}

function imageRequest(fixture, path, { profileId, version, op, method = 'GET', body, headers } = {}) {
  return new Request(origin + path, { method, body, headers: {
    Cookie: '__Host-gf-access=' + fixture.token, Origin: origin, 'Sec-Fetch-Site': 'same-origin',
    [profileImageHeaders.profile]: profileId ?? fixture.profile?.id ?? operation(90),
    ...(version === undefined ? {} : { [profileImageHeaders.version]: String(version) }),
    ...(op === undefined ? {} : { [profileImageHeaders.operation]: op }), ...headers,
  } });
}

test('optional image uses the real workspace and authenticated adapters for add, reopen, replace and remove', async t => {
  const f = memberHttpFixture({ imageEnabled: true });
  t.after(() => f.close());
  const requests = [];
  const ui = editor(t, (endpoint, init) => {
    requests.push([new URL(endpoint).pathname, init.method]);
    return f.fetcher(endpoint, init);
  });
  assert.equal(ui.get('image').hidden, true);
  assert.equal(requests.length, 0);
  await saveText(ui);
  assert.equal(f.revision, 1);
  assert.equal(f.profile.name, fields().name);
  assert.equal(f.profile.listed, false);
  assert.equal(requests.some(([p]) => p.startsWith(profileImagePath)), false);
  assert.equal(ui.get('image-file').disabled, true);
  await ui.click('load');
  assert.match(ui.get('image-status').textContent, /no saved profile image/i);
  await ui.choose();
  await ui.click('save');
  assert.equal(ui.get('image-preview').hidden, false);
  assert.deepEqual(ui.draws, [png]);
  assert.equal(f.calls.filter(call => call === 'image-upload').length, 1);
  assert.equal(f.revision, 1);
  ui.page.dispose();

  const reopened = editor(t, f.fetcher);
  assert.equal(await reopened.page.check(), true);
  await reopened.get('read').emit('click');
  await reopened.click('load');
  assert.deepEqual(reopened.draws, [png]);
  assert.equal(reopened.get('image-preview').hidden, false);

  // A corrupt original is refused while the last verified photo and text stay visible.
  await reopened.choose(Buffer.alloc(png.length));
  await reopened.click('save');
  assert.match(reopened.get('image-status').textContent, /refused/i);
  assert.equal(reopened.get('image-preview').hidden, false);
  assert.equal(f.calls.filter(call => call === 'image-upload').length, 1);
  assert.equal(reopened.get('name').value, fields().name);
  await reopened.click('load');
  await reopened.choose();
  await reopened.click('save');
  // The same valid fixture bytes are written under a new operation and version.
  assert.equal(f.calls.filter(call => call === 'image-upload').length, 2);

  assert.equal(reopened.get('image-remove').getAttribute('aria-disabled'), 'true');
  reopened.get('image-confirm').checked = true;
  await reopened.get('image-confirm').emit('change');
  await reopened.click('remove');
  assert.match(reopened.get('image-status').textContent, /image removed/i);
  assert.equal(reopened.get('image-preview').hidden, true);
  assert.equal(reopened.get('image-preview').width, 1);
  assert.equal(f.revision, 1);
  assert.equal(f.profile.name, fields().name);
  assert.equal(f.journal.rows.at(-1).event.kind, 'image_remove_requested');
  const stale = await f.http.handle(imageRequest(f, profileImageContentPath, { version: 2 }));
  assert.notEqual(stale.headers.get('content-type'), 'image/png');
  assert.equal(stale.headers.get('cache-control'), 'private, no-store');
});

test('lost replacement response keeps the prior image and resolves by read-only operation status', async t => {
  const f = memberHttpFixture({ imageEnabled: true });
  t.after(() => f.close());
  let writes = 0;
  const ui = editor(t, async (endpoint, init) => {
    const result = await f.fetcher(endpoint, init);
    if (init.method === 'PUT' && ++writes === 2) {
      assert.equal((await result.json()).state, 'committed');
      throw new Error('fictional lost response');
    }
    return result;
  });
  await saveText(ui);
  await ui.click('load');
  await ui.choose(); await ui.click('save');
  ui.get('bio').value = 'A separate unsaved text edit.';
  await ui.get('bio').emit('input');
  await ui.choose(); await ui.click('save');
  assert.match(ui.get('image-status').textContent, /could not be confirmed/i);
  assert.equal(ui.get('image-preview').hidden, false);
  assert.equal(ui.get('image-file').disabled, true);
  assert.equal(ui.get('bio').value, 'A separate unsaved text edit.');
  await ui.click('save');
  assert.equal(writes, 2);
  await ui.click('load');
  assert.equal(writes, 2);
  assert.equal(f.calls.filter(call => call === 'image-status').length, 1);
  assert.equal(ui.draws.length, 2);
  assert.equal(ui.get('image-file').disabled, false);
});

test('sign-out and account switch discard a late image and reject a different profile binding', async t => {
  const owner = memberHttpFixture({ imageEnabled: true });
  const member = memberHttpFixture({ imageEnabled: true, identity: { actor: operation(10), session: operation(11), profileOffset: 100 } });
  t.after(() => { owner.close(); member.close(); });
  let active = owner, hold = false, lateClosed = 0;
  const decoding = deferred(), release = deferred();
  const ui = editor(t, (...args) => active.fetcher(...args), {
    decode: async blob => {
      if (hold) { decoding.resolve(); await release.promise; }
      return { width: 1, height: 1, bytes: Buffer.from(await blob.arrayBuffer()), close() { if (hold) lateClosed++; } };
    },
  });
  await saveText(ui, 'Fictional owner'); await ui.click('load'); await ui.choose();
  hold = true;
  const first = ui.click('save');
  await decoding.promise;
  ui.get('image-load').focus();
  ui.signOut();
  assert.equal(ui.get('image').hidden, true);
  assert.equal(ui.get('name').value, '');
  assert.equal(ui.get('image-file').files.length, 0);
  assert.equal(ui.doc.activeElement, ui.get('account-link'));
  active = member;
  await saveText(ui, 'Different test member');
  release.resolve(); await first; await tick();
  assert.equal(lateClosed, 1);
  assert.equal(ui.get('image-preview').hidden, true);
  assert.equal(ui.draws.length, 0);
  await ui.click('load');
  assert.match(ui.get('image-status').textContent, /no saved profile image/i);
  const before = member.calls.length;
  for (const [method, path, version] of [['GET', profileImageContentPath, 1], ['DELETE', profileImagePath, 1], ['PUT', profileImagePath, 0]]) {
    const response = await member.http.handle(imageRequest(member, path, { method, profileId: owner.profile.id, version,
      op: method === 'GET' ? undefined : operation(95), ...(method === 'PUT' ? { body: png, headers: { 'Content-Type': 'image/png' } } : {}) }));
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { state: 'profile_changed' });
  }
  assert.deepEqual(member.calls.slice(before), ['auth', 'auth', 'auth']);
  assert.equal(owner.profile.name, 'Fictional owner');
});

test('image routes stay closed by default and reject extra selectors, oversized bytes and cross-site requests', async t => {
  assert.equal(profileImageInputLimit, AVATAR_LIMITS.inputBytes);
  assert.equal(profileImageOutputLimit, AVATAR_LIMITS.outputBytes);
  const closed = memberHttpFixture(), open = memberHttpFixture({ imageEnabled: true });
  t.after(() => { closed.close(); open.close(); });
  assert.equal((await closed.http.handle(imageRequest(closed, profileImageStatePath))).status, 404);
  for (const [path, options, status] of [
    [profileImageStatePath + '?profile=foreign', {}, 404],
    [profileImageStatePath, { headers: { 'Sec-Fetch-Site': 'cross-site' } }, 403],
    [profileImageContentPath, { version: 0 }, 400],
    [profileImagePath, { method: 'PUT', version: 0, op: operation(96), body: Buffer.alloc(profileImageInputLimit + 1), headers: { 'Content-Type': 'image/png' } }, 400],
    [profileImagePath, { method: 'PUT', version: 0, op: operation(97), body: png, headers: { 'Content-Type': 'image/svg+xml' } }, 400],
    [profileImagePath, { method: 'DELETE', version: 1, op: operation(98), body: 'unexpected' }, 400],
  ]) assert.equal((await open.http.handle(imageRequest(open, path, options))).status, status);
  assert.deepEqual(closed.calls, []);
  assert.deepEqual(open.calls, []);
});
