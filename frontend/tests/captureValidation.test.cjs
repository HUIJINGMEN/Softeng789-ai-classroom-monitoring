const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const { buildSync } = require('esbuild');
const code = buildSync({ entryPoints: [path.join(__dirname, '../src/hooks/useCaptureValidation.ts')],
  bundle: true, write: false, platform: 'node', format: 'cjs', external: ['react', '../lib/apiClient'] }).outputFiles[0].text;
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

function harness() {
  const state = [], requests = [], timers = new Map(); let cursor = 0, cleanup;
  const react = {
    useRef(initial) { const i = cursor++; return state[i] ??= { current: initial }; },
    useState(initial) { const i = cursor++; if (!(i in state)) state[i] = initial;
      return [state[i], value => { state[i] = value; }]; },
    useEffect(effect) { cursor++; if (!cleanup) cleanup = effect(); }
  };
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, AbortController, FormData, Blob,
    fetch: async () => ({ blob: async () => new Blob(['synthetic']) }),
    window: { setTimeout(fn) { const key = Symbol(); timers.set(key, fn); return key; }, clearTimeout(id) { timers.delete(id); } },
    require(name) {
      if (name === 'react') return react;
      if (name === '../lib/apiClient') return { apiMessage: e => e.message,
        request: (url, init) => new Promise((resolve, reject) => {
          requests.push({ url, init, resolve, reject });
          init.signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true });
        }) };
      throw new Error(name);
    }
  });
  return { requests, timers, unmount: () => cleanup(), render() {
    cursor = 0; return module.exports.useCaptureValidation('/api/auth/registration-capture-check', 'notice');
  } };
}

test('a rejected capture is not accepted; a retry clears the rejected preview and sends consent', async () => {
  const h = harness(); let result = h.render().check('photo-1'); await flush();
  assert.equal(h.requests[0].init.body.get('consentGiven'), 'true');
  assert.equal(h.requests[0].init.body.get('noticeVersion'), 'notice');
  h.requests[0].resolve({ accepted: false, reasons: ['NO_FACE'], message: 'No face' });
  assert.equal(await result, false); assert.equal(h.render().rejectedPhoto, 'photo-1');
  result = h.render().check('photo-2'); await flush();
  assert.equal(h.render().rejectedPhoto, '');
  h.requests[1].resolve({ accepted: true, reasons: [], message: 'Passed' });
  assert.equal(await result, true); assert.equal(h.render().checking, false);
});

test('cancel or unmount discards late success and cancellation permits a fresh request', async () => {
  for (const unmount of [false, true]) {
    const h = harness(); const pending = h.render().check('old-photo'); await flush();
    if (unmount) h.unmount(); else h.render().cancel();
    h.requests[0].resolve({ accepted: true, reasons: [], message: 'Passed' });
    assert.equal(await pending, false); assert(h.requests[0].init.signal.aborted);
    if (!unmount) {
      const next = h.render().check('new-photo'); await flush();
      h.requests[1].resolve({ accepted: true, reasons: [], message: 'Passed' }); assert.equal(await next, true);
    }
  }
});

test('timeout and malformed service response never count as successful capture', async () => {
  const h = harness(); let pending = h.render().check('photo'); await flush();
  for (const timeout of h.timers.values()) timeout();
  assert.equal(await pending, false); assert.match(h.render().error, /timed out/);
  pending = h.render().check('photo'); await flush();
  h.requests[1].resolve({ accepted: true, reasons: ['NO_FACE'], message: 'Contradiction' });
  assert.equal(await pending, false); assert.match(h.render().error, /invalid result/);
});
