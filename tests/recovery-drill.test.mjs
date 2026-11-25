import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {recoveryCases} from '../assets/federation/fed-recovery-drill-cases.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const page = read('recovery-drill.html');

test('every visible case has two complete decisions and a source', () => {
  const caseButtons = [...page.matchAll(/data-case="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(caseButtons, ['lost-phone', 'missed-check-in', 'family']);
  assert.deepEqual(caseButtons, Object.keys(recoveryCases));
  for (const item of Object.values(recoveryCases)) {
    assert.match(item.source.href, /^https:\/\//);
    assert.equal(item.decisions.length, 2);
    assert.ok(item.decisions[1].update);
    assert.ok(item.finish);
    for (const {choices, correct, question} of item.decisions) {
      assert.ok(question);
      assert.equal(choices.length, 3);
      assert.ok(Number.isInteger(correct) && choices[correct]);
      assert.equal(new Set(choices.map(choice => choice[0])).size, 3);
      assert.ok(choices.every(([label, explanation]) => label && explanation));
    }
  }
});

test('the loss, missed-check-in and estate examples start from their own authority', () => {
  const firstAnswer = item => item.decisions[0].choices[item.decisions[0].correct][0];
  assert.match(firstAnswer(recoveryCases['lost-phone']), /official restoration guide/);
  assert.match(firstAnswer(recoveryCases['missed-check-in']), /situation is still unknown/);
  assert.match(firstAnswer(recoveryCases.family), /official estate guidance/);
  const challenge = recoveryCases['missed-check-in'].decisions[1];
  assert.match(challenge.choices[challenge.correct][0], /designated guardian/);
});

test('the practice keeps real inputs off the page and leaves guides and a checklist available', () => {
  assert.match(page, /connect-src 'none'.*form-action 'none'/);
  assert.match(page, /id="recovery-app" hidden/);
  assert.match(page, /id="recovery-fallback"/);
  assert.doesNotMatch(page, /<input\b|<textarea\b/);
  assert.match(page, /href="\/assets\/federation\/wallet-recovery-checklist\.txt" download/);
  assert.match(read('assets/federation/wallet-recovery-checklist.txt'), /PINs, and backup shares in their own secure/);
  assert.doesNotMatch(read('assets/federation/fed-recovery-drill.mjs'), /\bfetch\s*\(|localStorage|sessionStorage|\.innerHTML/);
  for (const file of ['learn.html', 'command-deck.html']) assert.match(read(file), /href="\/recovery-drill"/);
});
