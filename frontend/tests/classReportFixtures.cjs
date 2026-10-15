function exampleClassReport() {
  const attendance = { completed: 8, present: 3, late: 1, absent: 2, unrecorded: 2, rate: 67 };
  return {
    id: 'class-report-1', courseOfferingId: 'course-1', classLabel: 'TEST 101 · 2026', version: 0,
    createdAt: '2026-10-12T00:00:00Z', finalizedAt: null,
    document: {
      dateFrom: '2026-08-12', dateTo: '2026-10-12',
      sections: ['ATTENDANCE', 'PAYMENTS', 'ABSENCES', 'LEARNING'].map((topic, index) => ({
        topic, title: ['Class attendance', 'Class payments', 'Absences & make-ups', 'Class teacher feedback'][index],
        evidence: ['PRIVATE SOURCE RECORD'], fingerprint: 'fixture-' + topic, text: 'Reviewed ' + topic,
        provider: 'QWEN:test', reviewed: true, stale: false, reviewedBy: 'Example Teacher', reviewedAt: '2026-10-12T02:30:00Z'
      })),
      snapshot: {
        course: { id: 'course-1', code: 'TEST 101', name: 'Class report example', term: '2026 Teaching Year', teachers: ['Example Teacher'] },
        preparedAt: '2026-10-12T02:30:00Z', completedSessions: 4, attendance,
        studentCount: 2,
        students: [
          { id: 'student-1', name: 'Example Student', number: 'EXAMPLE001', attendance: { completed: 4, present: 2, late: 0, absent: 1, unrecorded: 1, rate: 67 } },
          { id: 'student-2', name: 'Second Student', number: 'EXAMPLE002', attendance: { completed: 4, present: 1, late: 1, absent: 1, unrecorded: 1, rate: 67 } }
        ],
        sessions: [{ id: 'lesson-1', date: '2026-09-01', startTime: '2026-08-31T22:00:00Z', room: 'Room 1', attendance: { completed: 2, present: 1, late: 0, absent: 1, unrecorded: 0, rate: 50 } }],
        attendanceTrend: [{ weekOf: '2026-08-31', attendance }], confirmedEvents: [{ type: 'Discussion', count: 3 }], feedbackCount: 1,
        payments: { totals: [
          { currency: 'NZD', invoices: 2, charges: 500, credits: 0, received: 250, balance: 250, awaitingVerification: 250 },
          { currency: 'USD', invoices: 1, charges: 100, credits: 0, received: 100, balance: 0, awaitingVerification: 0 }
        ], excludedInvoices: 1, studentsWithoutInvoice: 1 }
      }
    }
  };
}
module.exports = { exampleClassReport };
module.exports.exampleClassReportWithSources = () => {
  const report = exampleClassReport();
  const snapshot = report.document.snapshot;
  snapshot.sessions = Array.from({ length: 4 }, (_, index) => ({ id: 'lesson-' + index, date: '2026-09-0' + (index + 1),
    startTime: '2026-09-0' + (index + 1) + 'T00:00:00Z', room: 'Room 1',
    attendance: [
      { completed: 2, present: 1, late: 0, absent: 1, unrecorded: 0, rate: 50 },
      { completed: 2, present: 1, late: 1, absent: 0, unrecorded: 0, rate: 100 },
      { completed: 2, present: 1, late: 0, absent: 1, unrecorded: 0, rate: 50 },
      { completed: 2, present: 0, late: 0, absent: 0, unrecorded: 2, rate: null },
    ][index] }));
  snapshot.sources = {
    feedback: [{ id: 'class-note', courseLabel: 'TEST 101', teacherName: 'Example Teacher', recordedAt: '2026-09-10T00:00:00Z',
      excerpt: 'Class source: students explained their approaches; more test evidence would help.' }],
  };
  return report;
};
