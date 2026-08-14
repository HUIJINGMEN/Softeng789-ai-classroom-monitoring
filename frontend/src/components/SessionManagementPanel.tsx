import { statusClass } from '../lib/format';
import type { Console } from '../hooks/useConsole';

interface Props {
  console: Console;
  onCreate: () => void;
  onSelect: () => void;
}

export default function SessionManagementPanel({ console: c, onCreate, onSelect }: Props) {
  return (
    <section className="card session-list">
      <div className="card__head">
        <div>
          <div className="card__title">Classroom Sessions</div>
          <div className="card__sub">Create, start, end and switch sessions for attendance.</div>
        </div>
        <button type="button" className="btn btn--primary" onClick={onCreate}>
          + Create Session
        </button>
      </div>
      <div className="session-list__table-wrap">
        <table className="table table--compact">
          <thead>
            <tr>
              <th>Course</th>
              <th>Room</th>
              <th>Teacher</th>
              <th>Date</th>
              <th>Time</th>
              <th>Status</th>
              <th className="table__action-cell">Action</th>
            </tr>
          </thead>
          <tbody>
            {c.sessions.map((session) => (
              <tr
                key={session.id}
                className={session.id === c.sessionId ? 'table__row--selected' : ''}
              >
                <td className="cell-strong">{session.course}</td>
                <td>{session.room}</td>
                <td>{session.teacherName ?? 'Unassigned Teacher'}</td>
                <td>{session.dateLabel}</td>
                <td className="mono">{session.time}</td>
                <td>
                  <span className={statusClass(session.status)}>{sessionStatusCode(session)}</span>
                </td>
                <td className="table__action-cell">
                  <button
                    type="button"
                    className="btn btn--sm"
                    onClick={() => {
                      c.selectSession(session.id);
                      c.setCourse(session.course);
                      onSelect();
                    }}
                  >
                    {session.id === c.sessionId ? 'Selected' : 'Select'}
                  </button>
                </td>
              </tr>
            ))}

            {c.sessions.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <div className="empty empty--inline">No classroom sessions have been created.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function sessionStatusCode(session: { status: string; statusCode?: string }): string {
  if (session.statusCode) return session.statusCode;
  if (session.status === 'Live') return 'ACTIVE';
  if (session.status === 'Completed') return 'COMPLETED';
  return 'SCHEDULED';
}
