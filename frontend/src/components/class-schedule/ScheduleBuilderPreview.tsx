import type { RoomApiResponse } from '../../lib/roomApi';
import {
  formatScheduleDate,
  scheduleDateRangeLabel,
  type GeneratedScheduleSession
} from '../../features/class-schedule';

interface Props {
  readonly sessions: readonly GeneratedScheduleSession[];
  readonly roomById: ReadonlyMap<string, RoomApiResponse>;
  readonly teacherNameByEmail: ReadonlyMap<string, string>;
  readonly excludedDateCount: number;
  readonly onRestoreDates: () => void;
  readonly onRemoveDate: (date: string) => void;
}

export default function ScheduleBuilderPreview({
  sessions,
  roomById,
  teacherNameByEmail,
  excludedDateCount,
  onRestoreDates,
  onRemoveDate
}: Props) {
  return (
    <aside className="schedule-builder__preview" aria-live="polite">
      <div className="schedule-builder__preview-head">
        <div>
          <strong>{sessions.length} session{sessions.length === 1 ? '' : 's'}</strong>
          <span>{scheduleDateRangeLabel(sessions.map((session) => session.date))}</span>
        </div>
        {excludedDateCount > 0 && (
          <button type="button" className="btn btn--quiet btn--sm" onClick={onRestoreDates}>
            Restore removed dates
          </button>
        )}
      </div>
      {sessions.length > 0 ? (
        <ol className="schedule-builder__dates">
          {sessions.map((session, index) => {
            const room = roomById.get(session.roomId);
            return (
              <li key={`${session.date}-${session.startTime}`}>
                <span className="schedule-builder__date-info">
                  <span><b>{index + 1}</b>{formatScheduleDate(session.date)}</span>
                  <small>
                    {session.startTime}–{session.endTime} · {teacherNameByEmail.get(session.teacherEmail) ?? 'Teacher required'} · {room ? `${room.code}, ${room.campusName}` : 'Room required'}
                  </small>
                </span>
                <button
                  type="button"
                  className="btn btn--quiet btn--sm"
                  aria-label={`Remove ${formatScheduleDate(session.date)}`}
                  onClick={() => onRemoveDate(session.date)}
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="empty empty--compact">Configure a class day inside the date range.</div>
      )}
    </aside>
  );
}
