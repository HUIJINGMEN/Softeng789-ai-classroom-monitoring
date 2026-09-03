import type {
  FaceEnrollmentCapture,
  FaceEnrollmentPose,
  FaceEnrollmentStatus,
  Student,
  StudentRecordStatus
} from '../types';
import { absoluteApiUrl, request } from './apiClient';

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
  faceEnrollmentCaptures?: FaceEnrollmentCaptureApiResponse[];
  createdAt: string;
  updatedAt: string;
  status: 'ACTIVE' | 'WITHDRAWN';
}

export interface FaceEnrollmentCaptureApiResponse {
  pose: FaceEnrollmentPose;
  label: string;
  photoUrl: string;
  qualityScore: number;
  poseScore: number;
  capturedAt: string;
  optional: boolean;
}

export interface FaceEnrollmentApiResponse {
  studentId: string;
  imageAccepted: boolean;
  aiVerified: boolean;
  status: FaceEnrollmentStatus;
  message: string;
  photoUrl: string | null;
  captures?: FaceEnrollmentCaptureApiResponse[];
}

export interface PendingStudentApiResponse {
  id: string;
  studentNumber: string;
  universityEmail: string;
  fullName: string;
  requestedClasses: string[];
  faceEnrollmentStatus: FaceEnrollmentStatus;
  consentGiven: boolean;
  createdAt: string;
}

export async function listStudents(): Promise<StudentApiResponse[]> {
  return request<StudentApiResponse[]>('/api/students');
}

export async function listPendingStudents(): Promise<PendingStudentApiResponse[]> {
  return request<PendingStudentApiResponse[]>('/api/admin/students/pending');
}

export async function approveStudent(id: string): Promise<StudentApiResponse> {
  return request<StudentApiResponse>(`/api/admin/students/${id}/approve`, { method: 'POST' });
}

export async function rejectStudent(id: string): Promise<StudentApiResponse> {
  return request<StudentApiResponse>(`/api/admin/students/${id}/reject`, { method: 'POST' });
}

export async function updateStudentAccountStatus(
  id: string,
  accountStatus: 'active' | 'withdrawn'
): Promise<StudentApiResponse> {
  return request<StudentApiResponse>(`/api/admin/students/${id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: accountStatus === 'withdrawn' ? 'WITHDRAWN' : 'ACTIVE' })
  });
}

export async function getStudent(id: string): Promise<StudentApiResponse> {
  return request<StudentApiResponse>(`/api/students/${id}`);
}

export async function uploadFaceEnrollment(
  studentRecordId: string,
  captures: readonly FaceEnrollmentCapture[]
): Promise<FaceEnrollmentApiResponse> {
  const formData = new FormData();
  const metadata = captures.map(({ photo, ...capture }) => capture);
  formData.append('metadata', JSON.stringify(metadata));

  for (const capture of captures) {
    formData.append('images', await dataUrlToFile(capture.photo, `${capture.pose}.jpg`));
  }

  return request<FaceEnrollmentApiResponse>(
    `/api/students/${studentRecordId}/face-enrollment/captures`,
    {
      method: 'POST',
      body: formData
    }
  );
}

export function mapStudentApiToUi(
  student: StudentApiResponse,
  enrollment?: FaceEnrollmentApiResponse
): Student {
  const status = enrollment?.status ?? student.faceEnrollmentStatus;
  const photoUrl = enrollment?.photoUrl ?? student.registrationPhotoUrl;
  const captures = enrollment?.captures ?? student.faceEnrollmentCaptures ?? [];
  const courses = student.courses?.length ? student.courses : [student.course];

  return {
    recordId: student.id,
    id: student.studentNumber,
    studentNumber: student.studentNumber,
    name: `${student.firstName} ${student.lastName}`,
    course: student.course,
    courses,
    rate: null,
    status: recordStatus(status),
    accountStatus: student.status === 'WITHDRAWN' ? 'withdrawn' : 'active',
    program: student.programme,
    email: student.universityEmail,
    seat: student.seat,
    registrationPhoto: photoUrl ? absoluteApiUrl(photoUrl, student.updatedAt) : undefined,
    registeredAt: student.createdAt,
    consentRecorded: student.consentGiven,
    faceEnrollmentStatus: status,
    faceEnrollmentMessage: enrollment?.message,
    faceEnrollmentCaptures: captures.map((capture) => ({
      pose: capture.pose,
      label: capture.label,
      photo: absoluteApiUrl(capture.photoUrl, student.updatedAt),
      qualityScore: capture.qualityScore,
      poseScore: capture.poseScore,
      capturedAt: capture.capturedAt,
      optional: capture.optional
    }))
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
