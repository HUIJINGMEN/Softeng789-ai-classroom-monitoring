export type CaptureStatus = 'idle' | 'checking' | 'success' | 'error';

export function captureGuidanceStatus(
  error: string,
  busy: boolean,
  status: CaptureStatus,
  label?: string
): string {
  if (error) return 'Camera issue';
  if (busy || status === 'checking') return 'Hold still';
  if (status === 'error') return 'Try again';
  if (status === 'success') return 'Face detected';
  return label || 'Face detected';
}
