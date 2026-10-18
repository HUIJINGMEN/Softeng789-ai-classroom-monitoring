const test = require('node:test');
const assert = require('node:assert/strict');

const modelPath = process.env.ATTENDANCE_TREND_MODEL_PATH;
if (!modelPath) {
  throw new Error('ATTENDANCE_TREND_MODEL_PATH must point to the compiled trend model.');
}

const { buildAttendanceTrendSeries } = require(modelPath);

function session(id, date, dateLabel, course = 'COMPSCI 335') {
  return {
    id,
    course,
    title: course,
    room: 'Room 1',
    campusName: 'City',
    date,
    dateLabel,
    time: '10:00–11:00',
    startTime: `${date}T10:00:00Z`,
    endTime: `${date}T11:00:00Z`,
    enrolled: 5,
    status: 'Completed'
  };
}

function counts(present, late, absent, unknown = 0) {
  const total = present + late + absent + unknown;
  return {
    present,
    late,
    absent,
    unknown,
    total,
    rate: total === 0 ? 0 : Math.round(((present + late) / total) * 100)
  };
}

test('keeps sparse sessions individually navigable and sorted by date', () => {
  const sessions = [
    session('later', '2026-09-02', '2 Sept 2026'),
    session('earlier', '2026-09-01', '1 Sept 2026')
  ];
  const byId = new Map([
    ['later', counts(3, 1, 1)],
    ['earlier', counts(4, 0, 1)]
  ]);

  const series = buildAttendanceTrendSeries(sessions, (id) => byId.get(id));

  assert.equal(series.aggregateByDay, false);
  assert.deepEqual(series.pointMeta.map((point) => point.sessionId), ['earlier', 'later']);
  assert.deepEqual(series.points.map((point) => point.rate), [80, 80]);
});

test('aggregates multiple sessions on the same day into one non-navigable point', () => {
  const sessions = [
    session('morning', '2026-09-01', '1 Sept 2026'),
    session('afternoon', '2026-09-01', '1 Sept 2026', 'SOFTENG 789')
  ];
  const byId = new Map([
    ['morning', counts(3, 1, 1)],
    ['afternoon', counts(2, 0, 3)]
  ]);

  const series = buildAttendanceTrendSeries(sessions, (id) => byId.get(id));

  assert.equal(series.aggregateByDay, true);
  assert.equal(series.points.length, 1);
  assert.equal(series.points[0].rate, 60);
  assert.equal(series.points[0].sub, '2 sessions');
  assert.deepEqual(series.pointMeta[0], {
    title: '2 sessions',
    dateLabel: '1 Sept 2026',
    present: 5,
    late: 1,
    absent: 4,
    unknown: 0,
    total: 10,
    sessionId: null
  });
});

test('drops sessions without an attendance denominator', () => {
  const sessions = [
    session('empty', '2026-09-01', '1 Sept 2026'),
    session('recorded', '2026-09-02', '2 Sept 2026')
  ];
  const byId = new Map([
    ['empty', counts(0, 0, 0)],
    ['recorded', counts(4, 0, 1)]
  ]);

  const series = buildAttendanceTrendSeries(sessions, (id) => byId.get(id));

  assert.deepEqual(series.pointMeta.map((point) => point.sessionId), ['recorded']);
});

test('unknown-only sessions are not plotted as zero and supplied legacy rates are ignored', () => {
  const sessions = [session('unknown', '2026-09-01', '1 Sept 2026'), session('recorded', '2026-09-02', '2 Sept 2026')];
  const byId = new Map([['unknown', counts(0, 0, 0, 80)], ['recorded', counts(20, 4, 2, 54)]]);
  const series = buildAttendanceTrendSeries(sessions, id => byId.get(id));
  assert.deepEqual(series.pointMeta.map(point => point.sessionId), ['recorded']);
  assert.deepEqual(series.points.map(point => point.rate), [92]);
});

test('daily rates weight recorded marks and preserve missing counts alongside recorded sessions', () => {
  const sessions = [session('a', '2026-09-01', '1 Sept 2026'), session('b', '2026-09-01', '1 Sept 2026'),
    session('missing-day', '2026-09-02', '2 Sept 2026')];
  const byId = new Map([['a', counts(1, 0, 0, 99)], ['b', counts(0, 0, 9)], ['missing-day', counts(0, 0, 0, 40)]]);
  const series = buildAttendanceTrendSeries(sessions, id => byId.get(id));
  assert.equal(series.aggregateByDay, true);
  assert.equal(series.points.length, 1);
  assert.equal(series.points[0].rate, 10);
  assert.equal(series.pointMeta[0].unknown, 99);
  assert.equal(series.pointMeta[0].total, 109);
});
