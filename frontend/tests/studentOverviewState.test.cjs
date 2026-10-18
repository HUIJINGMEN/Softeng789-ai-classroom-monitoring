const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const root = path.join(__dirname, '..');
function compile(entry, external = []) {
  return buildSync({ entryPoints: [path.join(root, entry)], bundle: true, platform: 'node', format: 'cjs',
    write: false, define: { 'import.meta.env': '{}' }, external }).outputFiles[0].text;
}
function load(entry) {
  const loaded = new Module(__filename, module); loaded.paths = module.paths;
  loaded._compile(compile(entry), __filename); return loaded.exports;
}
const model = load('src/features/student-overview/studentOverviewState.ts');
const time = load('src/lib/sessionTime.ts');
const scope = { courseOfferingId: 'ALL_CLASSES', weekStart: '2026-10-12', view: 'WEEK', query: '', exceptionsOnly: false, page: 0 };
class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}
function fixture(status = 'UNKNOWN') {
  const account = { studentId: 'student', studentName: 'Ana', studentNumber: 'S1', courses: ['INFOSYS 222'],
    state: 'PAID', balance: 0, currency: 'NZD' };
  const session = { id: 'lesson', date: '2026-10-14', startTime: '2026-10-14T10:00:00Z', endTime: '2026-10-14T14:00:00Z', status: 'COMPLETED' };
  return { accounts: [account], reconciliations: [{ courseOfferingId: 'class', courseCode: 'INFOSYS 222', academicTerm: '2026',
    sessions: [session], rows: [{ studentId: 'student', studentName: 'Ana', studentNumber: 'S1', balance: 5,
      cells: [{ sessionId: 'lesson', attendanceStatus: status, creditStatus: 'BOOKED', lessonCreditId: 'credit' }] }] }],
    summary: { totalStudents: 99, needsAttention: status === 'UNKNOWN' ? 30 : 29, paymentIssues: 12, attendanceNotRecorded: status === 'UNKNOWN' ? 20 : 19 },
    page: 2, size: 6, totalItems: 99, totalPages: 17 };
}
test('course clocks round-trip without applying the event timezone conversion', () => {
  for (const date of ['2026-07-14', '2026-10-14']) {
    const start = time.toSessionInstant(date, '10:00'), end = time.toSessionInstant(date, '14:00');
    assert.equal(time.formatSessionTimeRange(start, end, date), '10:00–14:00');
    assert.deepEqual(time.sessionTimeFields(start, end, date), { startTime: '10:00', endTime: '14:00' });
  }
  assert.equal(time.formatTimestampClock('2026-10-14T10:00:00Z'), '23:00');
});
test('date-anchored imported lessons use one timezone basis for both ends and editing', () => {
  assert.equal(time.formatSessionTimeRange('2026-10-13T21:00:00Z', '2026-10-14T01:00:00Z', '2026-10-14'), '10:00–14:00');
  assert.deepEqual(time.sessionTimeFields('2026-10-13T21:00:00Z', '2026-10-14T01:00:00Z', '2026-10-14'), { startTime: '10:00', endTime: '14:00' });
});
test('server pagination and scope-wide counts are not replaced by the six local rows', () => {
  const data = model.overviewPageData(fixture());
  assert.equal(data.page, 2); assert.equal(data.totalItems, 99); assert.equal(data.summary.needsAttention, 30);
  assert.equal(data.rows.length, 1);
});
test('selection resolves fresh records by identity and cannot cross scopes or pages', () => {
  const key = model.overviewScopeKey(scope);
  const id = { studentId: 'student', sessionId: 'lesson', courseOfferingId: 'class', scopeKey: key };
  const before = fixture(), after = fixture('PRESENT');
  const merged = model.mergeStudentOverview(before, after);
  const selected = model.resolveLessonSelection(model.overviewPageData(merged), id, key);
  assert.equal(selected.cell.attendanceStatus, 'PRESENT');
  assert.equal(selected.row, after.reconciliations[0].rows[0]);
  assert.equal(merged.summary.attendanceNotRecorded, 19); assert.equal(merged.summary.needsAttention, 29);
  assert.equal(merged.summary.totalStudents, 99);
  assert.equal(model.resolveLessonSelection(model.overviewPageData(merged), id, 'another-week'), null);
  assert.equal(model.resolveLessonSelection(model.overviewPageData(null), id, key), null);
});

