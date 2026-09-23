const test = require('node:test');
const assert = require('node:assert/strict');

const modelPath = process.env.SESSION_ATTENDANCE_MODEL_PATH;
if (!modelPath) {
  throw new Error('SESSION_ATTENDANCE_MODEL_PATH must point to the compiled session model.');
}

const {
  attendanceCounts,
  attendanceRowsForSession,
  buildSessionCourseOptions,
  buildSessionDateOptions,
  emptyAttendanceCounts,
  upsertAttendanceRow
} = require(modelPath);

function row(studentRecordId, status) {
  return {
    id: `attendance-${studentRecordId}`,
    studentRecordId,
    studentNumber: studentRecordId,
    studentName: studentRecordId,
    sessionId: 'session-1',
    status,
    checkInTime: null,
    checkOutTime: null,
    source: null
  };
}

test('counts attendance statuses and keeps empty enrolments explicit', () => {
  assert.deepEqual(
    attendanceCounts([
      row('1', 'Present'),
      row('2', 'Late'),
      row('3', 'Absent'),
      row('4', 'Unknown')
    ]),
    { present: 1, late: 1, absent: 1, unknown: 1, total: 4, rate: 50 }
  );
  assert.deepEqual(
    emptyAttendanceCounts(3),
    { present: 0, late: 0, absent: 0, unknown: 3, total: 3, rate: 0 }
  );
});

test('upserts one student attendance row without duplicating the student', () => {
  const original = [row('1', 'Present'), row('2', 'Unknown')];
  const updated = upsertAttendanceRow(original, row('2', 'Late'));
  const appended = upsertAttendanceRow(updated, row('3', 'Absent'));

  assert.deepEqual(updated.map((item) => item.status), ['Present', 'Late']);
  assert.deepEqual(appended.map((item) => item.studentRecordId), ['1', '2', '3']);
  assert.deepEqual(original.map((item) => item.status), ['Present', 'Unknown']);
});

test('selects current or cached session rows and builds stable filter options', () => {
  const selected = [row('1', 'Present')];
  const cached = { other: [row('2', 'Late')] };
  assert.deepEqual(attendanceRowsForSession('selected', 'selected', selected, cached), selected);
  assert.deepEqual(attendanceRowsForSession('other', 'selected', selected, cached), cached.other);

  const sessions = [
    { date: '2026-09-02', dateLabel: '2 Sept 2026', course: 'SOFTENG 789' },
    { date: '2026-09-01', dateLabel: '1 Sept 2026', course: 'COMPSCI 335' }
  ];
  assert.deepEqual(buildSessionDateOptions(sessions), [
    { value: 'all', label: 'All dates' },
    { value: '2026-09-02', label: '2 Sept 2026' },
    { value: '2026-09-01', label: '1 Sept 2026' }
  ]);

  const students = [{ course: 'COMPSCI 335', courses: ['COMPSCI 335', 'ENGSCI 233'] }];
  assert.deepEqual(buildSessionCourseOptions(sessions, students), [
    'All courses',
    'COMPSCI 335',
    'ENGSCI 233',
    'SOFTENG 789'
  ]);
});
