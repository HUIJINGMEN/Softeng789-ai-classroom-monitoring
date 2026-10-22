import { useEffect, useState } from 'react';
import { ApiError, apiMessage } from '../../lib/apiClient';
import { listPendingManualPayments } from './api/manualPayments';
import type { AdminManualPaymentsResponse } from './types';

const PAGE_SIZE = 10;

/** Page-scoped reads: hide obsolete rows immediately and ignore cancelled responses. */
export function useManualPaymentQueue(refreshToken: number, focusStudentId: string) {
  const [selection, setSelection] = useState({ focusStudentId, allStudents: false, page: 0 });
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ key: string; data: AdminManualPaymentsResponse } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [loadingKey, setLoadingKey] = useState('');
  const current = selection.focusStudentId === focusStudentId
    ? selection : { focusStudentId, allStudents: false, page: 0 };
  const studentId = current.allStudents ? '' : focusStudentId;
  const key = JSON.stringify([studentId, current.page, refreshToken, revision]);

  useEffect(() => {
    const controller = new AbortController();
    setLoadingKey(key);
    setFailure(null);
    listPendingManualPayments(current.page, PAGE_SIZE, studentId, controller.signal).then(data => {
      if (controller.signal.aborted) return;
      // Another administrator may remove the last pending item on this page.
      const lastPage = Math.max(0, data.page.totalPages - 1);
      if (current.page > lastPage) {
        setSelection({ ...current, page: lastPage });
        return;
      }
      setResult({ key, data });
    }).catch(cause => {
      if (!controller.signal.aborted) setFailure({ key, message: cause instanceof ApiError
        ? `Could not load pending payments. ${apiMessage(cause)}`
        : 'Could not load pending payments. Check your connection and retry.' });
    }).finally(() => {
      if (!controller.signal.aborted) setLoadingKey('');
    });
    return () => controller.abort();
  }, [key]);

  const error = failure?.key === key ? failure.message : '';
  const loading = !error && (loadingKey === key || result?.key !== key);
  const data = !loading && !error && result?.key === key ? result.data : null;
  return {
    data, error, loading, studentId,
    setPage: (page: number) => setSelection({ ...current, page: Math.max(0, page) }),
    showAll: () => setSelection({ focusStudentId, allStudents: true, page: 0 }),
    reload: () => setRevision(value => value + 1),
  };
}
