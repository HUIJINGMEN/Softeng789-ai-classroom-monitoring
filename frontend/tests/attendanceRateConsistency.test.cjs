const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const root = path.join(__dirname, '..');
const code = buildSync({
  stdin: {contents: `
    export * from './src/lib/attendanceAnalytics';
    export * from './src/lib/classRows';
    export * from './src/lib/reportMetrics';
    export * from './src/lib/sessionTime';
    export * from './src/lib/studentAttendanceEvidence';
    export {mapAttendanceApiToUi} from './src/lib/classroomApi';
    export * from './src/features/dashboard-attendance/attendanceComparisonModel';
    export * from './src/features/class-overview/classOverviewModel';
    export * from './src/features/class-reports/classReportModel';
    export * from './src/features/session-attendance/sessionAttendanceModel';
    export * from './src/features/dashboard-attendance/useDashboardAttendance';
    export {default as ClassOverview} from './src/components/ClassOverviewTab';
    export {default as ClassAttendance} from './src/components/ClassAttendanceTab';
    export {default as SessionRow} from './src/components/ClassAttendanceSessionRow';
    export {default as Lowest} from './src/components/AdminLowestAttendanceCard';
    export {default as Comparison} from './src/components/CampusParticipationComparison';
    export {renderToStaticMarkup} from 'react-dom/server';
    export {createElement} from 'react';`, resolveDir: root, loader: 'tsx'},
  bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic',
  define: {'import.meta.env': '{}'}, loader: {'.css': 'empty'},
  external: ['react', 'react/jsx-runtime', 'react-dom/server']
}).outputFiles[0].text;
const loaded = new Module(__filename, module); loaded.paths = module.paths; loaded._compile(code, __filename);
const api = loaded.exports;
const example = {present: 20, late: 4, absent: 2, unknown: 54, total: 80, rate: 30};
const missing = {present: 0, late: 0, absent: 0, unknown: 80, total: 80, rate: 0};
const day = api.formatIsoDateInAuckland(new Date(Date.now() - 86_400_000));
const session = (id, status = 'Completed', courseOfferingId = 'class-a') => ({
  id, courseOfferingId, course: courseOfferingId, title: courseOfferingId, room: 'Room 1', campusName: 'City',
  date: day, dateLabel: 'Today', time: '10:00–11:00',
  startTime: api.toSessionInstant(day, '10:00'), endTime: api.toSessionInstant(day, '11:00'), enrolled: 80, status
});
const render = (View, props) => api.renderToStaticMarkup(api.createElement(View, props));
const noop = () => {};
const rows = (counts, sessionId = 'a', studentLevel = 'LEVEL_2') =>
  [['Present', counts.present], ['Late', counts.late], ['Absent', counts.absent], ['Unknown', counts.unknown]]
    .flatMap(([status, count]) => Array.from({length: count}, (_, index) => ({
      id: null, studentRecordId: `${status}-${index}`, studentNumber: `${status}-${index}`,
      studentName: 'Example', sessionId, studentLevel, status, checkInTime: null, checkOutTime: null, source: null
    })));

test('report details share historical roster identity and never infer attendance from current enrolments', () => {
  const student = {id: 'S1', recordId: 'student-uuid', course: 'new', courseOfferingIds: ['new']};
  const sessions = [session('old', 'Completed', 'withdrawn'), session('new', 'Completed', 'new')];
  const roster = id => id === 'old'
    ? [{studentRecordId: 'student-uuid', studentNumber: 'S1', sessionId: id, status: 'Present'}]
    : [{studentRecordId: 'another-student', studentNumber: 'S1', sessionId: id, status: 'Absent'}];
  const result = api.metricsForStudent(student, sessions, [
    {studentId: 'S1', studentRecordId: 'student-uuid', sessionId: 'old', type: 'Hand raised', status: 'Confirmed'},
    {studentId: 'S1', studentRecordId: 'student-uuid', sessionId: 'new', type: 'Hand raised', status: 'Confirmed'}
  ], roster);
  assert.equal(result.sessionCount, 1);
  assert.equal(result.recorded, 1);
  assert.equal(result.attended, 1);
  assert.equal(result.attendance.rate, 100);
  assert.deepEqual(result.attendance, api.attendanceCounts(roster('old')));
});

test('report date range applies the same past-completed clock even when the range extends into the future', () => {
  const now = Date.now();
  const futureStart = new Date(now + 7 * 86_400_000);
  const done = session('done');
  const future = {...session('future'), date: api.formatIsoDateInAuckland(futureStart), startTime: futureStart.toISOString()};
  const all = [done, future, session('live', 'Live'), session('cancel', 'Cancelled'), session('scheduled', 'Scheduled')];
  assert.deepEqual(api.completedSessionsInRange(all, '2000-01-01', '2099-01-01', undefined, now).map(row => row.id), ['done']);
  assert.deepEqual(api.completedSessionsInRange(all, '2000-01-01', '2099-01-01', 'another-offering', now), []);
});

