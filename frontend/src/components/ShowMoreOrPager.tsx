import Pager from './Pager';

interface PagedResult {
  label: string;
  pageLabel: string;
  page: number;
  pageCount: number;
  canPrev: boolean;
  canNext: boolean;
  prev: () => void;
  next: () => void;
  goToPage: (page: number) => void;
}

interface Props {
  readonly showingAll: boolean;
  readonly hasMore: boolean;
  readonly onShowAll: () => void;
  readonly paged: PagedResult;
  readonly moreLabel: string;
}

export default function ShowMoreOrPager({ showingAll, hasMore, onShowAll, paged, moreLabel }: Props) {
  if (showingAll) {
    return (
      <Pager
        label={paged.label}
        page={paged.page}
        pageCount={paged.pageCount}
        canPrev={paged.canPrev}
        canNext={paged.canNext}
        onPrev={paged.prev}
        onNext={paged.next}
        onGoToPage={paged.goToPage}
      />
    );
  }
  if (!hasMore) return null;
  return (
    <button type="button" className="btn btn--quiet btn--sm" onClick={onShowAll}>
      {moreLabel}
    </button>
  );
}
