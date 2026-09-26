export interface PageResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export function pageQuery(page: number, size: number): string {
  return new URLSearchParams({ page: String(page), size: String(size) }).toString();
}
