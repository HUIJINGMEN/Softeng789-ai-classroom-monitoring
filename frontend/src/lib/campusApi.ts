import { request } from './apiClient';

export interface CampusApiResponse {
  id: string;
  name: string;
  roomCount: number;
}

export async function listCampuses(): Promise<CampusApiResponse[]> {
  return request<CampusApiResponse[]>('/api/admin/campuses');
}

export async function createCampus(name: string): Promise<CampusApiResponse> {
  return request<CampusApiResponse>('/api/admin/campuses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
}

export async function updateCampus(id: string, name: string): Promise<CampusApiResponse> {
  return request<CampusApiResponse>(`/api/admin/campuses/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
}

export async function deleteCampus(id: string): Promise<void> {
  await request<void>(`/api/admin/campuses/${id}`, { method: 'DELETE' });
}
