const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const { buildSync } = require('esbuild');
const code = buildSync({ entryPoints: [path.join(__dirname, '../src/features/payments/useLessonCreditPanel.ts')],
  bundle: true, write: false, platform: 'node', format: 'cjs',
  external: ['react', './api', '../../lib/apiClient'] }).outputFiles[0].text;
function harness() {
  const values = [], effects = [], queued = [], writes = [], refreshes = [];
  let cursor = 0;
  const confirmations = [];
  const browser = { requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    confirm(message) { confirmations.push(message); return browser.discard; }, discard: false };
  const react = {
    useState(initial) { const i = cursor++; if (!(i in values)) values[i] = initial;
      return [values[i], next => { values[i] = typeof next === 'function' ? next(values[i]) : next; }]; },
    useRef(initial) { const i = cursor++; return values[i] ?? (values[i] = { current: initial }); },
    useEffect(fn, deps) { const i = cursor++; const old = effects[i];
      if (!old || deps.some((value, n) => !Object.is(value, old.deps[n]))) {
        queued.push(() => { old?.cleanup?.(); effects[i] = { deps, cleanup: fn() }; });
      }
    }
  };
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, HTMLElement: class {},
    window: browser, document: { activeElement: null, body: { style: {} } },
    require(id) {
      if (id === 'react') return react;
      if (id === '../../lib/apiClient') return { apiMessage: error => error.message };
      if (id === './api') return { updateReconciliationAttendance: (session, student, payload) => {
        writes.push(payload); return Promise.resolve({ status: payload.status, absenceReason: null, absenceNote: null });
      } };
      throw new Error(`Unexpected dependency ${id}`);
    } });
  const props = { row: { studentId: 'student', currency: 'NZD', balance: 0 }, session: { id: 'lesson' },
    cell: { attendanceStatus: 'UNKNOWN', lessonCreditId: null, creditStatus: null }, onClose() {},
    onUpdated: () => new Promise((resolve, reject) => refreshes.push({ resolve, reject })) };
  return { props, writes, refreshes, browser, confirmations,
    render() { cursor = 0; const model = module.exports.useLessonCreditPanel(props); queued.splice(0).forEach(fn => fn()); return model; },
    unmount() { effects.forEach(effect => effect?.cleanup?.()); } };
}
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
test('manual status refresh catches failures, keeps the editor open and never writes attendance', async () => {
  const h = harness(); let closes = 0; h.props.onClose = () => closes++;
  h.render();
  const refresh = h.render().retryRefresh();
  assert.equal(h.render().busy, true);
  h.refreshes[0].reject(new Error('Status refresh is offline')); await refresh;
  assert.equal(h.render().error, 'Status refresh is offline');
  assert.equal(h.render().refreshFailed, true);
  assert.equal(closes, 0); assert.equal(h.writes.length, 0);
  const retry = h.render().retryRefresh(); h.refreshes[1].resolve(); await retry;
  assert.equal(h.render().refreshFailed, false); assert.equal(h.render().error, '');
  assert.equal(h.writes.length, 0); h.unmount();
});
test('new source records never overwrite an unsaved local attendance edit', () => {
  const h = harness(); h.render(); h.render().setAttendanceStatus('LATE'); h.render();
  h.props.cell = { ...h.props.cell, attendanceStatus: 'PRESENT' }; h.render();
  assert.equal(h.render().attendanceStatus, 'LATE'); assert.equal(h.render().attendanceDirty, true); h.unmount();
});
test('a clean editor follows fresh source records without remounting', () => {
  const h = harness(); h.render(); h.props.cell = { ...h.props.cell, attendanceStatus: 'PRESENT' }; h.render();
  assert.equal(h.render().attendanceStatus, 'PRESENT'); assert.equal(h.render().attendanceDirty, false); h.unmount();
});
test('post-save refresh failures disable writes and retry only the read, not attendance', async () => {
  const h = harness(); h.render(); h.render().setAttendanceStatus('PRESENT');
  const saving = h.render().saveAttendance(); await flush();
  assert.equal(h.writes.length, 1); assert.equal(h.render().busy, true);
  h.refreshes[0].reject(new Error('Saved, but refresh is offline')); await saving;
  assert.equal(h.render().refreshFailed, true); assert.equal(h.render().busy, true);
  await h.render().saveAttendance(); assert.equal(h.writes.length, 1);
  const retry = h.render().retryRefresh(); assert.equal(h.refreshes.length, 2);
  h.refreshes[1].resolve(); await retry;
  assert.equal(h.render().refreshFailed, false); assert.equal(h.render().busy, false);
  assert.equal(h.writes.length, 1); h.unmount();
});

test('close and Escape protect unsaved changes, while clean forms close without a prompt', () => {
  const h = harness(); let closes = 0; h.props.onClose = () => closes++;
  h.render(); h.render().onClose(); assert.equal(closes, 1); assert.equal(h.confirmations.length, 0);
  h.render().setAttendanceStatus('LATE'); h.render().onClose(); assert.equal(closes, 1);
  let prevented = false;
  h.render().handlePanelKeyDown({ key: 'Escape', preventDefault() { prevented = true; } });
  assert.equal(prevented, true); assert.equal(closes, 1); assert.equal(h.confirmations.length, 2);
  h.browser.discard = true; h.render().onClose(); assert.equal(closes, 2); h.unmount();
});
