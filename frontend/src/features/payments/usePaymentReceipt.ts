import { useEffect, useState } from 'react';
import { ApiError, apiMessage } from '../../lib/apiClient';
import { downloadAdminPaymentReceipt } from './api/manualPayments';

interface ReceiptPreviewState {
  id: string;
  status: 'none' | 'loading' | 'ready' | 'error';
  url?: string;
  kind?: 'pdf' | 'image';
  error?: string;
}

/** Authenticated blobs stay local; each load owns its URL and cancels/revokes it on replacement. */
export function usePaymentReceipt(id: string, attached = true) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ReceiptPreviewState>({ id, status: attached ? 'loading' : 'none' });
  useEffect(() => {
    if (!attached) { setState({ id, status: 'none' }); return; }
    const controller = new AbortController();
    let active = true;
    let url: string | undefined;
    setState({ id, status: 'loading' });
    void downloadAdminPaymentReceipt(id, controller.signal).then(blob => {
      if (!active) return;
      const type = blob.type.split(';')[0].toLowerCase();
      if (!blob.size) throw new Error('This receipt file is empty. Request a readable copy if needed for verification.');
      if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(type))
        throw new Error('This receipt format cannot be previewed. Request a PDF, JPG, PNG or WebP copy.');
      url = URL.createObjectURL(blob);
      setState({ id, status: 'ready', url, kind: type === 'application/pdf' ? 'pdf' : 'image' });
    }).catch(cause => {
      if (active) setState({ id, status: 'error', error: cause instanceof ApiError && cause.status === 404
        ? 'The original receipt file is missing.'
        : apiMessage(cause) });
    });
    return () => {
      active = false;
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, attempt, attached]);
  const current: ReceiptPreviewState = attached ? (state.id === id ? state : { id, status: 'loading' }) : { id, status: 'none' };
  return {
    ...current,
    retry: () => setAttempt(value => value + 1),
    failPreview: () => setState(value => ({ ...value, status: 'error', error: 'The browser could not display this receipt. Try again or open the original file.' }))
  };
}
