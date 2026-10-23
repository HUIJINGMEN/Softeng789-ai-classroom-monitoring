import { request } from '../../lib/apiClient';
import type { FaceDecision, FaceProfile, PhotoReview, RosterStudent } from './types';

export const getStatus = () => request<{ enabled: boolean }>('/api/vision/status');
export const getProfile = (id: string) => request<FaceProfile>(`/api/vision/students/${id}`);
export const getRoster = (id: string) => request<RosterStudent[]>(`/api/vision/sessions/${id}/roster`);
export const setConsent = (id: string, granted: boolean, adultConfirmed: boolean, noticeVersion: string) =>
  request<FaceProfile>(`/api/vision/students/${id}/consent`, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ granted, adultConfirmed, noticeVersion }) });
export async function enroll(id: string, captures: string[]) {
  const data = new FormData(); data.append('teacherConfirmed', 'true');
  for (const [index, capture] of captures.entries()) {
    data.append('images', await (await fetch(capture)).blob(), `capture-${index}.jpg`);
  }
  return request<FaceProfile>(`/api/vision/students/${id}/enrollment`, { method: 'POST', body: data });
}
export function recognize(sessionId: string, photo: Blob, key: string) {
  const data = new FormData(); data.append('image', photo, 'classroom.jpg'); data.append('captureConsentConfirmed', 'true');
  return request<PhotoReview>(`/api/vision/sessions/${sessionId}/photos`, {
    method: 'POST', body: data, headers: { 'Idempotency-Key': key }
  });
}
export const confirm = (id: string, decisions: FaceDecision[]) => request<PhotoReview>(`/api/vision/reviews/${id}/confirm`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teacherConfirmed: true, decisions })
});

/** Bake phone orientation into pixels and strip EXIF before upload or review. */
export async function preparePhoto(file: File): Promise<Blob> {
  if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 20 * 1024 * 1024)
    throw new Error('Choose a JPEG or PNG smaller than 20 MB. HEIC is not supported.');
  const image = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    if (image.width * image.height > 25_000_000) throw new Error('Use a photo with at most 25 megapixels.');
    const scale = Math.min(1, 4096 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext('2d'); if (!context) throw new Error('Image processing is unavailable in this browser.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('Could not prepare this photo.')), 'image/jpeg', .9));
    if (blob.size > 7 * 1024 * 1024) throw new Error('This photo is too large. Photograph a smaller group.');
    return blob;
  } finally { image.close(); }
}
