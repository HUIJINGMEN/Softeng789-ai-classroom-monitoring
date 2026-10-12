import {
  getLessonReconciliation,
  listStudentPaymentAccounts,
  type LessonReconciliationResponse,
  type StudentPaymentAccountRow
} from '../payments/data';

const API_PAGE_SIZE = 100;

export async function listAllStudentPaymentAccounts(): Promise<StudentPaymentAccountRow[]> {
  const first = await listStudentPaymentAccounts(0, API_PAGE_SIZE, {});
  if (first.page.totalPages <= 1) return first.page.items;
  const remaining = await Promise.all(
    Array.from({ length: first.page.totalPages - 1 }, (_, index) => (
      listStudentPaymentAccounts(index + 1, API_PAGE_SIZE, {})
    ))
  );
  return [first, ...remaining].flatMap((response) => response.page.items);
}

export async function getCompleteLessonReconciliation(filters: {
  courseOfferingId: string;
  weekStart: string;
  view: 'WEEK' | 'COURSE';
}): Promise<LessonReconciliationResponse> {
  const first = await getLessonReconciliation({ ...filters, page: 0, size: API_PAGE_SIZE });
  if (first.totalPages <= 1) return first;
  const remaining = await Promise.all(
    Array.from({ length: first.totalPages - 1 }, (_, index) => (
      getLessonReconciliation({ ...filters, page: index + 1, size: API_PAGE_SIZE })
    ))
  );
  return {
    ...first,
    rows: [first, ...remaining].flatMap((response) => response.rows),
    page: 0,
    size: first.totalItems,
    totalPages: first.totalItems > 0 ? 1 : 0,
    hasPrevious: false,
    hasNext: false
  };
}
