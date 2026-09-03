import { useState } from 'react';
import { statusClass } from '../lib/format';
import type { Console } from '../hooks/useConsole';
import type { Session } from '../types';

interface Props {
  console: Console;
  onCreate: () => void;
  onSelect: () => void;
  onEdit: (session: Session) => void;
}

// Scheduled and Live sessions can still be fixed up; Completed and Cancelled are historical
// record and stay locked (the backend enforces the same rule, this just keeps the buttons from
// promising an action that would fail).
function isEditable(session: Session): boolean {
  return session.status === 'Scheduled' || session.status === 'Live';
}

export default function SessionManagementPanel({ console: c, onCreate, onSelect, onEdit }: Props) {
  const [confirmingCancelId, setConfirmingCancelId] = useState<string | null>(null);

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
                  {confirmingCancelId === session.id ? (
                    <span className="table__action-group">
                      <span className="cell-sub">Cancel this session?</span>
                      <button
                        type="button"
                        className="btn btn--danger btn--sm"
                        onClick={() => {
                          void c.cancelSession(session.id);
                          setConfirmingCancelId(null);
                        }}
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        className="btn btn--quiet btn--sm"
                        onClick={() => setConfirmingCancelId(null)}
                      >
                        Back
                      </button>
                    </span>
                  ) : (
                    <span className="table__action-group">
                      {isEditable(session) && (
                        <>
                          <button type="button" className="btn btn--quiet btn--sm" onClick={() => onEdit(session)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn--quiet btn--sm"
                            onClick={() => setConfirmingCancelId(session.id)}
                          >
                            Cancel
                          </button>
                        </>
                      )}
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
                    </span>
                  )}
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
  if (session.status === 'Cancelled') return 'CANCELLED';
  return 'SCHEDULED';
}
