import { formatSessionDateLabel, formatTimestampTimeRange } from '../../../lib/sessionTime';
import type { ReconciliationRow, ReconciliationSession } from '../types';

interface Props {
  readonly row: ReconciliationRow;
  readonly session: ReconciliationSession;
  readonly courseCode?: string;
  readonly academicTerm?: string;
}

/** Persistent identity of the exact student/lesson being edited, independent of status. */
export default function LessonPanelHeading({ row, session, courseCode, academicTerm }: Props) {
  return (
    <div className="lesson-panel__context">
      <h2 id="lesson-panel-title">{row.studentName}</h2>
      <span className="lesson-panel__student-number">{row.studentNumber}</span>
      <div id="lesson-panel-context" className="lesson-panel__lesson-context">
        {courseCode && <strong>{courseCode}{academicTerm && <small>{academicTerm}</small>}</strong>}
        <p className="lesson-panel__when"><span>{formatSessionDateLabel(session.date)}</span><time>{formatTimestampTimeRange(session.startTime, session.endTime)} NZ time</time></p>
        <p className="lesson-panel__where">{[session.room, session.campus].filter(Boolean).join(' · ') || 'Location not recorded'}</p>
      </div>
    </div>
  );
}
