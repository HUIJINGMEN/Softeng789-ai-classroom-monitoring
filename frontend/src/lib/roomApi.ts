import { request } from './apiClient';

export interface RoomApiResponse {
  id: string;
  campusId: string;
  campusName: string;
  code: string;
  name: string;
  capacity: number;
}

export async function listRooms(campusId?: string): Promise<RoomApiResponse[]> {
  const query = campusId ? `?campusId=${encodeURIComponent(campusId)}` : '';
  return request<RoomApiResponse[]>(`/api/admin/rooms${query}`);
}

export async function createRoom(payload: {
  campusId: string;
  code: string;
  name: string;
  capacity: number;
}): Promise<RoomApiResponse> {
  return request<RoomApiResponse>('/api/admin/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function updateRoom(
  id: string,
  payload: { campusId: string; code: string; name: string; capacity: number }
): Promise<RoomApiResponse> {
  return request<RoomApiResponse>(`/api/admin/rooms/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function deleteRoom(id: string): Promise<void> {
  await request<void>(`/api/admin/rooms/${id}`, { method: 'DELETE' });
}
