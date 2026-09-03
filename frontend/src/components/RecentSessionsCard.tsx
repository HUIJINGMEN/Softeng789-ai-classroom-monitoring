import { IconClipboardCheck } from './icons';
import { sessionDisplayName } from '../lib/eventDisplay';
import { statusClass } from '../lib/format';
import type { Session } from '../types';

interface Counts {
  present: number;
  late: number;
  total: number;
}

interface Props {
  readonly recentSessions: readonly Session[];
  readonly countsForSession: (sessionId: string) => Counts;
  readonly onOpenLatestSession: () => void;
  readonly onOpenSession: (sessionId: string) => void;
}

export default function RecentSessionsCard({
  recentSessions,
  countsForSession,
  onOpenLatestSession,
  onOpenSession
}: Props) {
  return (
    <section className="card dashboard-enter stagger-4">
      <div className="card__head">
        <div className="card__title-row">
          <span className="icon-inline icon-inline--title" aria-hidden="true">
            <IconClipboardCheck />
          </span>
          <div className="card__title">Recent classroom sessions</div>
        </div>
        <div className="card__actions">
          <button type="button" className="btn" onClick={onOpenLatestSession}>
            Open latest session
          </button>
        </div>
      </div>

      {recentSessions.length === 0 ? (
        <div className="empty empty--inline">No classroom sessions have been created yet.</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Session</th>
              <th>Course</th>
              <th>Date</th>
              <th>Present</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {recentSessions.map((session) => {
              const counts = countsForSession(session.id);
              return (
                <tr
                  key={session.id}
                  className="table__row-action"
                  onClick={() => onOpenSession(session.id)}
                >
                  <td>
                    <div className="cell-strong">{session.title}</div>
                    <div className="cell-sub">{sessionDisplayName(session)}</div>
                  </td>
                  <td>{session.course}</td>
                  <td>{session.dateLabel}</td>
                  <td className="mono">
                    {counts.present + counts.late} / {counts.total}
                  </td>
                  <td>
                    <span className={statusClass(session.status)}>{session.status}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
