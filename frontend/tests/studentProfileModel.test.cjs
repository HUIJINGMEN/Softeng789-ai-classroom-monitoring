const test = require('node:test');
const assert = require('node:assert/strict');

const modelPath = process.env.STUDENT_PROFILE_MODEL_PATH;
if (!modelPath) {
  throw new Error('STUDENT_PROFILE_MODEL_PATH must point to the compiled profile model.');
}

const { buildStudentProfileModel } = require(modelPath);

const student = {
  recordId: 'student-record-1',
  id: 'TEST-0001',
  studentNumber: '1000001',
  name: 'Test Student',
  course: 'COMPSCI 335',
  courses: ['COMPSCI 335', 'SOFTENG 789'],
  courseOfferingIds: ['offering-current'],
  rate: 67,
  status: 'Active',
  accountStatus: 'active',
  program: 'Engineering',
  email: 'student@example.test',
  seat: 'A1',
  level: 'LEVEL_2'
};

function session(id, course, date, courseOfferingId) {
  return {
    id,
    courseOfferingId,
    course,
    title: course,
    room: 'Room 1',
    date,
    dateLabel: date,
    time: '10:00–11:00',
    startTime: `${date}T10:00:00Z`,
    endTime: `${date}T11:00:00Z`,
    enrolled: 1,
    status: 'Completed'
  };
}

function event(id, studentId, status) {
  return {
    id,
    studentId,
    trackId: `track-${id}`,
    type: 'Leaving the seat area',
    sessionId: 'session-new',
    start: '10:15',
    duration: '30s',
    confidence: 0.9,
    status
  };
}

function accomplishment(id, achievementDate, correctionStatus = null) {
  return {
    id,
    studentId: student.recordId,
    studentName: student.name,
    studentNumber: student.studentNumber,
    courseOfferingId: 'course-1',
    classLabel: 'COMPSCI 335 · 2026',
    category: 'PROJECT',
    title: `Achievement ${id}`,
    description: null,
    studentNote: null,
    points: null,
    achievementDate,
    includeInReport: true,
    status: 'CONFIRMED',
    createdByTeacherId: 'teacher-1',
    createdByTeacherName: 'Teacher',
    confirmedByTeacherName: 'Teacher',
    createdAt: `${achievementDate}T00:00:00Z`,
    confirmedAt: `${achievementDate}T00:00:00Z`,
    revokedAt: null,
    acknowledgedAt: null,
    latestCorrection: correctionStatus
      ? {
          id: `correction-${id}`,
          status: correctionStatus,
          message: 'Please review the date.',
          staffResponse: null,
          requestedAt: `${achievementDate}T01:00:00Z`,
          reviewedAt: null,
          reviewedByTeacherName: null
        }
      : null
  };
}

test('builds one shared attendance model for desktop and mobile views', () => {
  const sessions = [
    session('session-old', 'COMPSCI 335', '2026-08-01'),
    session('session-new', 'SOFTENG 789', '2026-09-01'),
    session('session-middle', 'COMPSCI 335', '2026-08-15'),
    session('session-other', 'ENGSCI 233', '2026-09-10')
  ];
  const statuses = new Map([
    ['session-old', 'Present'],
    ['session-new', 'Absent'],
    ['session-middle', 'Unknown']
  ]);

  const model = buildStudentProfileModel({
    student,
    sessions,
    events: [],
    accomplishments: [],
    attendanceStatusFor: (_studentId, sessionId) => statuses.get(sessionId) ?? 'Unknown'
  });

  assert.deepEqual(model.courses, ['COMPSCI 335', 'SOFTENG 789']);
  assert.deepEqual(
    model.attendanceHistory.map((item) => item.id),
    ['session-new', 'session-middle', 'session-old']
  );
  assert.deepEqual(model.attendanceBreakdown, {
    present: 1,
    late: 0,
    absent: 1,
    unknown: 1,
    total: 3,
    rate: 67
  });
  assert.deepEqual(model.absences.map((item) => item.id), ['session-new']);
  assert.equal(model.attendanceAllUnrecorded, false);
  assert.equal(model.hasRecordedAttendance, true);
});

test('does not mix attendance from another offering of the same course', () => {
  const model = buildStudentProfileModel({
    student,
    sessions: [
      session('current', 'COMPSCI 335', '2026-09-01', 'offering-current'),
      session('old-term', 'COMPSCI 335', '2025-09-01', 'offering-old')
    ],
    events: [],
    accomplishments: [],
    attendanceStatusFor: () => 'Present'
  });

  assert.deepEqual(model.attendanceHistory.map((item) => item.id), ['current']);
});

test('includes only confirmed or corrected events belonging to the student', () => {
  const model = buildStudentProfileModel({
    student,
    sessions: [],
    events: [
      event('by-display-id', student.id, 'Confirmed'),
      event('by-record-id', student.recordId, 'Corrected'),
      event('by-number', student.studentNumber, 'Confirmed'),
      event('pending', student.id, 'Pending Review'),
      event('other-student', 'another-student', 'Confirmed')
    ],
    accomplishments: [],
    attendanceStatusFor: () => 'Unknown'
  });

  assert.deepEqual(
    model.confirmedEvents.map((item) => item.id),
    ['by-display-id', 'by-record-id', 'by-number']
  );
});

test('prioritises student change requests before recent achievements', () => {
  const model = buildStudentProfileModel({
    student,
    sessions: [],
    events: [],
    accomplishments: [
      accomplishment('recent', '2026-09-20'),
      accomplishment('pending-old', '2026-08-01', 'PENDING'),
      accomplishment('older', '2026-07-01'),
      accomplishment('pending-new', '2026-09-01', 'PENDING')
    ],
    attendanceStatusFor: () => 'Unknown'
  });

  assert.equal(model.achievementsNeedingReview, 2);
  assert.deepEqual(
    model.orderedAccomplishments.map((item) => item.id),
    ['pending-new', 'pending-old', 'recent', 'older']
  );
});
