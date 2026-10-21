import { eventMatchesStudent } from '../../lib/eventDisplay';
import { studentCourses } from '../../lib/studentCourses';
import { attendanceCounts } from '../../lib/attendanceAnalytics';
import { studentAttendanceEvidence } from '../../lib/studentAttendanceEvidence';
import type {
  Accomplishment,
  AttendanceRow,
  CandidateEvent,
  Session,
  Student
} from '../../types';

export interface StudentAttendanceBreakdown {
  present: number;
  late: number;
  absent: number;
  unknown: number;
  total: number;
  rate: number | null;
}

interface BuildStudentProfileModelOptions {
  student: Student;
  sessions: Session[];
  events: CandidateEvent[];
  accomplishments: Accomplishment[];
  attendanceRowsForSession: (sessionId: string) => readonly AttendanceRow[];
}

/**
 * Builds the read-only data used by both desktop and responsive student-profile views.
 * Keeping these rules outside the page prevents the two layouts from drifting apart and makes
 * attendance/event filtering independently testable without rendering React.
 */
export function buildStudentProfileModel({
  student,
  sessions,
  events,
  accomplishments,
  attendanceRowsForSession
}: BuildStudentProfileModelOptions) {
  const courses = studentCourses(student);
  const evidence = studentAttendanceEvidence(student, sessions, attendanceRowsForSession);
  const attendanceHistory = evidence.map(item => item.session)
    .sort((left, right) => right.date.localeCompare(left.date));

  const attendanceBreakdown: StudentAttendanceBreakdown = attendanceCounts(evidence.map(item => item.row));

  const confirmedEvents = events.filter(
    (event) =>
      eventMatchesStudent(event, student) &&
      (event.status === 'Confirmed' || event.status === 'Corrected')
  );
  const absences = evidence.filter(item => item.row.status === 'Absent').map(item => item.session)
    .sort((left, right) => right.date.localeCompare(left.date));
  const orderedAccomplishments = [...accomplishments].sort((left, right) => {
    const leftNeedsReview = left.latestCorrection?.status === 'PENDING';
    const rightNeedsReview = right.latestCorrection?.status === 'PENDING';
    if (leftNeedsReview !== rightNeedsReview) return leftNeedsReview ? -1 : 1;
    return right.achievementDate.localeCompare(left.achievementDate);
  });

  return {
    courses,
    attendanceHistory,
    attendanceBreakdown,
    absences,
    confirmedEvents,
    orderedAccomplishments,
    attendanceAllUnrecorded:
      attendanceHistory.length > 0 && attendanceBreakdown.unknown === attendanceHistory.length,
    hasRecordedAttendance:
      attendanceBreakdown.present + attendanceBreakdown.late + attendanceBreakdown.absent > 0,
    achievementsNeedingReview: accomplishments.filter(
      (item) => item.latestCorrection?.status === 'PENDING'
    ).length
  };
}

export type StudentProfileModel = ReturnType<typeof buildStudentProfileModel>;
