import type { FaceEnrollmentStatus, NewStudentRegistration, Student, StudentRecordStatus } from '../types';
import { absoluteApiUrl, request } from './apiClient';

export { ApiError, apiMessage } from './apiClient';

export interface StudentApiResponse {
  id: string;
  studentNumber: string;
  universityEmail: string;
  firstName: string;
  lastName: string;
  course: string;
  courses?: string[];
  seat: string;
  programme: string;
  consentGiven: boolean;
  faceEnrollmentStatus: FaceEnrollmentStatus;
  registrationPhotoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FaceEnrollmentApiResponse {
  studentId: string;
  imageAccepted: boolean;
  aiVerified: boolean;
  status: FaceEnrollmentStatus;
  message: string;
  photoUrl: string | null;
}

export async function listStudents(): Promise<StudentApiResponse[]> {
  return request<StudentApiResponse[]>('/api/students');
}

export async function createStudent(
  registration: NewStudentRegistration
): Promise<StudentApiResponse> {
  return request<StudentApiResponse>('/api/students', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      studentNumber: registration.studentNumber,
      universityEmail: registration.universityEmail,
      firstName: registration.firstName,
      lastName: registration.lastName,
      course: registration.course,
      courses: registration.courses.length > 0 ? registration.courses : [registration.course],
      seat: registration.seat || 'Unassigned',
      programme: registration.programme,
      consentGiven: registration.consentGiven
    })
  });
}

export async function uploadFaceEnrollment(
  studentRecordId: string,
  registrationPhoto: string
): Promise<FaceEnrollmentApiResponse> {
  const formData = new FormData();
  formData.append('image', await dataUrlToFile(registrationPhoto, 'enrollment.jpg'));
  return request<FaceEnrollmentApiResponse>(`/api/students/${studentRecordId}/face-enrollment`, {
    method: 'POST',
    body: formData
  });
}

export function mapStudentApiToUi(
  student: StudentApiResponse,
  enrollment?: FaceEnrollmentApiResponse
): Student {
  const status = enrollment?.status ?? student.faceEnrollmentStatus;
  const photoUrl = enrollment?.photoUrl ?? student.registrationPhotoUrl;
  const courses = student.courses?.length ? student.courses : [student.course];

  return {
    recordId: student.id,
    id: student.studentNumber,
    studentNumber: student.studentNumber,
    name: `${student.firstName} ${student.lastName}`,
    course: student.course,
    courses,
    rate: 100,
    status: recordStatus(status),
    program: student.programme,
    email: student.universityEmail,
    seat: student.seat,
    registrationPhoto: photoUrl ? absoluteApiUrl(photoUrl, student.updatedAt) : undefined,
    registeredAt: student.createdAt,
    consentRecorded: student.consentGiven,
    faceEnrollmentStatus: status,
    faceEnrollmentMessage: enrollment?.message
  };
}

async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type || 'image/jpeg' });
}

function recordStatus(status: FaceEnrollmentStatus): StudentRecordStatus {
  if (status === 'FAILED') return 'At risk';
  if (status === 'PHOTO_CAPTURED') return 'Active';
  return 'Enrolment pending';
}
