const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const { buildSync } = require('esbuild');

function compile(entry, external = []) {
  return buildSync({ entryPoints: [path.join(__dirname, '../src', entry)], bundle: true,
    write: false, platform: 'node', format: 'cjs', external, loader: { '.css': 'empty' },
    jsx: 'automatic' }).outputFiles[0].text;
}
function load(entry) {
  const module = { exports: {} };
  vm.runInNewContext(compile(entry), { module, exports: module.exports, Date, Intl });
  return module.exports;
}
const { splitCheckInSessions } = load('features/photo-attendance/checkInSessions.ts');
const { rosterAttendanceLabel } = load('features/webcam-events/rosterAttendance.ts');
const { streamsForStudent } = load('features/live-video/streamFilter.ts');
const session = (id, startTime, canSubmit = false) => ({ sessionId: id, startTime, canSubmit });
const ids = rows => Array.from(rows, row => row.sessionId);
const now = new Date('2026-11-11T11:05:00Z'); // 12 Nov, 00:05 in Auckland.

test('today in Auckland is primary even when check-in is closed', () => {
  const result = splitCheckInSessions([session('today', '2026-11-11T20:00:00Z')], now);
  assert.deepEqual(ids(result.primary), ['today']); assert.equal(result.nearby.length, 0);
});
test('yesterday class still accepting check-in across midnight stays primary', () => {
  const result = splitCheckInSessions([session('ongoing', '2026-11-11T10:50:00Z', true)], now);
  assert.deepEqual(ids(result.primary), ['ongoing']);
});
test('tomorrow class with early check-in before midnight stays primary', () => {
  const result = splitCheckInSessions([session('soon', '2026-11-11T11:05:00Z', true)],
    new Date('2026-11-11T10:55:00Z'));
  assert.deepEqual(ids(result.primary), ['soon']);
});
test('closed yesterday class stays nearby', () => {
  const result = splitCheckInSessions([session('closed', '2026-11-11T10:00:00Z')], now);
  assert.equal(result.primary.length, 0); assert.deepEqual(ids(result.nearby), ['closed']);
});
test('both partitions sort by instant and preserve the source array', () => {
  const rows = Object.freeze([
    session('later', '2026-11-12T02:00:00+13:00'), session('near-later', '2026-11-13T01:00:00+13:00'),
    session('earlier', '2026-11-11T11:30:00Z'), session('near-earlier', '2026-11-10T23:00:00+13:00')
  ]);
  const result = splitCheckInSessions(rows, now);
  assert.deepEqual(ids(result.primary), ['earlier', 'later']);
  assert.deepEqual(ids(result.nearby), ['near-earlier', 'near-later']);
  assert.equal(rows[0].sessionId, 'later');
});
test('Auckland winter date and empty input use the same partition rule', () => {
  assert.deepEqual(ids(splitCheckInSessions([session('winter', '2026-07-11T12:01:00Z')],
    new Date('2026-07-11T12:05:00Z')).primary), ['winter']);
  assert.equal(splitCheckInSessions([], now).primary.length, 0);
});
test('unavailable attendance takes precedence over saved rows', () => {
  assert.equal(rosterAttendanceLabel([{ studentRecordId: 's', status: 'Present' }], 's', true), 'Unavailable');
});
test('missing rows and Unknown are not absence', () => {
  assert.equal(rosterAttendanceLabel([], 's', false), 'Not recorded');
  assert.equal(rosterAttendanceLabel([{ studentRecordId: 's', status: 'Unknown' }], 's', false), 'Not recorded');
});
test('attendance comes only from the matching stored student mark', () => {
  for (const status of ['Present', 'Late', 'Absent', 'Excused']) {
    const rows = [{ studentRecordId: 'other', status: 'Absent' }, { studentRecordId: 's', status }];
    assert.equal(rosterAttendanceLabel(rows, 's', false), status);
  }
});
test('observation and connection metadata cannot change attendance labels', () => {
  for (const connection of ['RUNNING', 'PAUSED', 'STOPPED', 'DISCONNECTED']) {
    assert.equal(rosterAttendanceLabel([{ studentRecordId: 's', status: 'Unknown',
      connection, kind: 'NO_FACE', pendingChecks: 99 }], 's', false), 'Not recorded');
  }
});
test('selected-student video excludes other students without mutating streams', () => {
  const streams = Object.freeze([{ id: 'a', studentId: 'one' }, { id: 'b', studentId: 'two' }]);
  assert.deepEqual(Array.from(streamsForStudent(streams, 'two'), s => s.id), ['b']);
  assert.equal(streamsForStudent(streams, 'missing').length, 0);
  assert.equal(streams.length, 2);
});
test('whole-class video returns every stream when no student is selected', () => {
  const streams = [{ id: 'a', studentId: 'one' }, { id: 'b', studentId: 'two' }];
  assert.equal(streamsForStudent(streams), streams);
});

