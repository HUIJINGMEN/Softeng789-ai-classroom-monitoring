import type {
  AuthUser,
  FaceEnrollmentCapture,
  LoginPayload,
  RegisterStudentPayload,
  RegisterTeacherPayload
} from '../types';
import { request } from './apiClient';

interface AuthApiResponse {
  token: string;
  role: 'STUDENT' | 'TEACHER' | 'ADMIN';
  id: string;
  name: string;
  email: string;
  /** Only meaningful for role === 'STUDENT': PENDING, APPROVED, or REJECTED. */
  approvalStatus: string;
}

function mapRole(role: AuthApiResponse['role']): AuthUser['role'] {
  if (role === 'ADMIN') return 'admin';
  if (role === 'TEACHER') return 'teacher';
  return 'student';
}

function mapAuthResponse(response: AuthApiResponse): AuthUser {
  return {
    token: response.token,
    role: mapRole(response.role),
    id: response.id,
    name: response.name,
    email: response.email,
    approvalStatus: response.approvalStatus === 'PENDING' || response.approvalStatus === 'REJECTED'
      ? response.approvalStatus
      : 'APPROVED'
  };
}

export async function login(payload: LoginPayload): Promise<AuthUser> {
  const response = await request<AuthApiResponse>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return mapAuthResponse(response);
}

export async function registerStudent(
  payload: RegisterStudentPayload,
  captures: readonly FaceEnrollmentCapture[]
): Promise<AuthUser> {
  const formData = new FormData();
  formData.append(
    'registration',
    new Blob([JSON.stringify(payload)], { type: 'application/json' })
  );
  formData.append(
    'metadata',
    JSON.stringify(captures.map(({ photo, ...capture }) => capture))
  );
  for (const capture of captures) {
    formData.append('images', await dataUrlToFile(capture.photo, `${capture.pose}.jpg`));
  }

  const response = await request<AuthApiResponse>('/api/auth/register/student', {
    method: 'POST',
    body: formData
  });
  return mapAuthResponse(response);
}

async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type || 'image/jpeg' });
}

export async function registerTeacher(payload: RegisterTeacherPayload): Promise<AuthUser> {
  const response = await request<AuthApiResponse>('/api/auth/register/teacher', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return mapAuthResponse(response);
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const response = await request<AuthApiResponse>('/api/auth/me');
  return mapAuthResponse(response);
}

export async function logout(): Promise<void> {
  await request<void>('/api/auth/logout', { method: 'POST' });
}
