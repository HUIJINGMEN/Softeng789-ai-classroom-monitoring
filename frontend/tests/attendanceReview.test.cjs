const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const { buildSync } = require('esbuild');
const compile = file => buildSync({ entryPoints: [path.join(__dirname, '../src/features/photo-attendance', file)],
  bundle: true, write: false, platform: 'node', format: 'cjs', external: ['react', '../../lib/apiClient', './checkInApi'] }).outputFiles[0].text;
const code = compile('useAttendanceReview.ts');
const modelModule = { exports: {} };
vm.runInNewContext(compile('attendanceReviewModel.ts'), { module: modelModule, exports: modelModule.exports });
const { actionableRequests, reviewSummary, reviewRows } = modelModule.exports;
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const plain = value => JSON.parse(JSON.stringify(value));
function workspace(ids = ['a', 'b']) {
  return { attendance: ids.map(id => ({ studentId: id, studentName: id, studentNumber: id, status: 'UNKNOWN' })),
    requests: ids.map(id => ({ id, studentId: id, studentName: id, state: 'PENDING',
      expiresAt: new Date(Date.now() + 600000).toISOString(), createdAt: new Date().toISOString(), reviewedAt: null })), history: [] };
}
function harness() {
  const state = [], effects = [], reads = [], decisions = [], intervals = new Map(), listeners = new Map();
  let cursor = 0, callbacks = 0;
  const changed = (a, b) => !a || a.length !== b.length || a.some((v, i) => v !== b[i]);
  const react = {
    useState(initial) { const i = cursor++; if (!(i in state)) state[i] = initial;
      return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value; }]; },
    useRef(initial) { return state[cursor++] ??= { current: initial }; },
    useCallback(fn, deps) { const i = cursor++; if (changed(state[i]?.deps, deps)) state[i] = { fn, deps }; return state[i].fn; },
    useEffect(fn, deps) { const i = cursor++; if (changed(state[i]?.deps, deps)) {
      state[i]?.cleanup?.(); state[i] = { deps }; effects.push(() => { state[i].cleanup = fn(); });
    } }
  };
  const document = { hidden: false, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, AbortController, document,
    window: { setTimeout: () => 1, clearTimeout() {}, setInterval: fn => { const id = Symbol(); intervals.set(id, fn); return id; }, clearInterval: id => intervals.delete(id) },
    require(name) {
      if (name === 'react') return react;
      if (name === '../../lib/apiClient') return { apiMessage: e => e.message, request: (url, init) => new Promise((resolve, reject) => reads.push({ url, init, resolve, reject })) };
      if (name === './checkInApi') return { decideCheckIn: (id, status) => new Promise((resolve, reject) => decisions.push({ id, status, resolve, reject })) };
      throw new Error(name);
    }
  });
  return { reads, decisions, document, get callbacks() { return callbacks; },
    tick() { for (const fn of intervals.values()) fn(); },
    unmount() { state.forEach(value => value?.cleanup?.()); },
    render(session = 'class-1') { cursor = 0; const value = module.exports.useAttendanceReview(session, () => { callbacks++; });
      effects.splice(0).forEach(fn => fn()); return value; }
  };
}
test('summary separates recorded, pending and unrecorded students; stale/expired requests cannot count twice', () => {
  const data = workspace(['a', 'b', 'c', 'd', 'e', 'f']);
  data.attendance[0].status = 'PRESENT'; data.attendance[1].status = 'LATE'; data.attendance[2].status = 'ABSENT';
  data.requests[4].expiresAt = new Date(0).toISOString(); data.requests[5].state = 'REJECTED';
  data.requests.push({ ...data.requests[3], id: 'duplicate' });
  assert.deepEqual(plain(reviewSummary(data)), { present: 1, late: 1, absent: 1, pending: 1, notRecorded: 2 });
  assert.deepEqual(plain(actionableRequests(data).map(r => r.studentId)), ['d', 'd']);
});
test('the unified roster has one row per student and puts pending then unrecorded before saved attendance', () => {
  const data = workspace(['z', 'b', 'a', 'c']);
  data.attendance[0].status = 'PRESENT';
  data.requests[1].expiresAt = new Date(0).toISOString();
  data.requests.push({ ...data.requests[2], id: 'new-a', createdAt: new Date(Date.now() + 1000).toISOString() });
  const rows = reviewRows(data, 'ALL', '');
  assert.deepEqual(plain(rows.map(r => r.studentId)), ['a', 'c', 'b', 'z']);
  assert.equal(rows[0].pending.id, 'new-a');
  assert.equal(rows[3].pending, undefined);
  assert.deepEqual(plain(reviewRows(data, 'UNKNOWN', '').map(r => r.studentId)), ['b']);
  assert.equal(reviewRows(data, 'PRESENT', ' Z ').length, 1);
  assert.equal(reviewRows(data, 'PENDING', 'z').length, 0);
});
test('refresh preserves explicit selections, never selects newcomers and removes already marked students', async () => {
  const h = harness(); h.render(); h.reads[0].resolve(workspace()); await flush();
  h.render().setSelected(['a']);
  let pending = h.render().refresh(); h.reads[1].resolve(workspace(['a', 'b', 'c'])); await pending;
  assert.deepEqual(plain(h.render().selected), ['a']);
  const next = workspace(); next.attendance[0].status = 'PRESENT';
  pending = h.render().refresh(); h.reads[2].resolve(next); await pending;
  assert.deepEqual(plain(h.render().selected), []);
});
test('batch decisions are sequential, report partial failure and do not hide it on the next successful refresh', async () => {
  const h = harness(); h.render(); h.reads[0].resolve(workspace()); await flush(); h.render().setSelected(['a', 'b']);
  const pending = h.render().decide(['a', 'b'], 'PRESENT');
  assert.equal(h.decisions.length, 1); h.tick(); assert.equal(h.reads.length, 1);
  h.decisions[0].resolve({}); await flush(); assert.equal(h.decisions.length, 2);
  h.decisions[1].reject(new Error('Request expired')); await flush();
  const next = workspace(); next.attendance[0].status = 'PRESENT'; h.reads[1].resolve(next); await pending;
  assert.equal(h.callbacks, 1); assert.match(h.render().message, /1 request\(s\) approved/);
  assert.match(h.render().error, /b: Request expired/);
  const refresh = h.render().refresh(); h.reads[2].resolve(next); await refresh;
  assert.match(h.render().error, /Request expired/);
});
test('a read started before approval cannot overwrite the result even when abort is ignored', async () => {
  const h = harness(); h.render(); h.reads[0].resolve(workspace()); await flush(); h.render().setSelected(['a']);
  const oldRead = h.render().refresh(); const mutation = h.render().decide(['a'], 'LATE');
  assert.equal(h.reads[1].init.signal.aborted, true);
  h.decisions[0].resolve({}); await flush();
  const next = workspace(); next.attendance[0].status = 'LATE'; h.reads[2].resolve(next); await mutation;
  h.reads[1].resolve(workspace()); await oldRead;
  assert.equal(h.render().workspace.attendance[0].status, 'LATE');
});
test('switching classes stops remaining batch decisions and ignores late results', async () => {
  const h = harness(); h.render(); h.reads[0].resolve(workspace()); await flush(); h.render().setSelected(['a', 'b']);
  const pending = h.render().decide(['a', 'b'], 'REJECTED'); h.render('class-2');
  h.reads[1].resolve(workspace(['c'])); await flush(); h.decisions[0].resolve({}); await pending;
  assert.equal(h.decisions.length, 1); assert.equal(h.callbacks, 0);
  assert.equal(h.render('class-2').workspace.attendance[0].studentId, 'c');
  assert.equal(h.render('class-2').message, '');
});
test('hidden tabs do not poll; failed refresh keeps the last snapshot with an error', async () => {
  const h = harness(); h.render(); h.reads[0].resolve(workspace()); await flush();
  h.document.hidden = true; h.tick(); assert.equal(h.reads.length, 1);
  h.document.hidden = false; h.tick(); h.reads[1].reject(new Error('Offline')); await flush();
  assert.equal(h.render().workspace.attendance.length, 2); assert.match(h.render().error, /last loaded data.*Offline/);
  h.unmount(); h.tick(); assert.equal(h.reads.length, 2);
});
