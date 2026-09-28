import { IconChevronRight } from './icons';
import { ATTENDANCE_COUNT_COLUMNS } from '../features/class-attendance/classAttendanceModel';
import { percentageOf } from '../lib/attendanceAnalytics';
import { sessionRoomLabel } from '../lib/classroomApi';
import { formatRate, statusClass } from '../lib/format';
import type { Console } from '../hooks/useConsole';
import type { Session } from '../types';

interface Props {
  readonly session: Session;
  readonly countsForSession: Console['countsForSession'];
  readonly onOpenRoster: (sessionId: string) => void;
}

/** One session summary row. Opening the roster is delegated to the parent so modal state stays
 * separate from the table's attendance calculations. */
export default function ClassAttendanceSessionRow({
  session,
  countsForSession,
  onOpenRoster
}: Props) {
  const counts = session.status === 'Completed' ? countsForSession(session.id) : null;
  const rate = counts ? percentageOf(counts.present + counts.late, counts.total) : null;
  const unavailableMessage = session.status === 'Cancelled'
    ? 'No attendance is recorded for cancelled sessions.'
    : 'Attendance will be available after this session is completed.';

  return (
    <tr className={counts ? 'class-attendance-table__row' : 'class-attendance-table__row class-attendance-table__row--unavailable'}>
      <td>
        <div className="cell-strong">{session.dateLabel}</div>
        <div className="cell-sub class-attendance-table__session-meta">
          <span className="mono">{session.time}</span>
          <span>{sessionRoomLabel(session)}</span>
        </div>
      </td>
      <td data-label="Status">
        <span className={statusClass(session.status)}>{session.status}</span>
      </td>
      {counts ? (
        <>
          {ATTENDANCE_COUNT_COLUMNS.map((column) => (
            <td
              key={column.status}
              className="class-attendance-table__number"
              data-label={column.label}
            >
              {counts[column.countKey]}
            </td>
          ))}
          <td className="class-attendance-rate-cell" data-label="Attendance rate">
            <span className="class-attendance-rate">{formatRate(rate)}</span>
          </td>
          <td className="class-attendance-table__action" data-label="Roster">
            <button
              type="button"
              className="class-attendance-details-toggle"
              aria-haspopup="dialog"
              aria-label={`View roster for ${session.dateLabel}`}
              onClick={() => onOpenRoster(session.id)}
            >
              <span>View roster</span>
              <IconChevronRight />
            </button>
          </td>
        </>
      ) : (
        <td colSpan={6} className="class-attendance-table__unavailable">
          {unavailableMessage}
        </td>
      )}
    </tr>
  );
}
