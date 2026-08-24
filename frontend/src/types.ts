export type Page =
  | 'dashboard'
  | 'live'
  | 'attendance'
  | 'students'
  | 'events'
  | 'reports'
  | 'settings';

export type Theme = 'dark' | 'light';

export type UserRole = 'student' | 'teacher';

export interface AuthUser {
  token: string;
  role: UserRole;
  /** Backend UUID for the student or teacher record. */
  id: string;
  name: string;
  email: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterStudentPayload {
  studentNumber: string;
  universityEmail: string;
  fullName: string;
  course: string;
  password: string;
  consentGiven: boolean;
}

export interface RegisterTeacherPayload {
  staffNumber: string;
  email: string;
  name: string;
  password: string;
}

export interface StudentAttendanceHistoryEntry {
  sessionId: string;
  course: string;
  room: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  status: AttendanceStatus;
  checkInTime: string | null;
  checkOutTime: string | null;
  source: AttendanceSource | null;
}

export type AttendanceStatus = 'Present' | 'Late' | 'Absent' | 'Unknown';

export type AttendanceSource = 'MANUAL' | 'AI';

export type SessionStatusCode = 'SCHEDULED' | 'ACTIVE' | 'COMPLETED';

export type EventStatus = 'Pending Review' | 'Confirmed' | 'Rejected' | 'Corrected';

export type EventType =
  | 'Prolonged head-down posture'
  | 'Leaving the seat area'
  | 'Potential peer interaction'
  | 'Extended off-desk hand movement'
  | 'No observable concern (false positive)';

export type MonitorState = 'stopped' | 'running' | 'paused';

export type StudentRecordStatus = 'Active' | 'At risk' | 'Enrolment pending';

export type FaceEnrollmentStatus = 'NOT_ENROLLED' | 'PHOTO_CAPTURED' | 'FAILED';

export type FaceEnrollmentPose =
  | 'front'
  | 'slight_left'
  | 'left'
  | 'slight_right'
  | 'right'
  | 'chin_up'
  | 'chin_down'
  | 'blink';

export interface Session {
  id: string;
  /** Backend UUID. Present when the session was loaded from Spring Boot. */
  recordId?: string;
  courseOfferingId?: string | null;
  courseOfferingCode?: string | null;
  course: string;
  title: string;
  room: string;
  roomId?: string | null;
  teacherId?: string | null;
  teacherName?: string | null;
  teacherEmail?: string | null;
  /** ISO date, used for range filters and sorting. */
  date: string;
  dateLabel: string;
  time: string;
  enrolled: number;
  status: 'Scheduled' | 'Live' | 'Completed';
  statusCode?: SessionStatusCode;
}

export interface NewClassroomSession {
  course: string;
  room: string;
  teacherName: string;
  teacherEmail: string;
  date: string;
  startTime: string;
  endTime: string;
}

export interface AttendanceRow {
  id: string | null;
  studentRecordId: string;
  studentNumber: string;
  studentName: string;
  sessionId: string;
  status: AttendanceStatus;
  checkInTime: string | null;
  checkOutTime: string | null;
  source: AttendanceSource | null;
}

export interface Student {
  /** Backend UUID. Present when the record was loaded from Spring Boot. */
  recordId?: string;
  id: string;
  studentNumber?: string;
  name: string;
  /** Primary course, kept for backwards-compatible filters and summaries. */
  course: string;
  /** All course enrolments for this student. */
  courses?: string[];
  /** Overall attendance rate as a percentage. Null until the backend exposes an aggregate. */
  rate: number | null;
  status: StudentRecordStatus;
  program: string;
  email: string;
  seat: string;
  /** Frontend prototype capture used for supervised classroom registration. */
  registrationPhoto?: string;
  registeredAt?: string;
  consentRecorded?: boolean;
  faceEnrollmentStatus?: FaceEnrollmentStatus;
  faceEnrollmentMessage?: string;
  faceEnrollmentCaptures?: FaceEnrollmentCapture[];
}

export interface FaceEnrollmentCapture {
  pose: FaceEnrollmentPose;
  label: string;
  photo: string;
  qualityScore: number;
  poseScore: number;
  capturedAt: string;
  optional?: boolean;
}

export interface NewStudentRegistration {
  studentNumber: string;
  universityEmail: string;
  firstName: string;
  lastName: string;
  course: string;
  courses: string[];
  seat: string;
  programme: string;
  consentGiven: boolean;
  registrationPhoto: string;
  faceEnrollmentCaptures: FaceEnrollmentCapture[];
}

export interface CandidateEvent {
  id: string;
  /** Null when the tracked person was never linked to a student record. */
  studentId: string | null;
  trackId: string;
  type: EventType;
  sessionId: string;
  start: string;
  duration: string;
  /** Detector score 0–1. Not a probability of being correct. */
  confidence: number;
  status: EventStatus;
  correctedFrom?: EventType;
}

export interface DetectionSettings {
  headDown: number;
  leaveSeat: number;
  confidence: number;
  requireConfirm: boolean;
  saveEvidence: boolean;
  blurFaces: boolean;
  notifyLive: boolean;
  retention: '7 days' | '30 days' | '90 days' | '12 months';
  privacy: 'Track ID only' | 'Track ID + seat' | 'Student name';
}

export interface SortState<K extends string> {
  key: K;
  dir: 1 | -1;
}
