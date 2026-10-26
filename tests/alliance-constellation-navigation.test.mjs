import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

// Run the complete demo entry against a DOM fixture. These assertions cover
// event-to-focus behavior, not browser layout or physical-device acceptance.
function fixture({reducedMotion = false, width = 1200} = {}) {
  let document;
  const decode = value => value.replace(/&(?:amp|lt|gt|quot|#39);/g,
    entity => ({'&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'"})[entity]);
  class Element {
    constructor(tag) {
      this.tag = tag.toLowerCase();
      this.attributes = {};
      this.dataset = {};
      this.children = [];
      this.text = '';
      this.hidden = false;
      this.scrolls = [];
      this.classList = {
        toggle: (name, enabled) => {
          const names = new Set(this.className.split(/\s+/).filter(Boolean));
          if (enabled ?? !names.has(name)) names.add(name); else names.delete(name);
          this.className = [...names].join(' ');
        },
        add: name => this.classList.toggle(name, true),
        remove: name => this.classList.toggle(name, false)
      };
    }
    setAttribute(name, value) {
      this.attributes[name] = String(value);
      if (name.startsWith('data-')) this.dataset[name.slice(5)] = String(value);
      if (name === 'hidden') this.hidden = true;
    }
    getAttribute(name) { return this.attributes[name] ?? null; }
    removeAttribute(name) { delete this.attributes[name]; }
    get id() { return this.attributes.id; }
    get className() { return this.attributes.class ?? ''; }
    set className(value) { this.attributes.class = value; }
    get value() {
      if (this.explicitValue !== undefined) return this.explicitValue;
      if (this.tag === 'select') return descendants(this).find(n => n.tag === 'option')?.value ?? '';
      return this.attributes.value ?? (this.tag === 'option' ? this.textContent : '');
    }
    set value(value) { this.explicitValue = value; }
    append(...children) { this.children.push(...children); }
    contains(target) { return this === target || this.children.some(n => n.contains(target)); }
    replaceChildren(...children) {
      if (this.children.some(n => n.contains(document?.activeElement))) document.activeElement = document.body;
      this.children = children;
      this.text = '';
    }
    set textContent(value) { this.replaceChildren(); this.text = String(value); }
    get textContent() { return this.text + this.children.map(n => n.textContent).join(''); }
    set innerHTML(value) { this.replaceChildren(...parse(value).children); }
    focus(options) { document.activeElement = this; this.focusOptions = options; }
    scrollIntoView(options) { this.scrolls.push(options); }
  }
  const descendants = node => node.children.flatMap(child => [child, ...descendants(child)]);
  function parse(html) {
    const root = new Element('root'), stack = [root];
    const voids = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
    for (const token of html.match(/<[^>]+>|[^<]+/g) ?? []) {
      if (token.startsWith('<!')) continue;
      if (token.startsWith('</')) {
        const tag = token.slice(2, -1).trim().toLowerCase();
        for (let i = stack.length - 1; i > 0; i--) {
          if (stack[i].tag === tag) { stack.length = i; break; }
        }
      } else if (token.startsWith('<')) {
        const tag = token.match(/^<([\w-]+)/)?.[1];
        if (!tag) continue;
        const node = new Element(tag);
        const attributes = token.slice(tag.length + 1).replace(/\/?\s*>$/, '');
        for (const match of attributes.matchAll(/([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s=<>]+)))?/g)) {
          node.setAttribute(match[1], decode(match[2] ?? match[3] ?? match[4] ?? ''));
        }
        stack.at(-1).append(node);
        if (!voids.has(node.tag) && !token.endsWith('/>')) stack.push(node);
      } else {
        const node = new Element('#text'); node.text = decode(token); stack.at(-1).append(node);
      }
    }
    return root;
  }
  const root = parse(readFileSync(new URL('../alliance-constellation-preview.html', import.meta.url), 'utf8'));
  const all = () => descendants(root);
  const matches = (node, selector) => {
    const match = selector.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/);
    return match && node.getAttribute(match[1]) !== null && (match[2] === undefined || node.getAttribute(match[1]) === match[2]);
  };
  document = {
    body: all().find(n => n.tag === 'body'),
    getElementById: id => all().find(n => n.id === id),
    querySelectorAll: selector => all().filter(n => matches(n, selector)),
    querySelector: selector => all().find(n => matches(n, selector)),
    createElement: tag => new Element(tag),
    createElementNS: (_, tag) => new Element(tag)
  };
  document.activeElement = document.body;
  const window = {
    innerWidth: width,
    matchMedia: query => ({matches: query.includes('reduced-motion') ? reducedMotion : width <= 600}),
    addEventListener() {}
  };
  runInNewContext(readFileSync(new URL('../assets/federation/constellation/constellation.mjs', import.meta.url), 'utf8'),
    {document, window, Intl, URL, setTimeout: () => 0, clearTimeout() {}});
  const get = id => document.getElementById(id);
  const find = (attribute, value) => document.querySelector(`[${attribute}="${value}"]`);
  return {document, get, find};
}

test('Enter and Space on a map bubble reach its profile after the SVG node is replaced', () => {
  for (const key of ['Enter', ' ']) {
    const f = fixture(), bubble = f.find('data-member', 'sample-0');
    bubble.focus();
    let prevented = false;
    bubble.onkeydown({key, preventDefault() { prevented = true; }});
    assert.equal(prevented, true);
    assert.notEqual(f.find('data-member', 'sample-0'), bubble);
    assert.match(f.get('profile').textContent, /Mira Vale/);
    assert.equal(f.document.activeElement?.id, 'profile');
    assert.deepEqual({...f.get('profile').focusOptions}, {preventScroll: true});
    assert.deepEqual({...f.get('profile').scrolls.at(-1)}, {behavior: 'smooth', block: 'nearest'});
  }
});

test('bubble and member-list activation each reveal the same profile once', () => {
  for (const attribute of ['data-member', 'data-select']) {
    const f = fixture({width: 390});
    f.find(attribute, 'sample-5').onclick();
    assert.match(f.get('profile').textContent, /Rhea North/);
    assert.equal(f.document.activeElement?.id, 'profile');
    assert.equal(f.get('profile').scrolls.length, 1);
  }
});

test('profile reveal respects the reduced-motion preference', () => {
  const f = fixture({reducedMotion: true});
  f.find('data-member', 'sample-2').onclick();
  assert.deepEqual({...f.get('profile').scrolls.at(-1)}, {behavior: 'instant', block: 'nearest'});
});

test('crew selection and its toggle keep focus on the replacement crew control', () => {
  const f = fixture();
  let crew = f.find('data-team', 'NOVA');
  for (const expected of ['true', 'false']) {
    crew.focus(); crew.onclick();
    const replacement = f.find('data-team', 'NOVA');
    assert.notEqual(replacement, crew);
    assert.equal(replacement.getAttribute('aria-pressed'), expected);
    assert.equal(f.document.activeElement === replacement, true);
    crew = replacement;
  }
});

test('typing a search updates results without moving focus or scrolling to a profile', () => {
  const f = fixture(), search = f.get('search');
  search.focus(); search.value = 'Mira'; search.oninput({target: search});
  assert.equal(f.document.activeElement?.id, 'search');
  assert.equal(f.get('map-count').textContent, '1 sample member');
  assert.equal(f.get('profile').scrolls.length, 0);
  search.value = 'no matching member'; search.oninput({target: search});
  assert.equal(f.document.activeElement?.id, 'search');
  assert.match(f.get('profile').textContent, /No matching members/);
  f.get('clear-filters').onclick();
  assert.equal(f.document.activeElement?.id, 'search');
  assert.equal(f.get('map-count').textContent, '32 sample members');
});
