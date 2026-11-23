import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

function fixture() {
  const nodes = new Map();
  let document;
  function detach(node) {
    if (node.id && nodes.get(node.id) === node) nodes.delete(node.id);
    for (const child of node.children ?? []) detach(child);
  }
  class Element {
    constructor(tag) {
      this.tagName = tag.toUpperCase();
      this.children = [];
      this.attributes = new Map();
      this.events = new Map();
      this.value = '';
      this.checked = false;
      this.hidden = false;
      this._text = '';
    }
    set id(value) { this._id = value; nodes.set(value, this); }
    get id() { return this._id; }
    set textContent(value) { this._text = String(value); this.replaceChildren(); }
    get textContent() { return this._text + this.children.map(child => typeof child === 'string' ? child : child.textContent).join(''); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) {
      for (const child of this.children) detach(child);
      this.children = children;
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    removeAttribute(name) { this.attributes.delete(name); }
    addEventListener(type, listener) {
      if (!this.events.has(type)) this.events.set(type, []);
      this.events.get(type).push(listener);
    }
    async emit(type, extra = {}) {
      for (const listener of this.events.get(type) ?? []) {
        await listener({target: this, preventDefault() {}, ...extra});
      }
    }
    focus() { document.activeElement = this; }
  }
  document = {activeElement: null, createElement: tag => new Element(tag), getElementById: id => nodes.get(id) ?? null};
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  for (const match of html.matchAll(/<([a-z][a-z0-9-]*)\b[^>]*\bid="([^"]+)"/gi)) {
    const element = new Element(match[1]);
    element.id = match[2];
  }
  const get = id => document.getElementById(id);
  async function select(name) {
    const control = get('actor');
    const option = control.children.find(node => node.textContent === name + ' · fictional');
    assert.ok(option, 'The example member must be available in the actual page controls.');
    control.focus();
    control.value = option.value;
    await control.emit('change');
  }
  return {document, get, select};
}

test('switching or resetting examples clears the previous member validation and drafts', async t => {
  const f = fixture();
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {value: f.document, configurable: true});
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else delete globalThis.document;
  });
  await import(new URL('./page.mjs?validation-reset-test', import.meta.url));

  await f.select('Aster');
  const accept = f.get('challenge-actions').children.find(node => node.textContent === 'Accept example invitation');
  assert.ok(accept);
  await accept.emit('click');
  f.get('proof').value = 'x';
  await f.get('proof-form').emit('submit');
  assert.equal(f.get('proof').getAttribute('aria-invalid'), 'true');
  assert.equal(f.document.activeElement, f.get('proof'));

  await f.select('Preview Explorer');
  assert.equal(f.get('proof').value, '');
  assert.equal(f.get('proof').getAttribute('aria-invalid'), null);
  assert.equal(f.document.activeElement, f.get('actor'));

  f.get('name').value = 'x';
  await f.get('profile').emit('submit');
  assert.equal(f.get('name').getAttribute('aria-invalid'), 'true');
  assert.equal(f.get('name').getAttribute('aria-describedby'), 'profile-status');
  await f.select('Aster');
  assert.equal(f.get('name').value, 'Aster');
  assert.equal(f.get('name').getAttribute('aria-invalid'), null);
  assert.equal(f.get('name').getAttribute('aria-describedby'), null);
  assert.equal(f.get('profile-status').textContent, '');

  f.get('proof').value = 'x';
  await f.get('proof-form').emit('submit');
  f.get('name').value = 'x';
  await f.get('profile').emit('submit');
  await f.get('reset').emit('click');
  assert.equal(f.get('member-name').textContent, 'Preview Explorer');
  assert.equal(f.get('proof').value, '');
  assert.equal(f.get('proof').getAttribute('aria-invalid'), null);
  assert.equal(f.get('name').getAttribute('aria-describedby'), null);
  assert.equal(f.document.activeElement, f.get('actor'));
});
