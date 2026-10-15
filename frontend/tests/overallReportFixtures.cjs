function exampleOverallReport(audience = 'INTERNAL') {
  const attendance = { completed: 10, present: 4, late: 1, absent: 1, unrecorded: 4, rate: 83 };
  return {
    id: 'overall-1', version: 2, createdAt: '2026-10-12T02:30:00Z', finalizedAt: null,
    privacyReviewedBy: null, privacyReviewedAt: null,
    document: {
      dateFrom: '2026-08-12', dateTo: '2026-10-12', audience, courseOfferingIds: [],
      sections: ['OVERVIEW', 'ATTENDANCE', 'ABSENCES', 'LEARNING'].map((topic, index) => ({
        topic, title: ['Executive summary', 'Attendance & recording quality', 'Absence follow-up', 'Teaching feedback & next steps'][index],
        text: {
          OVERVIEW: 'This report covers one course and three distinct students, with five completed sessions in the selected period. Two class-wide teacher feedback notes are available. Read attendance alongside recording completeness; these figures do not measure individual engagement or establish learning improvement.',
          ATTENDANCE: 'Four present, one late and one absent marks are recorded. Four expected marks are not recorded; these are not absences. Attendance among recorded marks is 83%. Incomplete records limit how confidently these figures describe the whole reporting scope.',
          ABSENCES: 'One absence mark is recorded. No individual absence reasons are included. Follow-up should be based on checked records and the arrangements actually recorded. An absence does not automatically require a make-up, and a booking does not prove completion.',
          LEARNING: 'Recorded teacher feedback describes thoughtful discussion. Continue encouraging students to explain their reasoning.'
        }[topic], evidence: ['PRIVATE SOURCE RECORD'], fingerprint: 'fixture-' + topic,
        reviewed: true, stale: false, provider: 'RECORDS', reviewedBy: 'Report Reviewer', reviewedAt: '2026-10-12T02:30:00Z'
      })),
      snapshot: {
        preparedAt: '2026-10-12T02:30:00Z', preparedBy: 'Report Reviewer', allCourses: true, studentCount: 3,
        completedSessions: 5, attendance, attendanceTrend: [{ weekOf: '2026-09-07', attendance }],
        confirmedEvents: [{ type: 'Discussion', count: 3 }], feedbackCount: 2, achievements: 1,
        courses: [{ id: 'course-1', code: 'TEST 101', term: '2026 Teaching Year', students: 3, completedSessions: 5, attendance, feedbackCount: 2 }],
        creditDecisions: audience === 'INTERNAL' ? [{ status: 'AVAILABLE', count: 1 }] : [],
        actions: audience === 'INTERNAL' ? [{ courseOfferingId: 'course-1', courseLabel: 'TEST 101', issue: 'Incomplete attendance', count: 4, nextStep: 'Record missing attendance.' }] : []
      }
    }
  };
}
module.exports = { exampleOverallReport };
module.exports.exampleOverallReportWithRoster = () => {
  const report = exampleOverallReport();
  report.document.snapshot.students = [
    { id: 'student-1', name: 'Example Student', number: 'EXAMPLE001', attendance: { completed: 4, present: 2, late: 1, absent: 0, unrecorded: 1, rate: 100 } },
    { id: 'student-2', name: 'Second Student', number: 'EXAMPLE002', attendance: { completed: 3, present: 1, late: 0, absent: 1, unrecorded: 1, rate: 50 } },
    { id: 'student-3', name: 'Third Student', number: 'EXAMPLE003', attendance: { completed: 3, present: 1, late: 0, absent: 0, unrecorded: 2, rate: 100 } }
  ].map(student => ({ ...student, courses: [{ id: 'course-1', label: 'TEST 101 · 2026 Teaching Year' }] }));
  return report;
};
