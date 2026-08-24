import type {
  AuthUser,
  LoginPayload,
  RegisterStudentPayload,
  RegisterTeacherPayload
} from '../types';
import { request } from './apiClient';

interface AuthApiResponse {
  token: string;
  role: 'STUDENT' | 'TEACHER';
  id: string;
  name: string;
  email: string;
}

function mapAuthResponse(response: AuthApiResponse): AuthUser {
  return {
    token: response.token,
    role: response.role === 'TEACHER' ? 'teacher' : 'student',
    id: response.id,
    name: response.name,
    email: response.email
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

export async function registerStudent(payload: RegisterStudentPayload): Promise<AuthUser> {
  const response = await request<AuthApiResponse>('/api/auth/register/student', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return mapAuthResponse(response);
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
