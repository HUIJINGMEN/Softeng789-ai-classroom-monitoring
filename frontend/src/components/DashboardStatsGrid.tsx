import type { ReactNode } from 'react';

export interface DashboardStatItem {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  readonly icon: ReactNode;
  readonly tone?: 'accent' | 'success' | 'attention' | 'neutral';
  readonly onClick?: () => void;
}

interface Props {
  readonly stats: readonly DashboardStatItem[];
  readonly compact?: boolean;
}

/** Shared interaction layer for teacher and admin dashboard metrics. Role-specific wrappers own
 *  the data; this component keeps motion, focus behaviour and click affordance identical. */
export default function DashboardStatsGrid({ stats, compact = false }: Props) {
  return (
    <div className={`stat-grid ${compact ? 'stat-grid--admin' : 'stat-grid--teacher'}`}>
      {stats.map((stat, index) => {
        const body = (
          <>
            <div className="stat__head">
              <span className="icon-inline stat__icon" aria-hidden="true">
                {stat.icon}
              </span>
              <span className="stat__label">{stat.label}</span>
            </div>
            <div className="stat__value">{stat.value}</div>
            <div className="stat__footer">
              <span className="stat__delta stat__delta--muted">{stat.detail}</span>
              {stat.onClick && (
                <span className="stat__action-cue" aria-hidden="true">
                  <svg viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              )}
            </div>
          </>
        );
        const className = `stat stat--tone-${stat.tone ?? 'neutral'} dashboard-enter stagger-${index}${stat.onClick ? ' stat--interactive' : ''}`;
        return stat.onClick ? (
          <button
            key={stat.label}
            type="button"
            className={className}
            aria-label={`${stat.label}: ${stat.value}. ${stat.detail}`}
            onClick={stat.onClick}
          >
            {body}
          </button>
        ) : (
          <div key={stat.label} className={className}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
