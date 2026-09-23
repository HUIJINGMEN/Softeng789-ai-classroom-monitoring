import { eventMatchesStudent } from '../../lib/eventDisplay';
import { studentCourses } from '../../lib/studentCourses';
import type {
  Accomplishment,
  AttendanceStatus,
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
  attendanceStatusFor: (studentId: string, sessionId: string) => AttendanceStatus;
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
  attendanceStatusFor
}: BuildStudentProfileModelOptions) {
  const courses = studentCourses(student);
  const attendanceHistory = sessions
    .filter((session) => courses.includes(session.course))
    .sort((left, right) => right.date.localeCompare(left.date));

  const attendanceBreakdown = attendanceHistory.reduce<StudentAttendanceBreakdown>(
    (totals, session) => {
      const status = attendanceStatusFor(student.id, session.id);
      if (status === 'Present') totals.present += 1;
      else if (status === 'Late') totals.late += 1;
      else if (status === 'Absent') totals.absent += 1;
      else totals.unknown += 1;
      totals.total += 1;
      return totals;
    },
    {
      present: 0,
      late: 0,
      absent: 0,
      unknown: 0,
      total: 0,
      rate: student.rate
    }
  );

  const confirmedEvents = events.filter(
    (event) =>
      eventMatchesStudent(event, student) &&
      (event.status === 'Confirmed' || event.status === 'Corrected')
  );
  const absences = attendanceHistory.filter(
    (session) => attendanceStatusFor(student.id, session.id) === 'Absent'
  );
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
