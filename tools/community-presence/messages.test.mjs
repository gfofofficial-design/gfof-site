import assert from 'node:assert/strict';
import test from 'node:test';
import {createMessagePreview, MESSAGE_LIMIT} from './messages.mjs';

const members = ['explorer', 'artist', 'researcher'];

test('only participants can read a request and only the recipient can open replies', () => {
  const preview = createMessagePreview(members);
  const id = preview.request('explorer', 'artist', 'Hi! Want to talk about a joint event?');
  assert.deepEqual(preview.list('researcher'), []);
  assert.throws(() => preview.read('researcher', id), /unavailable/);
  assert.throws(() => preview.block('researcher', id), /unavailable/);
  assert.throws(() => preview.respond('explorer', id, 'accept'), /Only the recipient/);
  assert.throws(() => preview.reply('artist', id, 'Yes'), /after the request is accepted/);
  assert.equal(preview.read('artist', id).status, 'pending');

  preview.respond('artist', id, 'accept');
  preview.reply('artist', id, 'Yes, let’s compare dates.');
  preview.reply('explorer', id, 'How about next week?');
  const open = preview.read('explorer', id);
  assert.equal(open.status, 'active');
  assert.deepEqual(open.messages.map(message => message.author), ['explorer', 'artist', 'explorer']);
  assert.deepEqual(preview.list('artist'), [open]);
});

test('declining or blocking closes contact in both directions', () => {
  const preview = createMessagePreview(members);
  const declined = preview.request('explorer', 'artist', 'Can we talk?');
  preview.respond('artist', declined, 'decline');
  assert.equal(preview.read('explorer', declined).status, 'declined');
  assert.throws(() => preview.respond('artist', declined, 'accept'), /open request/);
  assert.throws(() => preview.reply('explorer', declined, 'Please respond.'), /closed/);

  const blocked = preview.request('explorer', 'researcher', 'Want to compare sources?');
  preview.respond('researcher', blocked, 'accept');
  preview.block('researcher', blocked);
  assert.equal(preview.read('explorer', blocked).status, 'closed');
  assert.throws(() => preview.reply('researcher', blocked, 'A reply'), /closed/);
  assert.throws(() => preview.reply('explorer', blocked, 'A reply'), /closed/);
  assert.throws(() => preview.request('researcher', 'explorer', 'A new request'), /already exists/);
  assert.throws(() => preview.request('explorer', 'researcher', 'A new request'), /already exists/);
});

test('requests validate both example recipients and bounded plain text', () => {
  const preview = createMessagePreview(members);
  assert.throws(() => preview.request('explorer', 'unknown', 'Hello'), /Choose an example member/);
  assert.throws(() => preview.request('explorer', 'explorer', 'Hello'), /Choose another member/);
  for (const body of ['  ', 'x'.repeat(MESSAGE_LIMIT + 1), 'a\u0000b', null]) {
    assert.throws(() => preview.request('explorer', 'artist', body), /Enter a message/);
  }
  assert.deepEqual(preview.list('explorer'), []);
  const id = preview.request('explorer', 'artist', '  Hello\nfrom the crew  ');
  assert.equal(preview.read('artist', id).messages[0].body, 'Hello\nfrom the crew');
  assert.throws(() => preview.request('artist', 'explorer', 'Hello back'), /already exists/);
  assert.throws(() => preview.respond('artist', id, 'invalid'), /Choose how to respond/);
  assert.equal(preview.read('artist', id).status, 'pending');
});

test('snapshots are isolated and resetting starts with an empty inbox', () => {
  const preview = createMessagePreview(members);
  const id = preview.request('explorer', 'artist', 'Hello');
  const projection = preview.read('artist', id);
  projection.messages[0].body = 'Edited';
  projection.messages.pop();
  projection.status = 'active';
  assert.equal(preview.read('artist', id).messages[0].body, 'Hello');
  assert.equal(preview.read('artist', id).status, 'pending');
  assert.deepEqual(createMessagePreview(members).list('artist'), []);
});
