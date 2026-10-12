const test = require('node:test');
const assert = require('node:assert/strict');

const overview = require(process.env.STUDENT_OVERVIEW_MODEL_PATH);

function account(studentId, studentName, state, courses = []) {
  return {
    studentId,
    studentName,
    studentNumber: `NUMBER-${studentId}`,
    courses,
    issued: 0,
    received: 0,
    balance: 0,
    paymentReported: 0,
    invoiceCount: 0,
    draftCount: 0,
    pendingEvidenceCount: 0,
    unbilledCourseCount: 0,
    unbilledCourses: [],
    nextDueDate: null,
    primaryInvoiceId: null,
    primaryInvoiceTitle: null,
    state,
    currency: 'NZD'
  };
}

function cell(sessionId, attendanceStatus) {
  return {
    sessionId,
    attendanceRecordId: null,
    attendanceStatus,
    lessonCreditId: null,
    creditStatus: null,
    absenceReason: null,
    absenceNote: null,
    decisionNote: null,
    originalSessionId: null,
    originalSessionDate: null,
    makeupSessionId: null,
    makeupSessionDate: null,
    uncoveredAttendance: false
  };
}

function reconciliation(courseOfferingId, courseCode, studentId, sessionId, attendanceStatus) {
  return {
    courseOfferingId,
    courseCode,
    academicTerm: '2026',
    view: 'WEEK',
    weekStart: '2026-10-05',
    weekEnd: '2026-10-11',
    sessions: [{
      id: sessionId,
      date: sessionId === 'session-a' ? '2026-10-06' : '2026-10-08',
      startTime: sessionId === 'session-a' ? '2026-10-06T09:00:00Z' : '2026-10-08T09:00:00Z',
      endTime: sessionId === 'session-a' ? '2026-10-06T10:00:00Z' : '2026-10-08T10:00:00Z',
      status: 'COMPLETED',
      room: '101',
      campus: null
    }],
    summary: {
      totalStudents: 1,
      fullyReconciled: 0,
      paymentIssues: 0,
      makeupDue: 0,
      expiringCredits: 0,
      attendanceNotRecorded: attendanceStatus === 'UNKNOWN' ? 1 : 0,
      uncoveredAttendance: 0
    },
    rows: [{
      studentId,
      studentName: studentId === 'student-a' ? 'Ana' : 'Ben',
      studentNumber: `NUMBER-${studentId}`,
      packageId: null,
      invoiceId: null,
      paymentStatus: null,
      balance: null,
      currency: 'NZD',
      purchaseMode: null,
      purchasedSessions: 0,
      activeSessions: 0,
      pendingSessions: 0,
      usedSessions: 0,
      remainingSessions: 0,
      makeupDue: 0,
      expiringSessions: 0,
      uncoveredAttendance: 0,
      needsAttention: attendanceStatus === 'UNKNOWN',
      cells: [cell(sessionId, attendanceStatus)]
    }],
    page: 0,
    size: 100,
    totalItems: 1,
    totalPages: 1,
    hasPrevious: false,
    hasNext: false
  };
}

const source = {
  accounts: [
    account('student-a', 'Ana', 'PAID', ['ART 101']),
    account('student-b', 'Ben', 'PAYMENT_DUE', ['MATH 202']),
    account('student-c', 'Cara', 'NO_PAYMENT_DUE')
  ],
  reconciliations: [
    reconciliation('course-a', 'ART 101', 'student-a', 'session-a', 'UNKNOWN'),
    reconciliation('course-b', 'MATH 202', 'student-b', 'session-b', 'PRESENT')
  ]
};

test('all-classes overview keeps every student and marks unrelated sessions as no class', () => {
  const result = overview.buildStudentOverview(source, {
    courseOfferingId: 'ALL_CLASSES',
    query: '',
    exceptionsOnly: false,
    page: 0,
    size: 25
  });

  assert.equal(result.summary.totalStudents, 3);
  assert.equal(result.sessions.length, 2);
  assert.deepEqual(result.rows[0].cells.map((item) => item.kind), ['LESSON', 'NO_CLASS']);
  assert.deepEqual(result.rows[1].cells.map((item) => item.kind), ['NO_CLASS', 'LESSON']);
  assert.deepEqual(result.rows[2].cells.map((item) => item.kind), ['NO_CLASS', 'NO_CLASS']);
});

test('no-class cells never inflate the not-recorded count', () => {
  const result = overview.buildStudentOverview(source, {
    courseOfferingId: 'ALL_CLASSES',
    query: '',
    exceptionsOnly: false,
    page: 0,
    size: 25
  });

  assert.equal(result.summary.attendanceNotRecorded, 1);
  assert.equal(result.rows.find((row) => row.account.studentId === 'student-c').notRecorded, 0);
});

test('a class filter shows only students enrolled in that class', () => {
  const result = overview.buildStudentOverview(source, {
    courseOfferingId: 'course-b',
    query: '',
    exceptionsOnly: false,
    page: 0,
    size: 25
  });

  assert.deepEqual(result.rows.map((row) => row.account.studentId), ['student-b']);
  assert.equal(result.sessions.length, 1);
  assert.equal(result.rows[0].cells[0].kind, 'LESSON');
});
