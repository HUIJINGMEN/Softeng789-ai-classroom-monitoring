import type { Student } from '../types';

export function studentCourses(student: Student): string[] {
  return student.courses?.length ? student.courses : [student.course];
}

export function studentCourseLabel(student: Student): string {
  return studentCourses(student).join(', ');
}