test('shared rate separates missing, absence and real zero, independent of supplied total/rate', () => {
  assert.equal(api.recordedAttendanceCount(example), 26);
  assert.equal(api.attendanceRate(example), 92);
  assert.equal(api.attendanceRate({...example, unknown: 1000, total: 1026, rate: 1}), 92);
  assert.equal(api.attendanceRate(missing), null);
  assert.equal(api.attendanceRate({present: 0, late: 0, absent: 4}), 0);
  assert.equal(api.attendanceRate({present: 3, late: 1, absent: 0}), 100);
});

test('admin/teacher class rows, session summaries and report rows agree on the same marks', () => {
  const sessions = [session('done'), session('future', 'Scheduled'), session('cancelled', 'Cancelled'),
    session('live', 'Live'), session('other', 'Completed', 'class-b')];
  const row = api.buildClassRow('class-a', sessions, () => example);
  assert.equal(row.attendance.rate, 92);
  assert.equal(row.attendance.total, 80);
  assert.equal(row.completedSessionCount, 1);
  assert.equal(api.attendanceForSessions([sessions[0]], () => example).rate, 92);
  assert.equal(api.buildClassReportSessionRows([sessions[0]], () => example)[0].attendanceRate, 92);
  const marks = [...Array(20).fill('Present'), ...Array(4).fill('Late'), ...Array(2).fill('Absent'), ...Array(54).fill('Unknown')];
  assert.equal(api.attendanceCounts(marks.map(status => ({status}))).rate, 92);
});

test('class aggregation weights recorded marks, not percentages or unknown rosters', () => {
  const byId = {a: {present: 1, late: 0, absent: 0, unknown: 99, total: 100},
    b: {present: 0, late: 0, absent: 9, unknown: 0, total: 9}};
  assert.equal(api.buildClassRow('class-a', [session('a'), session('b')], id => byId[id]).attendance.rate, 10);
  assert.equal(api.buildClassRow('class-a', [session('a')], () => missing).attendance.rate, null);
});

test('class summary and overview expose 92% rate and separate 33% completeness', () => {
  const attendance = {...example, rate: api.attendanceRate(example)};
  const overview = render(api.ClassOverview, {attendance, classSessions: [session('a')], nextSession: null,
    roster: [], onViewSessions: noop, onViewStudents: noop, onOpenStudent: noop});
  const tab = render(api.ClassAttendance, {attendance, classSessions: [session('a')], countsForSession: () => example,
    attendanceRowsForSession: () => [], students: [], onOpenStudent: noop});
  for (const html of [overview, tab]) {
    assert(html.includes('92%'));
    assert(html.includes('33%'));
    assert(html.includes('26 of 80 attendance marks have a recorded status.'));
    assert(html.includes('Unrecorded marks'));
    assert(!html.includes('30%'));
  }
  assert(tab.includes('24 of 26 recorded marks were present or late.'));
});

test('unrecorded session rows have no rate while recorded absences have a genuine 0%', () => {
  const html = render(api.SessionRow, {session: session('a'), countsForSession: () => missing, onOpenRoster: noop});
  assert(html.includes('No recorded marks'));
  assert(!html.includes('>0%</'));
  const absent = render(api.SessionRow, {session: session('a'), countsForSession: () => ({...missing, absent: 80, unknown: 0}), onOpenRoster: noop});
  assert(absent.includes('>0%</'));
  const overview = render(api.ClassOverview, {attendance: {...missing, rate: null}, classSessions: [session('a')],
    nextSession: null, roster: [{id: 'student-a', rate: null}], onViewSessions: noop, onViewStudents: noop, onOpenStudent: noop});
  assert(overview.includes('No recorded rates for the current roster.'));
  assert(!overview.includes('Everyone with recorded attendance is at or above'));
});

test('dashboard uses the same denominator and never ranks a wholly unrecorded class as low attendance', () => {
  const sessions = [session('recorded'), session('missing', 'Completed', 'missing-class')];
  const countsForSession = id => id === 'recorded' ? example : missing;
  let workspace;
  function Probe() { workspace = api.useDashboardAttendance({sessions,
    attendanceRowsForSession: id => rows(countsForSession(id), id)}); return null; }
  render(Probe, {});
  assert.equal(workspace.attendance.rate, 92);
  const ranked = render(api.Lowest, {sessions, countsForSession, period: 'week', onPeriodChange: noop,
    onOpenAttendance: noop, onOpenClass: noop});
  assert(ranked.includes('92%'));
  assert(!ranked.includes('missing-class'));
  assert(!ranked.includes('>0%</'));
});

test('campus comparison keeps unknown counts separate and shows no rate without recorded marks', () => {
  const props = {sessions: [session('a')], attendanceRowsForSession: () => rows(example)};
  const html = render(api.Comparison, props);
  assert(html.includes('92%'));
  assert(html.includes('24 / 26 recorded marks attended'));
  assert(html.includes('54 not recorded'));
  const empty = render(api.Comparison, {...props, attendanceRowsForSession: () => rows(missing)});
  assert(empty.includes('no recorded marks'));
  assert.match(empty, /class="campus-comparison__value"[^>]*>—<\/span>/);
  assert(!empty.includes('aria-valuenow="0"'));
});

