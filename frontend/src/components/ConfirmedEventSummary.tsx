interface Props {
  readonly counts: Readonly<Record<string, number>>;
  readonly total: number;
  readonly subtitle: string;
  readonly emptyMessage: string;
  readonly stagger?: 1 | 2 | 3;
}

/** Shared report evidence summary. Keeping this in one component prevents the overall, class and
 * student reports from drifting into three different hierarchies for the same information. */
export default function ConfirmedEventSummary({
  counts,
  total,
  subtitle,
  emptyMessage,
  stagger = 2
}: Props) {
  const entries = Object.entries(counts).sort((left, right) => right[1] - left[1]);
  const maxCount = Math.max(1, ...entries.map(([, count]) => count));

  return (
    <section className={`card reports-events-card dashboard-enter stagger-${stagger}`}>
      <div className="card__head reports-events-card__head">
        <div>
          <div className="card__title">Confirmed events</div>
          <div className="card__sub">{subtitle}</div>
        </div>
        <div className="reports-events-card__total" aria-label={`${total} confirmed events`}>
          <strong>{total}</strong>
          <span>confirmed</span>
        </div>
      </div>

      <div className="card__body">
        {entries.length === 0 ? (
          <div className="reports-events-card__empty">{emptyMessage}</div>
        ) : (
          <div className="reports-events-card__list">
            {entries.map(([type, count]) => (
              <div key={type} className="reports__event-row">
                <div className="reports__event-head">
                  <span className="reports__event-type">{type}</span>
                  <span className="mono reports__event-count">{count}</span>
                </div>
                <div className="conf-track" aria-hidden="true">
                  <div className="conf-fill reports__bar-fill" style={{ width: `${(count / maxCount) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
