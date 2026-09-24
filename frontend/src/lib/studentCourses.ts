import type { Session, Student } from '../types';

export function studentCourses(student: Student): string[] {
  return student.courses?.length ? student.courses : [student.course];
}

export function studentCourseLabel(student: Student): string {
  return studentCourses(student).join(', ');
}

/** Prefer the exact class offering so two terms of the same course are never mixed together. */
export function studentIsEnrolledInSession(student: Student, session: Session): boolean {
  if (session.courseOfferingId && student.courseOfferingIds?.length) {
    return student.courseOfferingIds.includes(session.courseOfferingId);
  }
  return studentCourses(student).includes(session.course);
}
