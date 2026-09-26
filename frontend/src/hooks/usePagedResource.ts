import { useEffect, useRef, useState } from 'react';
import { apiMessage } from '../lib/apiClient';
import type { PageResponse } from '../lib/pagination';

export interface PagedResource<T> {
  rows: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

function emptyPage<T>(size: number): PagedResource<T> {
  return {
    rows: [],
    page: 0,
    size,
    totalItems: 0,
    totalPages: 0,
    hasPrevious: false,
    hasNext: false
  };
}

/** Shared request lifecycle for server-paged directories, including stale-response protection. */
export function usePagedResource<TSource, TResult>(
  size: number,
  loadPage: () => Promise<PageResponse<TSource>>,
  mapItem: (item: TSource) => TResult,
  errorLabel: string
) {
  const [result, setResult] = useState<PagedResource<TResult>>(() => emptyPage(size));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestRef.current;
    setLoading(true);
    loadPage()
      .then((response) => {
        if (requestId !== requestRef.current) return;
        setResult({
          rows: response.items.map(mapItem),
          page: response.page,
          size: response.size,
          totalItems: response.totalItems,
          totalPages: response.totalPages,
          hasPrevious: response.hasPrevious,
          hasNext: response.hasNext
        });
        setError('');
      })
      .catch((reason: unknown) => {
        if (requestId !== requestRef.current) return;
        setResult(emptyPage(size));
        setError(`${errorLabel} could not be loaded: ${apiMessage(reason)}`);
      })
      .finally(() => {
        if (requestId === requestRef.current) setLoading(false);
      });

    return () => {
      requestRef.current += 1;
    };
  }, [errorLabel, loadPage, mapItem, size]);

  return { ...result, loading, error };
}