const hookCode = compile('src/features/student-overview/useStudentOverview.ts', ['react', './api', '../../lib/apiClient', '../../lib/classAdminApi']);
function harness() {
  const values = [], effects = [], pendingEffects = [], requests = [], studentRequests = [], timers = new Map();
  let cursor = 0, timer = 0, catalogs = 0;
  const react = {
    useState(initial) { const i = cursor++; if (!(i in values)) values[i] = typeof initial === 'function' ? initial() : initial;
      return [values[i], next => { values[i] = typeof next === 'function' ? next(values[i]) : next; }]; },
    useRef(initial) { const i = cursor++; return values[i] ?? (values[i] = { current: initial }); },
    useMemo(fn) { cursor++; return fn(); }, useCallback(fn) { cursor++; return fn; },
    useEffect(fn, deps) { const i = cursor++; const old = effects[i];
      if (!old || deps.some((value, n) => !Object.is(value, old.deps[n]))) {
        pendingEffects.push(() => { old?.cleanup?.(); effects[i] = { deps, cleanup: fn() }; });
      }
    }
  };
  const deferred = (list, args) => new Promise((resolve, reject) => list.push({ ...args, resolve, reject }));
  const module = { exports: {} };
  vm.runInNewContext(hookCode, { module, exports: module.exports, AbortController, Date, window: {
    setTimeout(fn) { timers.set(++timer, fn); return timer; }, clearTimeout(id) { timers.delete(id); }
  }, require(id) {
    if (id === 'react') return react;
    if (id === './api') return { getStudentOverview: (scope, signal) => deferred(requests, { scope, signal }),
      getStudentOverviewStudent: (scope, selection, signal) => deferred(studentRequests, { scope, selection, signal }) };
    if (id === '../../lib/classAdminApi') return { listClasses() { catalogs++; return Promise.resolve([]); } };
    if (id === '../../lib/apiClient') return { ApiError, apiMessage: error => error.message };
    throw new Error(`Unexpected dependency ${id}`);
  } });
  return { requests, studentRequests, get catalogs() { return catalogs; },
    render() { cursor = 0; const state = module.exports.default(); pendingEffects.splice(0).forEach(fn => fn()); return state; },
    debounce() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(fn => fn()); },
    unmount() { effects.forEach(effect => effect?.cleanup?.()); } };
}
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
test('week changes immediately hide the old page, abort prior requests and ignore late responses', async () => {
  const h = harness(); h.render(); h.requests[0].resolve(fixture()); await flush();
  assert.equal(h.render().data.rows.length, 1);
  h.render().setWeekStart('2026-10-19');
  const changing = h.render(); assert.equal(changing.loading, true); assert.equal(changing.data.rows.length, 0);
  assert.equal(h.requests[0].signal.aborted, true);
  h.render().setWeekStart('2026-10-26'); h.render();
  h.requests[1].resolve(fixture()); await flush(); assert.equal(h.render().data.rows.length, 0);
  h.requests[2].reject(new Error('offline')); await flush();
  const failed = h.render(); assert.equal(failed.loading, false);
  assert.equal(failed.error, 'Could not load students and lessons for this period. Check your connection and retry.');
  assert.equal(failed.data.rows.length, 0); h.unmount();
});
test('retry clears a failed load and server errors retain their actionable detail', async () => {
  const h = harness(); h.render();
  h.requests[0].reject(new ApiError('This class is no longer available. Choose another class.', 404)); await flush();
  assert.match(h.render().error, /Could not load students and lessons.*Choose another class/);
  h.render().reload(); h.render();
  assert.equal(h.render().loading, true); assert.equal(h.render().error, '');
  h.requests[1].resolve(fixture()); await flush();
  assert.equal(h.render().loading, false); assert.equal(h.render().data.rows.length, 1); h.unmount();
});
test('one register request loads each page; typing is debounced and refresh targets one student/class', async () => {
  const h = harness(); h.render(); h.requests[0].resolve(fixture()); await flush(); const ready = h.render();
  assert.equal(h.requests.length, 1); assert.equal(h.catalogs, 1);
  const selection = model.resolveLessonSelection(ready.data, { studentId: 'student', sessionId: 'lesson', courseOfferingId: 'class', scopeKey: ready.scopeKey }, ready.scopeKey);
  const refresh = ready.refreshStudent(selection);
  assert.equal(h.studentRequests.length, 1); assert.equal(h.requests.length, 1);
  h.studentRequests[0].resolve(fixture('PRESENT')); await refresh;
  assert.equal(h.render().data.rows[0].cells[0].reconciliationCell.attendanceStatus, 'PRESENT');
  assert.equal(h.requests.length, 1); assert.equal(h.catalogs, 1);
  h.render().setQuery('A'); h.render(); h.render().setQuery('Ana');
  assert.equal(h.render().data.rows.length, 0); assert.equal(h.requests.length, 1);
  h.debounce(); h.render(); assert.equal(h.requests.length, 2); assert.equal(h.requests[1].scope.query, 'Ana');
  h.unmount(); assert.equal(h.requests[1].signal.aborted, true);
});
test('failed post-save refresh reports that the write succeeded and does not resend it', async () => {
  const h = harness(); h.render(); h.requests[0].resolve(fixture()); await flush(); const ready = h.render();
  const selection = model.resolveLessonSelection(ready.data, { studentId: 'student', sessionId: 'lesson', courseOfferingId: 'class', scopeKey: ready.scopeKey }, ready.scopeKey);
  const refresh = ready.refreshStudent(selection);
  h.studentRequests[0].reject(new Error('offline'));
  await assert.rejects(refresh, /Changes were saved/); assert.equal(h.requests.length, 1); h.unmount();
});

