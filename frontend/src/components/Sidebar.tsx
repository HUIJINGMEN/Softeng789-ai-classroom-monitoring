import type { Page } from '../types';

export interface NavEntry {
  page: Page;
  label: string;
  count?: string;
  countLabel?: string;
}

interface Props {
  readonly current: Page;
  readonly entries: NavEntry[];
  readonly onNavigate: (page: Page) => void;
}

export default function Sidebar({ current, entries, onNavigate }: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__brand-row">
          <div className="sidebar__mark">CM</div>
          <div className="sidebar__title">ClassroomIQ</div>
        </div>
        <div className="sidebar__subtitle">Teacher Console</div>
      </div>

      <nav className="sidebar__nav" aria-label="Primary navigation">
        {entries.map((entry) => (
          <button
            key={entry.page}
            type="button"
            className={`nav-item${entry.page === current ? ' nav-item--active' : ''}`}
            aria-current={entry.page === current ? 'page' : undefined}
            onClick={() => onNavigate(entry.page)}
          >
            <span>{entry.label}</span>
            {entry.count && (
              <span
                className="nav-item__pill"
                aria-label={entry.countLabel}
                title={entry.countLabel}
              >
                {entry.count}
              </span>
            )}
          </button>
        ))}
      </nav>
    </aside>
  );
}
