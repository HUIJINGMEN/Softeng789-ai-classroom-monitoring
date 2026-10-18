const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const root = path.join(__dirname, '..');
const options = { bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic',
  define: { 'import.meta.env': '{}' }, loader: { '.css': 'empty' } };
const code = buildSync({ ...options, entryPoints: [path.join(root, 'src/features/payments/useManualPaymentQueue.ts')],
  external: ['react', './api/manualPayments', '../../lib/apiClient'] }).outputFiles[0].text;
function harness() {
  const values = [], effects = [], pendingEffects = [], requests = [];
  let cursor = 0;
  class ApiError extends Error { constructor(message, status) { super(message); this.status = status; } }
  const react = {
    useState(initial) { const i = cursor++; if (!(i in values)) values[i] = initial;
      return [values[i], value => { values[i] = typeof value === 'function' ? value(values[i]) : value; }]; },
    useEffect(fn, deps) { const i = cursor++, old = effects[i];
      if (!old || deps.some((value, n) => !Object.is(value, old.deps[n])))
        pendingEffects.push(() => { old?.cleanup?.(); effects[i] = { deps, cleanup: fn() }; });
    }
  };
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, AbortController, require(id) {
    if (id === 'react') return react;
    if (id === './api/manualPayments') return { listPendingManualPayments: (page, size, studentId, signal) =>
      new Promise((resolve, reject) => requests.push({ page, size, studentId, signal, resolve, reject })) };
    return { ApiError, apiMessage: cause => cause.message };
  } });
  return { requests, ApiError,
    render(refresh = 0, student = '') { cursor = 0; const state = module.exports.useManualPaymentQueue(refresh, student);
      pendingEffects.splice(0).forEach(fn => fn()); return state; },
    unmount() { effects.forEach(effect => effect?.cleanup?.()); }
  };
}
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
function page(index = 0, total = 101, studentId = 'student') {
  const count = Math.max(0, Math.min(10, total - index * 10));
  return { pendingCount: total, page: { page: index, size: 10, totalItems: total, totalPages: Math.ceil(total / 10),
    hasPrevious: index > 0, hasNext: (index + 1) * 10 < total,
    items: Array.from({ length: count }, (_, i) => ({ id: `payment-${index * 10 + i}`, studentId })) } };
}
test('queue can reach the 101st payment through server pages, without loading all records', async () => {
  const h = harness(); assert.equal(h.render().loading, true); h.requests[0].resolve(page()); await flush();
  assert.equal(h.render().data.pendingCount, 101); h.render().setPage(10);
  assert.equal(h.render().data, null); assert.equal(h.requests[1].page, 10); assert.equal(h.requests[1].size, 10);
  h.requests[1].resolve(page(10)); await flush(); assert.equal(h.render().data.page.items[0].id, 'payment-100'); h.unmount();
});
test('filter applies before pagination, changing scope hides previous rows and aborts obsolete reads', async () => {
  const h = harness(); h.render(0, 'ana'); assert.equal(h.requests[0].studentId, 'ana');
  h.requests[0].resolve(page(0, 101, 'ana')); await flush(); h.render(0, 'ana').setPage(10); h.render(0, 'ana');
  assert.equal(h.render(0, 'maia').data, null); assert.equal(h.requests[1].signal.aborted, true);
  assert.equal(h.requests[2].studentId, 'maia'); assert.equal(h.requests[2].page, 0);
  h.requests[1].resolve(page(10, 101, 'ana')); await flush(); assert.equal(h.render(0, 'maia').data, null);
  h.requests[2].resolve(page(0, 1, 'maia')); await flush();
  h.render(0, 'maia').showAll(); h.render(0, 'maia'); assert.equal(h.requests[3].studentId, ''); h.unmount();
});
test('failed refresh never claims an empty queue or exposes stale review actions; retry restores data', async () => {
  const h = harness(); h.render(); h.requests[0].resolve(page()); await flush();
  h.render().reload(); assert.equal(h.render().data, null);
  h.requests[1].reject(new Error('Failed to fetch')); await flush();
  const failed = h.render(); assert.equal(failed.loading, false); assert.equal(failed.data, null);
  assert.equal(failed.error, 'Could not load pending payments. Check your connection and retry.');
  failed.reload(); h.render(); assert.equal(h.render().error, ''); assert.equal(h.render().loading, true);
  h.requests[2].resolve(page(0, 0)); await flush(); assert.equal(h.render().data.pendingCount, 0); h.unmount();
});
test('after the last item is reviewed the queue returns to the last valid page, with no false empty flash', async () => {
  const h = harness(); h.render(); h.requests[0].resolve(page()); await flush();
  h.render().setPage(10); h.render(); h.requests[1].resolve(page(10)); await flush();
  h.render().reload(); h.render(); h.requests[2].resolve(page(10, 100)); await flush();
  assert.equal(h.render().loading, true); assert.equal(h.render().data, null); assert.equal(h.requests[3].page, 9);
  h.requests[3].resolve(page(9, 100)); await flush(); assert.equal(h.render().data.page.page, 9); h.unmount();
});
test('queue reads cancel on unmount and API forwards page, student filter and cancellation', async () => {
  const h = harness(); h.render(); h.unmount(); assert.equal(h.requests[0].signal.aborted, true);
  h.requests[0].resolve(page()); await flush();
  const apiCode = buildSync({ ...options, entryPoints: [path.join(root, 'src/features/payments/api/manualPayments.ts')],
    external: ['../../../lib/apiClient'] }).outputFiles[0].text;
  const calls = [], module = { exports: {} };
  vm.runInNewContext(apiCode, { module, exports: module.exports, URLSearchParams, require: () => ({
    request: (url, init) => { calls.push({ url, init }); return Promise.resolve({}); }
  }) });
  const signal = new AbortController().signal;
  await module.exports.listPendingManualPayments(10, 10, 'ana', signal);
  const params = new URL(calls[0].url, 'http://localhost').searchParams;
  assert.equal(params.get('page'), '10'); assert.equal(params.get('studentId'), 'ana'); assert.equal(calls[0].init.signal, signal);
});
test('queue UI uses the same Auckland timestamp as review details and exposes pagination and error recovery', () => {
  let queue;
  const output = buildSync({ ...options, entryPoints: [path.join(root, 'src/features/payments/components/ManualPaymentAdminPanel.tsx')],
    external: ['react', 'react-dom', 'react/jsx-runtime', '../useManualPaymentQueue'] }).outputFiles[0].text;
  const loaded = new Module(__filename, module); loaded.paths = module.paths;
  const baseRequire = loaded.require.bind(loaded);
  loaded.require = id => id === '../useManualPaymentQueue' ? { useManualPaymentQueue: () => queue } : baseRequire(id);
  loaded._compile(output, __filename);
  const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
  const render = () => renderToStaticMarkup(React.createElement(loaded.exports.default, { refreshToken: 0, onReviewed() {} }));
  const data = page(); data.page.items = [{ id: 'payment', studentName: 'Maia', invoiceTitle: 'Lessons', method: 'CASH',
    amount: 25, currency: 'NZD', submittedAt: '2026-10-10T19:45:00Z' }];
  queue = { data, loading: false, error: '', studentId: '', setPage() {}, reload() {}, showAll() {} };
  let html = render(); assert(html.includes('11 Oct 2026')); assert(html.includes('NZDT'));
  assert(html.includes('Showing 1–10 of 101 pending payments')); assert(html.includes('aria-label="Page 11"'));
  queue = { ...queue, data: null, error: 'Could not load pending payments.' };
  html = render(); assert(html.includes('role="alert"')); assert(html.includes('>Retry<')); assert(!html.includes('No payments waiting'));
  queue = { ...queue, loading: true, error: '' };
  html = render(); assert.match(html, /<output>Loading pending payments…<\/output>/);
  assert(!html.includes('<output role="status"'));
  queue = { ...queue, loading: false };
  html = render(); assert(html.includes('No payments waiting'));
});
