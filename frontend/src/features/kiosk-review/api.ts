import { request, requestBlob } from '../../lib/apiClient';
import { pageQuery, type PageResponse } from '../../lib/pagination';
import type { KioskReviewFilter, KioskReviewItem, KioskReviewResolution, KioskReviewSummary } from './types';

const id = (value: string) => encodeURIComponent(value);

export function listKioskReviews(state: KioskReviewFilter, page: number, size = 20) {
  return request<PageResponse<KioskReviewItem>>(
    `/api/admin/kiosk-reviews?${new URLSearchParams({ state }).toString()}&${pageQuery(page, size)}`
  );
}

export function getKioskReviewSummary() {
  return request<KioskReviewSummary>('/api/admin/kiosk-reviews/summary');
}

/** Evidence images are only fetched when an admin opens one review; callers revoke the object URL. */
export function getKioskReviewEvidence(reviewId: string, signal?: AbortSignal) {
  return requestBlob(`/api/admin/kiosk-reviews/${id(reviewId)}/evidence`, signal);
}

export function resolveKioskReview(reviewId: string, resolution: KioskReviewResolution, note: string) {
  return request<KioskReviewItem>(`/api/admin/kiosk-reviews/${id(reviewId)}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resolution, note: note.trim() || null })
  });
}