test('search from a later page never requests page zero with the old search term', async () => {
  const h = harness(); h.render(); h.requests[0].resolve(fixture()); await flush(); h.render();
  h.render().setPage(2); h.render(); h.requests[1].resolve(fixture()); await flush();
  h.render().setQuery('Ana'); const pending = h.render();
  assert.equal(pending.loading, true); assert.equal(pending.data.rows.length, 0);
  assert.equal(h.requests.length, 2); assert.equal(h.requests[1].signal.aborted, true);
  h.debounce(); h.render(); assert.equal(h.requests.length, 3);
  assert.equal(h.requests[2].scope.query, 'Ana'); assert.equal(h.requests[2].scope.page, 0); h.unmount();
});

test('partial refresh refuses structural session changes, foreign identities and missing roster rows', () => {
  const source = fixture(); const data = model.overviewPageData(source);
  const selected = model.resolveLessonSelection(data, { studentId: 'student', sessionId: 'lesson', courseOfferingId: 'class', scopeKey: 'scope' }, 'scope');
  assert.equal(model.canMergeStudentOverview(source, fixture('PRESENT'), selected), true);
  const changed = fixture('PRESENT'); changed.reconciliations[0].sessions[0].status = 'CANCELLED';
  assert.equal(model.canMergeStudentOverview(source, changed, selected), false);
  changed.reconciliations[0].sessions = [];
  assert.equal(model.canMergeStudentOverview(source, changed, selected), false);
  const wrongStudent = fixture(); wrongStudent.accounts[0].studentId = 'another-student';
  assert.equal(model.canMergeStudentOverview(source, wrongStudent, selected), false);
  const withdrawn = fixture(); withdrawn.reconciliations[0].rows = [];
  assert.equal(model.canMergeStudentOverview(source, withdrawn, selected), false);
});

