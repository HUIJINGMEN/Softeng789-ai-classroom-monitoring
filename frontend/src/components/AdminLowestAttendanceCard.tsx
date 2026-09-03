import { useMemo } from 'react';
import { IconAlertTriangle } from './icons';
import type { Session } from '../types';

function lowAttendanceRateClass(rate: number): string {
  if (rate < 50) return 'rate-text rate-text--danger';
  if (rate < 65) return 'rate-text rate-text--warn';
  return 'rate-text rate-text--ok';
}

interface Props {
  readonly todaySessions: readonly Session[];
  readonly countsForSession: (sessionId: string) => { present: number; late: number; absent: number; total: number };
  readonly onGoToClasses: () => void;
}

export default function AdminLowestAttendanceCard({ todaySessions, countsForSession, onGoToClasses }: Props) {
  const lowestAttendance = useMemo(() => {
    const byClassRoom = new Map<
      string,
      { course: string; room: string; present: number; late: number; absent: number; total: number; sessions: number }
    >();
    for (const session of todaySessions) {
      const key = `${session.course}__${session.room}`;
      const counts = countsForSession(session.id);
      const entry = byClassRoom.get(key) ?? {
        course: session.course,
        room: session.room,
        present: 0,
        late: 0,
        absent: 0,
        total: 0,
        sessions: 0
      };
      entry.present += counts.present;
      entry.late += counts.late;
      entry.absent += counts.absent;
      entry.total += counts.total;
      entry.sessions += 1;
      byClassRoom.set(key, entry);
    }
    return Array.from(byClassRoom.values())
      .map((entry) => ({
        ...entry,
        rate: entry.total === 0 ? 0 : Math.round(((entry.present + entry.late) / entry.total) * 100)
      }))
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 5);
  }, [todaySessions, countsForSession]);

  return (
    <section className="card dashboard-enter stagger-6">
      <div className="card__head">
        <div className="card__title-row">
          <span className="icon-inline icon-inline--title" aria-hidden="true">
            <IconAlertTriangle />
          </span>
          <div>
            <div className="card__title">Lowest Attendance (Today)</div>
            <div className="card__sub">Classes that may need attention</div>
          </div>
        </div>
        <div className="card__actions">
          <button type="button" className="btn btn--sm" onClick={onGoToClasses}>
            Go to Classes →
          </button>
        </div>
      </div>

      {lowestAttendance.length === 0 ? (
        <div className="empty empty--inline">No sessions scheduled for today yet.</div>
      ) : (
        <table className="table table--compact">
          <thead>
            <tr>
              <th>Class</th>
              <th>Room</th>
              <th>Attendance</th>
              <th>Present</th>
              <th>Absent</th>
              <th>Sessions</th>
            </tr>
          </thead>
          <tbody>
            {lowestAttendance.map((row) => (
              <tr key={`${row.course}__${row.room}`}>
                <td className="cell-strong">{row.course}</td>
                <td>{row.room}</td>
                <td>
                  <span className={lowAttendanceRateClass(row.rate)}>{row.rate}%</span>
                </td>
                <td>{row.present}</td>
                <td>{row.absent}</td>
                <td>{row.sessions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
