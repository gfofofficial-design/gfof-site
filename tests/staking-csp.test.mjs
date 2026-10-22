import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../staking.html', import.meta.url), 'utf8');
const policy = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
const digest = value => createHash('sha256').update(value).digest('base64');

test('only the exact calculator script is authorized', () => {
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0][1], '');
  assert.ok(policy.includes(`script-src 'sha256-${digest(scripts[0][2])}'`));
  assert.ok(!policy.includes("'unsafe-inline'"));
  assert.ok(!policy.includes("'unsafe-eval'"));
  assert.ok(!policy.includes("script-src 'self'"));
  assert.ok(!policy.includes(digest(scripts[0][2] + '\nalert(1)')));
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
