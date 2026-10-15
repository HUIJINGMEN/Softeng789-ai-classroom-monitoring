const assert = require('node:assert/strict');
const { join } = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { buildSync } = require('esbuild');

const code = buildSync({ entryPoints: [join(__dirname, '../src/hooks/useMediaQuery.ts')],
  bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'] }).outputFiles[0].text;

function eventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
    emit(type) { for (const listener of listeners.get(type) || []) listener(); },
    listenerCount() { return [...listeners.values()].reduce((sum, group) => sum + group.size, 0); }
  };
}

function mount() {
  const media = { ...eventTarget(), matches: false };
  const print = { ...eventTarget(), matches: false };
  const frames = new Map();
  let frameId = 0, cleanup;
  const states = [];
  const browser = { ...eventTarget(), matchMedia: query => query === 'print' ? print : media,
    requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame: id => frames.delete(id) };
  const module = { exports: {} };
  const react = { useState: initial => [initial(), value => states.push(value)], useEffect: effect => { cleanup = effect(); } };
  vm.runInNewContext(code, { module, exports: module.exports, require: name => {
    assert.equal(name, 'react'); return react;
  }, window: browser });
  assert.equal(module.exports.useMediaQuery('(max-width: 760px)'), false);
  return { media, print, browser, states, frames, cleanup: () => cleanup(),
    flush: () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()); } };
}

test('normal screen resize still updates the responsive layout', () => {
  const view = mount(); view.media.matches = true; view.media.emit('change');
  assert.deepEqual(view.states, [false, true]); view.cleanup();
});

test('print paper width cannot change layout or unmount an open report', () => {
  const view = mount(); view.browser.emit('beforeprint'); view.print.matches = true;
  view.media.matches = true; view.media.emit('change');
  assert.deepEqual(view.states, [false]);
  view.print.matches = false; view.print.emit('change'); view.browser.emit('afterprint');
  // The print width may still be active inside afterprint; wait until screen layout returns.
  assert.deepEqual(view.states, [false]);
  view.media.matches = false; view.flush();
  assert.deepEqual(view.states, [false, false]); view.cleanup();
});

test('print media guards updates even before beforeprint fires and cleans up listeners and frames', () => {
  const view = mount(); view.print.matches = true;
  view.media.matches = true; view.media.emit('change');
  assert.deepEqual(view.states, [false]);
  view.print.emit('change'); view.print.matches = false; view.print.emit('change');
  assert.equal(view.frames.size, 1); view.cleanup(); view.flush();
  assert.equal(view.frames.size, 0);
  assert.equal(view.media.listenerCount() + view.print.listenerCount() + view.browser.listenerCount(), 0);
  assert.deepEqual(view.states, [false]);
});
