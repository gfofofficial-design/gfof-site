import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const asset = name => readFileSync(new URL('../journey/voss-briefing.'+name, import.meta.url), 'utf8');
const html = asset('html');
const css = asset('css');

test('the first skip link targets a single heading that accepts native focus', () => {
  const target = html.match(/<a class="skip" href="#([^"]+)">Skip to the briefing<\/a>/)?.[1];
  assert.equal(target, 'mission-title');
  const headings = [...html.matchAll(/<h1\b([^>]*)>/g)].map(match => match[1]);
  assert.equal(headings.length, 1);
  assert.match(headings[0], /id="mission-title"/);
  assert.match(headings[0], /tabindex="-1"/);
});

test('each briefing stage accepts focus and keyboard-focused headings receive a visible outline', () => {
  for (const id of ['intro-title','routes-title','decision-title','result-title']) {
    assert.match(html, new RegExp('<h2(?=[^>]*id="'+id+'")(?=[^>]*tabindex="-1")[^>]*>'));
  }
  assert.match(css, /#mission-title:focus-visible,\s*\.mission-content h2:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--mint\)/);
  assert.doesNotMatch(css, /\.mission-content h2:focus\s*\{[^}]*outline:\s*none/);
});