test('campus and level partitions reconcile every historical mark, including withdrawn/missing directory students', () => {
  const sessions = Array.from({length: 17}, (_, i) => ({...session(`s${i}`), campusName: ['City','North','East'][i % 3]}));
  const byId = new Map(sessions.map((s, index) => [s.id, Array.from({length: 31}, (_, i) => ({
    ...rows({present: 1, late: 0, absent: 0, unknown: 0}, s.id)[0],
    studentRecordId: `withdrawn-${index}-${i}`, studentLevel: [null,'LEVEL_1','LEVEL_2','LEVEL_3','LEVEL_4'][i % 5],
    status: ['Present','Late','Absent','Unknown'][(index + i) % 4]
  }))]));
  const campus = api.buildAttendanceComparisonGroups(sessions, 'campus', id => byId.get(id));
  const level = api.buildAttendanceComparisonGroups(sessions, 'level', id => byId.get(id));
  const allRows = [...byId.values()].flat();
  const all = api.attendanceCountsForLevel(allRows, api.ALL_STUDENT_LEVELS);
  for (const key of ['expected','recorded','participating']) {
    const sum = groups => groups.reduce((total, group) => total + group[key], 0);
    assert.equal(sum(campus), sum(level));
  }
  assert.equal(level.reduce((sum, group) => sum + group.expected, 0), all.total);
  assert(level.some(group => group.key === api.UNASSIGNED_LEVEL));
  for (const group of level) {
    const counts = api.attendanceCountsForLevel(allRows, group.key);
    assert.equal(group.expected, counts.total);
    assert.equal(group.recorded, api.recordedAttendanceCount(counts));
    assert.equal(group.rate, counts.rate);
  }
});

test('class previews count all attention students before slicing and never call a future lesson recent', () => {
  const asOf = Date.parse('2026-10-17T03:00:00Z');
  const past = {...session('past'), date: '2026-10-16', startTime: '2026-10-15T21:00:00Z'};
  const future = {...session('future'), date: '2027-01-04', startTime: '2027-01-03T21:00:00Z'};
  const roster = Array.from({length: 5}, (_, i) => ({id: `S${i}`, name: `Student ${i}`, rate: i * 10}));
  const model = api.buildClassOverviewModel([future,past], roster, asOf);
  assert.equal(model.attentionTotal, 5);
  assert.equal(model.attentionPreview.length, 3);
  assert.deepEqual(model.recentSessions.map(s => s.id), ['past']);
  assert.equal(model.completedCount, 1);
  const html = render(api.ClassOverview, {attendance: {...example, rate: 92}, classSessions: [future],
    nextSession: null, roster, onViewSessions: noop, onViewStudents: noop, onOpenStudent: noop});
  assert(html.includes('5 students below 60% attendance'));
  assert(html.includes('Showing 3 of 5.'));
  assert(!html.includes('2027-01-04'));
});

test('completed evidence excludes scheduled/live/cancelled and premature future completions', () => {
  const asOf = Date.parse('2026-10-17T03:00:00Z');
  const base = {...session('a'), date: '2026-10-16', startTime: '2026-10-15T21:00:00Z'};
  assert(api.completedSessionBy(base, asOf));
  for (const status of ['Scheduled','Live','Cancelled']) assert(!api.completedSessionBy({...base,status}, asOf));
  assert(!api.completedSessionBy({...base,date: '2027-01-04', startTime: '2027-01-03T21:00:00Z'}, asOf));
});

test('personal evidence is matched by stable identity, not current course membership or another student number', () => {
  const student = {recordId: 'former-id', id: 'S1', studentNumber: 'S1', courses: ['NEW 101'], courseOfferingIds: ['new-offering']};
  const lesson = {...session('historical'), courseOfferingId: 'withdrawn-offering'};
  const record = {...rows({present: 1, late: 0, absent: 0, unknown: 0}, lesson.id)[0],studentRecordId: 'former-id'};
  assert.equal(api.studentAttendanceEvidence(student, [lesson], () => [record]).length, 1);
  assert.equal(api.studentAttendanceEvidence(student, [lesson], () => [{...record,studentRecordId:'another-id',studentNumber:'S1'}]).length, 0);
});

test('roster transport preserves current level and missing metadata remains an explicit unassigned bucket', () => {
  const raw = {id: null, studentId: 'withdrawn-student', studentNumber: 'S1', studentName: 'Example',
    studentLevel: 'LEVEL_3', sessionId: 'lesson', status: 'PRESENT', checkInTime: null, checkOutTime: null, source: 'MANUAL'};
  const mapped = api.mapAttendanceApiToUi(raw);
  assert.equal(mapped.studentLevel, 'LEVEL_3');
  assert.equal(api.attendanceCountsForLevel([mapped], 'LEVEL_3').present, 1);
  const legacy = api.mapAttendanceApiToUi({...raw, studentLevel: undefined});
  assert.equal(api.attendanceCountsForLevel([legacy], api.UNASSIGNED_LEVEL).present, 1);
  assert.equal(api.attendanceCountsForLevel([legacy], api.ALL_STUDENT_LEVELS).present, 1);
});
