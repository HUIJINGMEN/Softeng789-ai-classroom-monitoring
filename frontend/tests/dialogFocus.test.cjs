const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const path = require('node:path');
const { buildSync } = require('esbuild');
const code = buildSync({ entryPoints: [path.join(__dirname, '../src/hooks/useDialogFocus.ts')],
  bundle: true, write: false, platform: 'node', format: 'cjs', external: ['react'] }).outputFiles[0].text;

function harness() {
  const effects = [], frames = [], body = { dataset: {} };
  const document = { body, activeElement: null };
  class Element {
    constructor(tabIndex = 0, visible = true) { this.tabIndex = tabIndex; this.visible = visible; this.isConnected = true; }
    focus() { document.activeElement = this; }
    getClientRects() { return this.visible ? [{}] : []; }
    querySelectorAll() { return this.controls; }
    querySelector() { return this.preferred ?? null; }
  }
  const opener = new Element(); opener.focus();
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, document, HTMLElement: Element,
    window: { requestAnimationFrame(fn) { frames.push(fn); return frames.length; }, cancelAnimationFrame() {} },
    require: name => { assert.equal(name, 'react'); return { useRef: value => ({ current: value }), useEffect: effect => effects.push(effect) }; } });
  return { document, opener, Element,
    mount(onClose = () => {}, disabled = false) {
      const start = effects.length;
      const dialog = module.exports.useDialogFocus(onClose, disabled);
      const root = new Element(-1), first = new Element(), last = new Element();
      root.controls = [first, new Element(-1), new Element(0, false), last];
      dialog.ref.current = root;
      const cleanups = effects.slice(start).map(effect => effect()); frames.splice(0).forEach(fn => fn());
      return { ...dialog, root, first, last, close() { cleanups.forEach(fn => fn?.()); } };
    } };
}
function event(key, shiftKey = false) {
  return { key, shiftKey, prevented: false, preventDefault() { this.prevented = true; }, stopPropagation() {} };
}
test('dialog keyboard navigation ignores hidden/negative-tabindex controls and wraps in both directions', () => {
  const h = harness(), dialog = h.mount();
  assert.equal(h.document.activeElement, dialog.first);
  dialog.last.focus(); const forward = event('Tab'); dialog.onKeyDown(forward);
  assert(forward.prevented); assert.equal(h.document.activeElement, dialog.first);
  const backward = event('Tab', true); dialog.onKeyDown(backward);
  assert(backward.prevented); assert.equal(h.document.activeElement, dialog.last);
  dialog.root.focus(); dialog.onKeyDown(event('Tab', true)); assert.equal(h.document.activeElement, dialog.last);
  dialog.close(); assert.equal(h.document.activeElement, h.opener);
});
test('Escape respects blocked closing, and empty dialogs keep focus instead of leaking to the page', () => {
  const h = harness(); let closed = 0;
  const blocked = h.mount(() => closed++, true); blocked.onKeyDown(event('Escape')); assert.equal(closed, 0); blocked.close();
  const dialog = h.mount(() => closed++); dialog.onKeyDown(event('Escape')); assert.equal(closed, 1);
  dialog.root.controls = []; const key = event('Tab'); dialog.onKeyDown(key);
  assert(key.prevented); assert.equal(h.document.activeElement, dialog.root); dialog.close();
});
test('mobile sheets and standard modals share one nested scroll-lock owner', () => {
  const h = harness(), outer = h.mount(), inner = h.mount();
  assert.equal(h.document.body.dataset.modalScrollLock, 'true');
  outer.close(); assert.equal(h.document.body.dataset.modalScrollLock, 'true');
  inner.close(); assert.equal(h.document.body.dataset.modalScrollLock, undefined);
});
