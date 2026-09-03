import type { CreateStaffPayload, StaffMember, StaffStatus } from '../types';
import { request } from './apiClient';

interface StaffApiResponse {
  id: string;
  staffNumber: string;
  email: string;
  name: string;
  role: 'TEACHER' | 'ADMIN';
  passwordSet: boolean;
  status: 'ACTIVE' | 'DEACTIVATED';
}

function mapStaffApiToUi(staff: StaffApiResponse): StaffMember {
  return {
    id: staff.id,
    staffNumber: staff.staffNumber,
    email: staff.email,
    name: staff.name,
    role: staff.role === 'ADMIN' ? 'admin' : 'teacher',
    passwordSet: staff.passwordSet,
    status: staff.status === 'DEACTIVATED' ? 'deactivated' : 'active'
  };
}

export async function listStaff(): Promise<StaffMember[]> {
  const staff = await request<StaffApiResponse[]>('/api/admin/staff');
  return staff.map(mapStaffApiToUi);
}

export async function createStaff(payload: CreateStaffPayload): Promise<StaffMember> {
  const staff = await request<StaffApiResponse>('/api/admin/staff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      staffNumber: payload.staffNumber,
      email: payload.email,
      name: payload.name,
      role: payload.role.toUpperCase()
    })
  });
  return mapStaffApiToUi(staff);
}

export async function updateStaffStatus(id: string, status: StaffStatus): Promise<StaffMember> {
  const staff = await request<StaffApiResponse>(`/api/admin/staff/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: status === 'deactivated' ? 'DEACTIVATED' : 'ACTIVE' })
  });
  return mapStaffApiToUi(staff);
}
