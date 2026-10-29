import { useEffect, useRef, useState } from 'react';
import { apiMessage, request } from '../lib/apiClient';

interface CaptureCheck { accepted: boolean; reasons: string[]; message: string }

/** A late response must never restore a photo after consent withdrawal, cancellation or navigation. */
export function useCaptureValidation(path: string, noticeVersion?: string) {
  const active = useRef<AbortController | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [rejectedPhoto, setRejectedPhoto] = useState('');
  useEffect(() => () => { active.current?.abort(); active.current = null; }, [path, noticeVersion]);

  function clear() { setError(''); setRejectedPhoto(''); }
  function cancel() {
    active.current?.abort(); active.current = null;
    setChecking(false); clear();
  }
  async function check(photo: string): Promise<boolean> {
    if (active.current) return false;
    const controller = new AbortController(); active.current = controller;
    setChecking(true); clear();
    const timer = window.setTimeout(() => controller.abort(), 25_000);
    try {
      const form = new FormData();
      form.append('image', await (await fetch(photo, { signal: controller.signal })).blob(), 'capture.jpg');
      if (noticeVersion !== undefined) {
        form.append('consentGiven', 'true'); form.append('adultConfirmed', 'true');
        form.append('noticeVersion', noticeVersion);
      }
      const result = await request<CaptureCheck>(path, { method: 'POST', body: form, signal: controller.signal });
      if (active.current !== controller || controller.signal.aborted) return false;
      if (typeof result?.accepted !== 'boolean' || !Array.isArray(result.reasons)
        || result.accepted !== (result.reasons.length === 0) || typeof result.message !== 'string')
        throw new Error('Photo validation returned an invalid result. Please try again.');
      if (!result.accepted) { setError(result.message); setRejectedPhoto(photo); }
      return result.accepted;
    } catch (error) {
      if (active.current === controller) setError(controller.signal.aborted
        ? 'Photo check timed out. Capture again, or choose manual attendance.' : apiMessage(error));
      return false;
    } finally {
      window.clearTimeout(timer);
      if (active.current === controller) { active.current = null; setChecking(false); }
    }
  }
  return { checking, error, rejectedPhoto, check, cancel, clear };
}