// Exercise actual component branches and the fallback callback with mocked API responses.
const panelCode = compile('features/webcam-events/TeacherObservationsPanel.tsx',
  ['react', 'react/jsx-runtime', './sharingApi', './ObservationRoster', './reviewGroups', './observationModel']);
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
function panelHarness(dashboard) {
  const state = [], effects = [];
  let cursor = 0, first = true, opened = 0;
  const element = (type, props) => ({ type, props: props ?? {} });
  const mocks = {
    react: { useState(initial) { const index = cursor++; if (first) state[index] = initial;
      return [state[index], next => { state[index] = typeof next === 'function' ? next(state[index]) : next; }]; },
      useEffect(effect) { if (first) effects.push(effect); } },
    'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: 'fragment' },
    './sharingApi': { sharingApi: { dashboard } }, './ObservationRoster': { default: 'roster' },
    './reviewGroups': { reviewGroups: () => [] }, './observationModel': { labels: {} }
  };
  const module = { exports: {} };
  vm.runInNewContext(panelCode, { module, exports: module.exports, require: name => {
    if (!(name in mocks)) throw new Error('Unexpected import: ' + name); return mocks[name];
  }, Date, AbortController, AbortSignal, Error,
    document: { hidden: false, addEventListener() {}, removeEventListener() {} },
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 2, clearInterval() {} });
  function render() { cursor = 0; const tree = module.exports.default({ sessionId: 'class',
    attendance: [], attendanceUnavailable: false, onShowSharedVideos: () => opened++ });
    first = false; return tree; }
  function nodes(value) {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== 'object') return [value];
    return [value, ...nodes(value.props.children)];
  }
  return { render, nodes, effects, opened: () => opened };
}
test('disabled observations offers an explicit video-mode fallback without viewing', async () => {
  const h = panelHarness(async () => ({ enabled: false, students: [], events: [], page: 0 }));
  h.render(); h.effects.forEach(effect => effect()); await flush();
  const nodes = h.nodes(h.render()), text = nodes.filter(n => typeof n === 'string').join(' ');
  assert.match(text, /Observation sharing is disabled on this server/);
  assert.match(text, /Observation sharing disabled on this server/);
  assert.doesNotMatch(text, /Select a student for video and observations/);
  assert.equal(h.opened(), 0);
  nodes.find(n => n?.type === 'button' && n.props.children === 'Open shared videos').props.onClick();
  assert.equal(h.opened(), 1);
});
test('initial observation load failure stops the loading message and offers video mode', async () => {
  const h = panelHarness(async () => { throw new Error('offline'); });
  h.render(); h.effects.forEach(effect => effect()); await flush();
  const nodes = h.nodes(h.render()), text = nodes.filter(n => typeof n === 'string').join(' ');
  assert.match(text, /Class students unavailable/); assert.match(text, /offline/);
  assert.doesNotMatch(text, /Last received data is retained below; it is not live\./);
  assert.doesNotMatch(text, /Loading…|Select a student for video and observations/);
  assert(nodes.some(n => n?.type === 'button' && n.props.children === 'Open shared videos'));
  assert.equal(h.opened(), 0);
});
