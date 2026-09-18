import { useCallback, useEffect, useMemo, useState } from 'react';
import { listAccomplishments } from '../lib/accomplishmentApi';
import { apiMessage } from '../lib/apiClient';
import type { Accomplishment } from '../types';

export function useAccomplishments() {
  const [items, setItems] = useState<Accomplishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listAccomplishments());
      setError('');
    } catch (caught) {
      setError(apiMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const updateItem = useCallback((updated: Accomplishment) => {
    setItems((current) => current.map((item) => item.id === updated.id ? updated : item));
  }, []);

  const pendingReviewCount = useMemo(
    () => items.filter((item) => item.latestCorrection?.status === 'PENDING').length,
    [items]
  );

  return { items, loading, error, pendingReviewCount, refresh, updateItem };
}

export type AccomplishmentsState = ReturnType<typeof useAccomplishments>;
