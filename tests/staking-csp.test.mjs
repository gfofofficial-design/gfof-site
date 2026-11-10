import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../staking.html', import.meta.url), 'utf8');
const policy = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
const digest = value => createHash('sha256').update(value).digest('base64');

test('only the exact calculator and integrity-pinned copy control are authorized', () => {
  assert.equal(scripts.length, 2);
  const calculator = scripts.find(script => script[1] === '');
  const copy = scripts.find(script => script[1].includes('fed-copy-mint.js'));
  const copyHash = 'sha256-' + digest(readFileSync(new URL('../assets/federation/fed-copy-mint.js', import.meta.url)));
  assert.ok(copy[1].includes(`integrity="${copyHash}"`));
  assert.equal(copy[2], '');
  assert.ok(policy.includes(`script-src 'sha256-${digest(calculator[2])}' '${copyHash}'`));
  assert.ok(!policy.includes("'unsafe-inline'"));
  assert.ok(!policy.includes("'unsafe-eval'"));
  assert.ok(!policy.includes("script-src 'self'"));
  assert.ok(!policy.includes(digest(calculator[2] + '\nalert(1)')));
});

test('policy is parsed before active content and blocks unused capabilities', () => {
  assert.ok(html.indexOf('http-equiv="Content-Security-Policy"') < html.indexOf('<script'));
  for (const directive of ['script-src-attr', 'connect-src', 'frame-src', 'form-action', 'object-src', 'base-uri', 'worker-src']) {
    assert.ok(policy.includes(`${directive} 'none'`), directive);
  }
  assert.doesNotMatch(html, /\son\w+\s*=/i);
  assert.doesNotMatch(html, /<form\b|<iframe\b|<base\b/i);
});

test('current mint and all four proposed options remain present', () => {
  assert.ok(html.includes('Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV'));
  assert.deepEqual([...html.matchAll(/data-percent="(\d+)"/g)].map(m => Number(m[1])), [1, 3, 8, 12]);
  assert.ok(html.includes('DESIGN REVIEW · NO POOL OPEN'));
});
