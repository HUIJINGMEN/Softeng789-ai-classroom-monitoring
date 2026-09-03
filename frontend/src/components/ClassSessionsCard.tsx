import { statusClass } from '../lib/format';
import type { Console } from '../hooks/useConsole';
import type { Session } from '../types';

interface Props {
  readonly sessions: readonly Session[];
  readonly sessionsLoading: boolean;
  readonly sessionsError: string;
  readonly console: Console;
}

export default function ClassSessionsCard({ sessions, sessionsLoading, sessionsError, console: c }: Props) {
  return (
    <section className="card dashboard-enter stagger-3">
      <div className="card__body">
        <div className="card__title card__title--spaced">Sessions</div>

        {sessionsError && (
          <div className="notice notice--warn">
            <span className="notice__mark" aria-hidden="true" />
            <span>{sessionsError}</span>
          </div>
        )}

        {sessions.map((session) => (
          <div key={session.id} className="kv">
            <div>
              <div className="cell-strong cell-strong--compact">
                {session.dateLabel} · {session.room}
              </div>
              <div className="cell-sub">{session.time}</div>
            </div>
            <div className="row-inline">
              <span className={statusClass(session.status)}>{session.status}</span>
              {session.recordId && (
                <button
                  type="button"
                  className="btn btn--quiet btn--sm"
                  onClick={() => {
                    c.selectSession(session.id);
                    c.setPage('attendance');
                  }}
                >
                  Open →
                </button>
              )}
            </div>
          </div>
        ))}

        {!sessionsLoading && sessions.length === 0 && (
          <div className="empty empty--inline">No sessions scheduled for this class yet.</div>
        )}
      </div>
    </section>
  );
}
