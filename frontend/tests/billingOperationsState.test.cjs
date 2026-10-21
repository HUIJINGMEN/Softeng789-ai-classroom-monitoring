const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const { buildSync } = require('esbuild');

const code = buildSync({
  entryPoints: [path.join(__dirname, '../src/features/payments/useBillingOperations.ts')],
  bundle: true, write: false, platform: 'node', format: 'cjs',
  external: ['react', './api', '../../lib/apiClient']
}).outputFiles[0].text;

function harness() {
  const values = [], effects = [], queued = [], requests = [];
  let cursor = 0;
  const changed = (before, after) => !before || after.some((value, i) => !Object.is(value, before[i]));
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in values)) values[i] = typeof initial === 'function' ? initial() : initial;
      return [values[i], next => { values[i] = typeof next === 'function' ? next(values[i]) : next; }];
    },
    useRef(initial) { const i = cursor++; return values[i] ?? (values[i] = { current: initial }); },
    useMemo(fn, deps) {
      const i = cursor++;
      if (changed(values[i]?.deps, deps)) values[i] = { deps, value: fn() };
      return values[i].value;
    },
    useCallback(fn, deps) { return react.useMemo(() => fn, deps); },
    useEffect(fn, deps) {
      const i = cursor++, old = effects[i];
      if (changed(old?.deps, deps)) queued.push(() => {
        old?.cleanup?.();
        effects[i] = { deps, cleanup: fn() };
      });
    }
  };
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, Date, Intl, require(id) {
    if (id === 'react') return react;
    if (id === './api') return { getBillingOperations: range => new Promise((resolve, reject) => {
      requests.push({ range, resolve, reject });
    }) };
    if (id === '../../lib/apiClient') return { apiMessage: cause => cause.message };
    throw new Error(`Unexpected dependency: ${id}`);
  } });
  return {
    requests,
    render(refresh = 0) {
      cursor = 0;
      const model = module.exports.useBillingOperations(refresh);
      queued.splice(0).forEach(fn => fn());
      return model;
    },
    unmount() { effects.forEach(effect => effect?.cleanup?.()); },
    snapshot() { return JSON.stringify(values); }
  };
}

const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
const dashboard = (from = '2026-01-01') => ({ from, to: '2026-10-18', financial: { netReceived: 100 },
  courses: [], alerts: [{ severity: 'medium', title: 'renewal' }, { severity: 'high', title: 'overdue' }] });

test('period edits do not issue reads until applied; alert grouping does not change evidence', async () => {
  const h = harness();
  assert.equal(h.render().loading, true);
  h.requests[0].resolve(dashboard()); await flush();
  const model = h.render();
  assert.equal(model.alertGroups.urgent[0].title, 'overdue');
  assert.equal(model.alertGroups.upcoming[0].title, 'renewal');
  assert.equal(model.data.alerts[0].title, 'renewal');
  model.setDraftRange({ from: '2026-09-01', to: '2026-09-30' });
  const edited = h.render();
  assert.equal(h.requests.length, 1);
  edited.setRange(edited.draftRange); h.render();
  assert.equal(h.requests[1].range.from, '2026-09-01');
  h.unmount();
});

test('a late response or error for an older period cannot replace a newer result', async () => {
  const h = harness(); h.render();
  h.render().setRange({ from: '2026-09-01', to: '2026-09-30' }); h.render();
  h.requests[1].resolve(dashboard('2026-09-01')); await flush();
  h.requests[0].reject(new Error('obsolete failure')); await flush();
  assert.equal(h.render().data.from, '2026-09-01');
  assert.equal(h.render().error, '');
  assert.equal(h.render().loading, false);
  h.unmount();
});

test('refresh failures preserve the labelled snapshot and retry recovers without discarding period inputs', async () => {
  const h = harness(); h.render();
  h.requests[0].resolve(dashboard()); await flush();
  h.render(1); h.requests[1].reject(new Error('offline')); await flush();
  const failed = h.render(1);
  assert.equal(failed.error, 'offline');
  assert.equal(failed.loading, false);
  assert.equal(failed.data.from, '2026-01-01');
  const retry = failed.load();
  assert.equal(h.render(1).loading, true);
  h.requests[2].resolve(dashboard()); await retry;
  assert.equal(h.render(1).error, '');
  assert.equal(h.render(1).loading, false);
  h.unmount();
});

test('responses after leaving the workspace cannot update state', async () => {
  const h = harness(); h.render(); h.unmount();
  const before = h.snapshot();
  h.requests[0].resolve(dashboard()); await flush();
  assert.equal(h.snapshot(), before);
});
