import { IconChevronLeft, IconChevronRight } from './icons';

interface Props {
  readonly label: string;
  readonly page: number;
  readonly pageCount: number;
  readonly canPrev: boolean;
  readonly canNext: boolean;
  readonly onPrev: () => void;
  readonly onNext: () => void;
  readonly onGoToPage: (page: number) => void;
}

type PageEntry = number | `gap-${number}-${number}`;

// Always keep the first and last page visible, plus a window around the current page, and
// collapse anything else into a single "…" — the standard pagination window so a long list
// doesn't render one button per page.
function buildPageWindow(page: number, pageCount: number): PageEntry[] {
  const current = page + 1;
  const pages = new Set<number>([1, pageCount, current - 1, current, current + 1]);
  const sorted = [...pages].filter((value) => value >= 1 && value <= pageCount).sort((a, b) => a - b);

  const entries: PageEntry[] = [];
  sorted.forEach((value, index) => {
    if (index > 0 && value - sorted[index - 1] > 1) entries.push(`gap-${sorted[index - 1]}-${value}`);
    entries.push(value);
  });
  return entries;
}

export default function Pager({ label, page, pageCount, canPrev, canNext, onPrev, onNext, onGoToPage }: Props) {
  const entries = buildPageWindow(page, pageCount);

  return (
    <div className="pager">
      <div>{label}</div>
      {pageCount > 1 && <nav className="pager__pages" aria-label="Pagination">
        <button
          type="button"
          className="pager__arrow"
          disabled={!canPrev}
          onClick={onPrev}
          aria-label="Previous page"
        >
          <IconChevronLeft />
        </button>
        {entries.map((entry) =>
          typeof entry === 'string' ? (
            <span key={entry} className="pager__ellipsis" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={entry}
              type="button"
              className={`pager__page${entry === page + 1 ? ' pager__page--active' : ''}`}
              aria-current={entry === page + 1 ? 'page' : undefined}
              aria-label={`Page ${entry}`}
              onClick={() => onGoToPage(entry - 1)}
            >
              {entry}
            </button>
          )
        )}
        <button
          type="button"
          className="pager__arrow"
          disabled={!canNext}
          onClick={onNext}
          aria-label="Next page"
        >
          <IconChevronRight />
        </button>
      </nav>}
    </div>
  );
}
