const attendance = { completed: 8, present: 3, late: 1, absent: 2, unrecorded: 2, rate: 67 };
const snapshot = {
  student: { fullName: 'Example Student', studentNumber: 'EXAMPLE-001', email: 'student@example.test', programme: 'Engineering', level: 'LEVEL_2' },
  courses: [{ id: 'course-1', code: 'TEST 101', name: 'Software engineering', term: '2026 Teaching Year', teachers: ['Example Teacher'], enrolmentStatus: 'ACTIVE', attendance }],
  attendance,
  attendanceTrend: [
    { weekOf: '2026-08-17', attendance: { completed: 2, present: 1, late: 1, absent: 0, unrecorded: 0, rate: 100 } },
    { weekOf: '2026-08-24', attendance: { completed: 2, present: 1, late: 0, absent: 1, unrecorded: 0, rate: 50 } },
    { weekOf: '2026-08-31', attendance: { completed: 2, present: 1, late: 0, absent: 1, unrecorded: 0, rate: 50 } },
    { weekOf: '2026-09-07', attendance: { completed: 2, present: 0, late: 0, absent: 0, unrecorded: 2, rate: null } }
  ],
  confirmedEvents: [{ type: 'Hand raise', count: 4 }, { type: 'Discussion', count: 2 }],
  feedbackCount: 2,
  payments: { invoices: [{ number: 'EXAMPLE-INV-001', currency: 'NZD', issued: '2026-09-01', due: '2026-10-21', charges: 500, credits: 0, received: 250, balance: 250, awaitingVerification: 250, status: 'PENDING' }], excludedInvoices: 1 }
};
module.exports.exampleReport = () => ({
  id: 'example-report', studentId: 'example-student', studentName: 'Example Student', version: 1,
  createdAt: '2026-10-12T07:56:00Z', publishedAt: null,
  document: { dateFrom: '2026-08-12', dateTo: '2026-10-12', courseOfferingIds: ['course-1'], courseLabels: ['TEST 101 · 2026 Teaching Year'], snapshot: structuredClone(snapshot),
    sections: ['ATTENDANCE', 'PAYMENTS', 'ABSENCES', 'LEARNING'].map((topic, index) => ({ topic,
      title: ['Attendance', 'Payments', 'Absences & make-ups', 'Teacher feedback summary'][index],
      text: [
        'Of 8 past scheduled lessons applicable to your enrolment, you attended 4 (3 present and 1 late). 2 absences are recorded. Your attendance rate among recorded marks is 67%. 2 lessons have no recorded mark; these are not counted as absences. Please let the teaching team know if any of these records need checking.',
        'Thank you for the confirmed net payments of NZD 250.00 for these invoices. The current outstanding balance is NZD 250.00. The earliest recorded due date for an unpaid invoice is 21 Oct 2026. Payment details for NZD 250.00 are awaiting verification and have not reduced this balance. Please check their status with the team before making another transfer.\n\nFigures cover the included invoices at preparation, not just activity in the reporting period or the whole account. Please contact the team if any details need checking.',
        'Two absences were recorded during this period. No reasons were recorded for these absences. Please contact the teaching team if any details or make-up arrangements need checking.',
        'Your teacher noted clear explanations during discussions and useful contributions to group work. Some test evidence was incomplete.\n\nStrengths\nYour explanations helped the group understand the work.\n\nNext steps\nA helpful next step could be to complete the missing test evidence and check it against the task requirements.'
      ][index], evidence: ['PRIVATE SOURCE RECORD'], fingerprint: 'student-report-v2:' + topic, provider: index < 2 ? 'RECORDS' : 'QWEN:test', reviewed: true, stale: false, reviewedBy: 'Example Teacher', reviewedAt: '2026-10-12T07:56:00Z'
    })) }
});
module.exports.exampleReportWithSources = () => {
  const report = module.exports.exampleReport();
  const dates = ['2026-08-17', '2026-08-18', '2026-08-24', '2026-08-25', '2026-08-31', '2026-09-01', '2026-09-07', '2026-09-08'];
  const statuses = ['PRESENT', 'LATE', 'PRESENT', 'ABSENT', 'PRESENT', 'ABSENT', 'UNKNOWN', 'UNKNOWN'];
  report.document.snapshot.sources = {
    lessons: dates.map((date, index) => ({ sessionId: 'lesson-' + index, courseOfferingId: 'course-1', courseLabel: 'TEST 101',
      date, startsAt: date + 'T00:00:00Z', status: statuses[index] })),
    feedback: [
      { id: 'note-2', courseLabel: 'TEST 101', teacherName: 'Example Teacher', recordedAt: '2026-09-10T00:00:00Z', excerpt: 'Teacher source: clear explanations; please include more test evidence.' },
      { id: 'note-1', courseLabel: 'TEST 101', teacherName: 'Example Teacher', recordedAt: '2026-09-01T00:00:00Z', excerpt: 'Teacher source: useful contributions to group work.' },
    ],
    achievements: [{ id: 'award-1', courseLabel: 'TEST 101', date: '2026-09-10', title: 'Confirmed project milestone', category: 'PROJECT', points: 0 }],
    pendingCorrections: 1,
  };
  report.document.sections.push({ ...report.document.sections[0], topic: 'ACHIEVEMENTS', title: 'Achievements', text: 'Your teacher confirmed a project milestone.' });
  return report;
};
