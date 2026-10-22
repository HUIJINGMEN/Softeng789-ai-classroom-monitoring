const test = require('node:test');
const assert = require('node:assert/strict');

const schedule = require(process.env.CLASS_SCHEDULE_MODEL_PATH);

test('sorts school clock times across am/pm without mutating the source', () => {
  const sessions = [
    { id: 'afternoon', startTime: '2026-10-05T01:00:00Z' },
    { id: 'morning', startTime: '2026-10-05T20:00:00Z' },
    { id: 'midday', startTime: '2026-10-04T23:00:00Z' },
    { id: 'late-morning', startTime: '2026-10-04T21:00:00Z' }
  ];
  assert.deepEqual(schedule.sortScheduleByTime(sessions).map(item => item.id), ['morning', 'late-morning', 'midday', 'afternoon']);
  assert.equal(sessions[0].id, 'afternoon');
  assert.deepEqual(schedule.sortScheduleByTime([]), []);
});

test('canonical morning and afternoon instants sort by school clock in winter and summer', () => {
  for (const [date, morning, early, afternoon] of [
    ['2026-07-14', '2026-07-13T22:00:00Z', '2026-07-13T20:00:00Z', '2026-07-14T02:00:00Z'],
    ['2026-10-14', '2026-10-13T21:00:00Z', '2026-10-13T19:00:00Z', '2026-10-14T01:00:00Z']]) {
    const sessions = [
      { id: 'morning-10', date, startTime: morning },
      { id: 'afternoon-14', date, startTime: afternoon },
      { id: 'early-08', date, startTime: early }
    ];
    const original = JSON.stringify(sessions);
    assert.deepEqual(schedule.sortScheduleByTime(sessions).map(item => item.id), ['early-08', 'morning-10', 'afternoon-14']);
    assert.equal(JSON.stringify(sessions), original);
  }
});

test('selects a teaching week from unsorted dates across month and year boundaries', () => {
  assert.equal(schedule.initialScheduleWeekStart(['2027-02-03', 'invalid', '2026-12-30', '2027-01-06'], '2026-12-29'), '2026-12-28');
  assert.equal(schedule.initialScheduleWeekStart(['2027-02-03', '2027-01-06'], '2026-12-29'), '2027-01-04');
  assert.equal(schedule.initialScheduleWeekStart(['2027-02-03', '2027-01-06'], '2027-03-01'), '2027-02-01');
});

test('generates a bounded recurring timetable in chronological order', () => {
  const dates = schedule.generateScheduleDates({
    startDate: '2027-01-04',
    endDate: '2027-03-31',
    weekdays: [1, 3, 5],
    limit: 30
  });

  assert.equal(dates.length, 30);
  assert.deepEqual(dates.slice(0, 4), ['2027-01-04', '2027-01-06', '2027-01-08', '2027-01-11']);
  assert.equal(dates[29], '2027-03-12');
});

test('skips an excluded holiday and fills the requested lesson count', () => {
  const dates = schedule.generateScheduleDates({
    startDate: '2027-01-04',
    endDate: '2027-01-31',
    weekdays: [1, 3, 5],
    limit: 5,
    excludedDates: new Set(['2027-01-06'])
  });

  assert.deepEqual(dates, ['2027-01-04', '2027-01-08', '2027-01-11', '2027-01-13', '2027-01-15']);
});

test('returns no dates for an invalid range or empty weekly pattern', () => {
  assert.deepEqual(schedule.generateScheduleDates({
    startDate: '2027-02-01',
    endDate: '2027-01-01',
    weekdays: [1],
    limit: 10
  }), []);
  assert.deepEqual(schedule.generateScheduleDates({
    startDate: '2027-01-01',
    endDate: '2027-02-01',
    weekdays: [],
    limit: 10
  }), []);
});

test('reuses each weekday rule across later weeks', () => {
  const occurrences = schedule.generateScheduleOccurrences({
    startDate: '2027-01-04',
    endDate: '2027-01-17',
    rules: [
      { key: 'monday-morning', weekday: 1 },
      { key: 'wednesday-afternoon', weekday: 3 }
    ],
    limit: 20
  });

  assert.deepEqual(occurrences, [
    { date: '2027-01-04', ruleKey: 'monday-morning' },
    { date: '2027-01-06', ruleKey: 'wednesday-afternoon' },
    { date: '2027-01-11', ruleKey: 'monday-morning' },
    { date: '2027-01-13', ruleKey: 'wednesday-afternoon' }
  ]);
});

test('builds a Monday-to-Sunday timetable week and selects the next useful week', () => {
  assert.equal(schedule.scheduleWeekStart('2027-01-06'), '2027-01-04');
  assert.deepEqual(schedule.scheduleWeekDates('2027-01-04'), [
    '2027-01-04',
    '2027-01-05',
    '2027-01-06',
    '2027-01-07',
    '2027-01-08',
    '2027-01-09',
    '2027-01-10'
  ]);
  assert.equal(
    schedule.initialScheduleWeekStart(['2027-02-03', '2027-02-08'], '2027-01-12'),
    '2027-02-01'
  );
});

test('builds sessions and availability groups from one weekly rule model', () => {
  const rules = [
    { seriesId: 'series-mon', weekday: 1, startTime: '10:00', endTime: '11:00', override: null },
    {
      seriesId: 'series-wed',
      weekday: 3,
      startTime: '14:00',
      endTime: '15:30',
      override: { teacherEmail: 'wed@example.test', campusId: 'campus-b', roomId: 'room-b' }
    }
  ];
  const occurrences = [
    { date: '2027-01-04', ruleKey: '1' },
    { date: '2027-01-06', ruleKey: '3' }
  ];

  assert.deepEqual(schedule.buildScheduleSessions(occurrences, rules, {
    teacherEmail: 'default@example.test',
    campusId: 'campus-a',
    roomId: 'room-a'
  }), [
    {
      date: '2027-01-04', scheduleSeriesId: 'series-mon', roomId: 'room-a',
      teacherEmail: 'default@example.test', startTime: '10:00', endTime: '11:00'
    },
    {
      date: '2027-01-06', scheduleSeriesId: 'series-wed', roomId: 'room-b',
      teacherEmail: 'wed@example.test', startTime: '14:00', endTime: '15:30'
    }
  ]);
  assert.deepEqual(schedule.buildScheduleAvailabilityPayload('class-1', occurrences, rules), {
    courseOfferingId: 'class-1',
    groups: [
      { key: 'default', slots: [{ date: '2027-01-04', startTime: '10:00', endTime: '11:00' }] },
      { key: 'day-3', slots: [{ date: '2027-01-06', startTime: '14:00', endTime: '15:30' }] }
    ]
  });
});
