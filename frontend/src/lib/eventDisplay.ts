import type { CandidateEvent, Session, Student } from '../types';

export function eventSubjectLabel(event: CandidateEvent, students: readonly Student[]): string {
  const student = event.studentId ? findEventStudent(event.studentId, students) : null;
  return student ? `${student.name} (${event.trackId})` : `Unidentified · ${event.trackId}`;
}

export function eventStudentName(event: CandidateEvent, students: readonly Student[]): string {
  const student = event.studentId ? findEventStudent(event.studentId, students) : null;
  return student?.name ?? 'Not identified';
}

export function eventMatchesStudent(event: CandidateEvent, student: Student): boolean {
  return Boolean(
    event.studentId &&
      (event.studentId === student.id ||
        event.studentId === student.recordId ||
        event.studentId === student.studentNumber)
  );
}

export function eventSessionLabel(event: CandidateEvent, sessions: readonly Session[]): string {
  const session = sessions.find((candidate) => candidate.id === event.sessionId);
  return session ? sessionDisplayName(session) : 'Unknown session';
}

export function sessionDisplayName(session: Session): string {
  return `${session.course} · ${session.room}`;
}

function findEventStudent(studentId: string, students: readonly Student[]): Student | undefined {
  return students.find(
    (student) =>
      student.id === studentId ||
      student.recordId === studentId ||
      student.studentNumber === studentId
  );
}
