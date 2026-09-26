import { useCallback, useEffect } from 'react';

interface ServerPageMetadata {
  readonly page: number;
  readonly size: number;
  readonly totalItems: number;
  readonly totalPages: number;
  readonly hasPrevious: boolean;
  readonly hasNext: boolean;
  readonly loading: boolean;
  readonly visibleItems: number;
}

/**
 * Keeps server-backed directories on a valid page and exposes the same pager contract used by
 * local collections. Centralising this avoids each directory reimplementing page boundaries.
 */
export function useServerPageControls(
  metadata: ServerPageMetadata,
  setPage: (page: number | ((current: number) => number)) => void
) {
  const pageCount = Math.max(1, metadata.totalPages);

  useEffect(() => {
    if (!metadata.loading && metadata.totalPages > 0 && metadata.page >= metadata.totalPages) {
      setPage(metadata.totalPages - 1);
    }
  }, [metadata.loading, metadata.page, metadata.totalPages, setPage]);

  const previous = useCallback(
    () => setPage((current) => Math.max(0, current - 1)),
    [setPage]
  );
  const next = useCallback(
    () => setPage((current) => Math.min(pageCount - 1, current + 1)),
    [pageCount, setPage]
  );
  const goToPage = useCallback(
    (target: number) => setPage(Math.max(0, Math.min(pageCount - 1, target))),
    [pageCount, setPage]
  );

  const firstItem = metadata.page * metadata.size + 1;
  const lastItem = metadata.page * metadata.size + metadata.visibleItems;
  const label = metadata.totalItems === 0
    ? 'No records'
    : `Showing ${firstItem}–${lastItem} of ${metadata.totalItems}`;

  return {
    label,
    pageCount,
    canPrevious: metadata.hasPrevious,
    canNext: metadata.hasNext,
    previous,
    next,
    goToPage
  };
}
