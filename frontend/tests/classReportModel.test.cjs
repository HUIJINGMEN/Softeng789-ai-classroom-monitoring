const test = require('node:test');
const assert = require('node:assert/strict');

const modelPath = process.env.CLASS_REPORT_MODEL_PATH;
if (!modelPath) {
  throw new Error('CLASS_REPORT_MODEL_PATH must point to the compiled class report model.');
}

const {
  buildClassReportSessionRows,
  feedbackWithinReportRange,
  filterClassReportSessionRows
} = require(modelPath);

const sessions = [
  {
    id: 'session-1',
    course: 'COMPSCI 335',
    title: 'COMPSCI 335',
    room: 'Room 1',
    campusName: 'City',
    date: '2026-09-02',
    dateLabel: '2 Sept 2026',
    time: '10:00–11:00',
    startTime: '2026-09-02T10:00:00Z',
    endTime: '2026-09-02T11:00:00Z',
    enrolled: 5,
    status: 'Completed'
  }
];

test('builds session rows using recorded marks as the attendance denominator', () => {
  const rows = buildClassReportSessionRows(sessions, () => ({
    present: 2,
    late: 1,
    absent: 1,
    unknown: 1,
    total: 5,
    rate: 60
  }));

  assert.deepEqual(rows, [
    {
      id: 'session-1',
      label: '2 Sept 2026',
      detail: '10:00–11:00 · City · Room 1',
      present: 2,
      late: 1,
      absent: 1,
      notRecorded: 1,
      attendanceRate: 75
    }
  ]);
});

test('filters session rows by date or location without changing the source list', () => {
  const rows = buildClassReportSessionRows(sessions, () => ({
    present: 0,
    late: 0,
    absent: 0,
    unknown: 5,
    total: 5,
    rate: 0
  }));

  assert.equal(rows[0].attendanceRate, null);
  assert.equal(filterClassReportSessionRows(rows, 'city').length, 1);
  assert.equal(filterClassReportSessionRows(rows, 'north').length, 0);
  assert.notEqual(filterClassReportSessionRows(rows, ''), rows);
});

test('keeps only class feedback created inside the selected Auckland date range', () => {
  const feedback = [
    { id: 'before', createdAt: '2026-09-01T00:00:00Z' },
    { id: 'inside', createdAt: '2026-09-02T00:00:00Z' },
    { id: 'after', createdAt: '2026-09-03T00:00:00Z' }
  ];

  const result = feedbackWithinReportRange(feedback, '2026-09-02', '2026-09-02');

  assert.deepEqual(result.map((item) => item.id), ['inside']);
});