test('class schedule changes after a write reload the whole page instead of patching other students incorrectly', async () => {
  const h = harness(); h.render(); h.requests[0].resolve(fixture()); await flush(); const ready = h.render();
  const selected = model.resolveLessonSelection(ready.data, { studentId: 'student', sessionId: 'lesson', courseOfferingId: 'class', scopeKey: ready.scopeKey }, ready.scopeKey);
  const refreshing = ready.refreshStudent(selected);
  const changed = fixture('PRESENT'); changed.reconciliations[0].sessions[0].status = 'CANCELLED';
  h.studentRequests[0].resolve(changed); await refreshing;
  const reloading = h.render();
  assert.equal(reloading.loading, true); assert.equal(reloading.data.rows.length, 0); assert.equal(h.requests.length, 2);
  h.unmount();
});

test('a withdrawn student clears the stale selection and reloads records rather than trapping refresh retries', async () => {
  const h = harness(); h.render(); h.requests[0].resolve(fixture()); await flush(); const ready = h.render();
  const selected = model.resolveLessonSelection(ready.data, { studentId: 'student', sessionId: 'lesson', courseOfferingId: 'class', scopeKey: ready.scopeKey }, ready.scopeKey);
  const refreshing = ready.refreshStudent(selected);
  h.studentRequests[0].reject(new ApiError('Student is no longer enrolled', 404));
  await assert.rejects(refreshing, /Changes were saved/);
  assert.equal(h.render().data.rows.length, 0); assert.equal(h.requests.length, 2); assert.equal(h.catalogs, 2);
  h.unmount();
});

test('refresh retains the page only while search membership, attention membership and account ordering remain valid', () => {
  const source = fixture();
  const selected = model.resolveLessonSelection(model.overviewPageData(source), {
    studentId: 'student', sessionId: 'lesson', courseOfferingId: 'class', scopeKey: 'scope'
  }, 'scope');
  assert(model.refreshedStudentOverview(source, fixture('PRESENT'), selected, false));
  assert.equal(model.refreshedStudentOverview(source, fixture('PRESENT'), selected, true), null);
  for (const change of [
    account => { account.studentName = 'Renamed'; },
    account => { account.studentNumber = 'Different'; },
    account => { account.courses = ['Another class']; },
    account => { account.state = 'OVERDUE'; },
    account => { account.nextDueDate = '2026-10-01'; }
  ]) {
    const update = fixture('PRESENT'); change(update.accounts[0]);
    assert.equal(model.refreshedStudentOverview(source, update, selected, false), null);
  }
});

test('register API uses one paginated request and forwards cancellation to both read paths', async () => {
  const calls = [], module = { exports: {} };
  const code = compile('src/features/student-overview/api.ts', ['../../lib/apiClient']);
  vm.runInNewContext(code, { module, exports: module.exports, URLSearchParams,
    require: () => ({ request: (url, init) => { calls.push({ url, init }); return Promise.resolve({}); } }) });
  const signal = new AbortController().signal;
  await module.exports.getStudentOverview({ ...scope, page: 2, query: 'Ana & Ben' }, signal);
  assert.equal(calls.length, 1);
  const params = new URL(calls[0].url, 'http://localhost').searchParams;
  assert.equal(params.get('size'), '6'); assert.equal(params.get('page'), '2');
  assert.equal(params.get('query'), 'Ana & Ben'); assert.equal(params.has('courseOfferingId'), false);
  await module.exports.getStudentOverviewStudent(scope, { row: { studentId: 'student' }, session: { courseOfferingId: 'class' } }, signal);
  assert.equal(calls.length, 2); assert(calls[1].url.includes('/students/student?'));
  assert.equal(new URL(calls[1].url, 'http://localhost').searchParams.get('courseOfferingId'), 'class');
  assert(calls.every(call => call.init.signal === signal));
});
