import type { ScheduleConflictApiResponse } from '../../lib/classroomApi';
import { formatScheduleDate } from '../../features/class-schedule';

interface Props {
  readonly conflicts: readonly ScheduleConflictApiResponse[] | null;
  readonly acknowledged: boolean;
  readonly onAcknowledged: (value: boolean) => void;
}

export default function ScheduleBuilderReview({ conflicts, acknowledged, onAcknowledged }: Props) {
  if (conflicts === null) return null;
  const hasBlockedConflict = conflicts.some((item) => !item.overridable);
  const hasWarnings = conflicts.some((item) => item.overridable);
  const issueSuffix = conflicts.length === 1 ? '' : 's';
  const reviewTitle = conflicts.length === 0 ? 'Schedule is ready' : `${conflicts.length} issue${issueSuffix} found`;

  return (
    <div className={`schedule-builder__review ${conflicts.length === 0 ? 'is-clear' : ''}`}>
      <strong>{reviewTitle}</strong>
      {conflicts.length === 0 ? (
        <p>No room, teacher or duplicate-session conflicts were found.</p>
      ) : (
        <ul>
          {conflicts.map((conflict, index) => (
            <li key={`${conflict.type}-${conflict.date}-${index}`}>
              {conflict.date && <b>{formatScheduleDate(conflict.date)}: </b>}{conflict.message}
              {!conflict.overridable && <span> Choose another time, teacher or room before continuing.</span>}
            </li>
          ))}
        </ul>
      )}
      {hasWarnings && !hasBlockedConflict && (
        <label className="schedule-builder__acknowledge">
          <input type="checkbox" checked={acknowledged} onChange={(event) => onAcknowledged(event.target.checked)} />
          <span>I reviewed these warnings and want to create the schedule.</span>
        </label>
      )}
    </div>
  );
}
