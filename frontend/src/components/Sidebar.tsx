import type { ReactNode } from 'react';
import type { Page } from '../types';

export interface NavEntry {
  page: Page;
  label: string;
  icon?: ReactNode;
  count?: string;
  countLabel?: string;
  /** Gives the count pill a warm/danger treatment instead of the default neutral one — reserved
   *  for things that need real attention (e.g. an open health alert), not routine backlog. */
  urgent?: boolean;
}

interface Props {
  readonly current: Page;
  readonly entries: NavEntry[];
  readonly onNavigate: (page: Page) => void;
  readonly subtitle: string;
}

export default function Sidebar({ current, entries, onNavigate, subtitle }: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__brand-row">
          <div className="sidebar__mark">CM</div>
          <div className="sidebar__title">ClassroomIQ</div>
        </div>
        <div className="sidebar__subtitle">{subtitle}</div>
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
            <span className="nav-item__main">
              {entry.icon && (
                <span className="nav-item__icon" aria-hidden="true">
                  {entry.icon}
                </span>
              )}
              <span>{entry.label}</span>
            </span>
            {entry.count && (
              <span
                className={`nav-item__pill${entry.urgent ? ' nav-item__pill--urgent' : ''}`}
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
