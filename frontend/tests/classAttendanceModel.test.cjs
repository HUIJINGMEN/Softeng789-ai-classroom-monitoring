const test = require('node:test');
const assert = require('node:assert/strict');

const modelPath = process.env.CLASS_ATTENDANCE_MODEL_PATH;
if (!modelPath) {
  throw new Error('CLASS_ATTENDANCE_MODEL_PATH must point to the compiled class attendance model.');
}

const { buildAttendanceRoster, filterAttendanceRoster } = require(modelPath);

const attendanceRows = [
  {
    studentRecordId: 'student-2',
    studentNumber: 'DEMO-2602',
    studentName: 'Ethan Smith',
    status: 'Absent'
  },
  {
    studentRecordId: 'student-1',
    studentNumber: 'DEMO-2601',
    studentName: 'Ana Ngata',
    status: 'Present'
  },
  {
    studentRecordId: 'withdrawn-student',
    studentNumber: 'DEMO-2500',
    studentName: 'Former Student',
    status: 'Late'
  }
];

test('builds the session roster from attendance rows and only enriches photos from current students', () => {
  const roster = buildAttendanceRoster(attendanceRows, [
    { recordId: 'student-1', id: 'DEMO-2601', name: 'Ana Ngata', registrationPhoto: '/ana.jpg' }
  ]);

  assert.deepEqual(roster.map((row) => row.studentName), [
    'Ana Ngata',
    'Ethan Smith',
    'Former Student'
  ]);
  assert.equal(roster[0].photoUrl, '/ana.jpg');
  assert.equal(roster[0].profileAvailable, true);
  assert.equal(roster[2].studentId, 'withdrawn-student');
  assert.equal(roster[2].photoUrl, undefined);
  assert.equal(roster[2].profileAvailable, false);
});

test('filters the roster by status, name and student number without mutating it', () => {
  const roster = buildAttendanceRoster(attendanceRows, []);

  assert.deepEqual(
    filterAttendanceRoster(roster, '', 'Absent').map((row) => row.studentNumber),
    ['DEMO-2602']
  );
  assert.deepEqual(
    filterAttendanceRoster(roster, 'former', 'All').map((row) => row.studentNumber),
    ['DEMO-2500']
  );
  assert.deepEqual(
    filterAttendanceRoster(roster, '2601', 'Present').map((row) => row.studentName),
    ['Ana Ngata']
  );
  assert.equal(roster.length, 3);
});
