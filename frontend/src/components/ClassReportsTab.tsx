import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AttendanceCoveragePanel from './AttendanceCoveragePanel';
import AttendanceDonutChart from './AttendanceDonutChart';
import CreateFeedbackModal from './CreateFeedbackModal';
import { IconChevronLeft, IconGraduationCap, IconPlus } from './icons';
import Pager from './Pager';
import ReportInsightPanel from './ReportInsightPanel';
import ReportSummaryPrint from './ReportSummaryPrint';
import { apiMessage } from '../lib/apiClient';
import { percentageOf } from '../lib/attendanceAnalytics';
import { sessionRoomLabel } from '../lib/classroomApi';
import { createClassFeedback, listClassFeedback } from '../lib/classFeedbackApi';
import { generateReportInsight } from '../lib/feedbackSummaryApi';
import { formatDateTime } from '../lib/format';
import {
  attendanceForSessions,
  completedSessionsInRange,
  confirmedEventsForSessions,
  eventTypeCounts
} from '../lib/reportMetrics';
import { formatIsoDateInAuckland } from '../lib/sessionTime';
import { usePagination } from '../lib/table';
import type { Console } from '../hooks/useConsole';
import type { ClassFeedback, ReportInsight } from '../types';

interface Props {
  readonly courseOfferingId: string;
  readonly classLabel: string;
  readonly console: Console;
  readonly showToolbar?: boolean;
  readonly detailHeader?: {
    readonly title: string;
    readonly subtitle: string;
    readonly onBack: () => void;
  };
}

export default function ClassReportsTab({
  courseOfferingId,
  classLabel,
  console: c,
  showToolbar = true,
  detailHeader
}: Props) {
  const [insight, setInsight] = useState<ReportInsight | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState('');
  const [classFeedback, setClassFeedback] = useState<ClassFeedback[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(true);
  const [feedbackError, setFeedbackError] = useState('');
  const [feedbackPage, setFeedbackPage] = useState(0);
  const [addingFeedback, setAddingFeedback] = useState(false);
  const [savingFeedback, setSavingFeedback] = useState(false);
  const insightRequestRef = useRef(0);
  const rangeValid = c.dateFrom <= c.dateTo;

  const loadClassFeedback = useCallback(() => {
    setFeedbackLoading(true);
    setFeedbackError('');
    return listClassFeedback(courseOfferingId)
      .then(setClassFeedback)
      .catch((error) => setFeedbackError(apiMessage(error)))
      .finally(() => setFeedbackLoading(false));
  }, [courseOfferingId]);

  useEffect(() => {
    void loadClassFeedback();
  }, [loadClassFeedback]);

  const loadInsight = useCallback(() => {
    if (!rangeValid) return Promise.resolve();
    const requestId = ++insightRequestRef.current;
    setInsightLoading(true);
    setInsightError('');
    return generateReportInsight({
      scope: 'CLASS',
      courseOfferingId,
      dateFrom: c.dateFrom,
      dateTo: c.dateTo
    })
      .then((result) => {
        if (requestId === insightRequestRef.current) setInsight(result);
      })
      .catch((error) => {
        if (requestId !== insightRequestRef.current) return;
        setInsight(null);
        setInsightError(apiMessage(error));
      })
      .finally(() => {
        if (requestId === insightRequestRef.current) setInsightLoading(false);
      });
  }, [c.dateFrom, c.dateTo, courseOfferingId, rangeValid]);

  useEffect(() => {
    insightRequestRef.current += 1;
    setInsight(null);
    setInsightLoading(false);
    setInsightError('');
    setFeedbackPage(0);
  }, [c.dateFrom, c.dateTo, courseOfferingId]);

  const sessions = useMemo(
    () => completedSessionsInRange(c.sessions, c.dateFrom, c.dateTo, courseOfferingId),
    [c.dateFrom, c.dateTo, c.sessions, courseOfferingId]
  );
  const attendance = useMemo(
    () => attendanceForSessions(sessions, c.countsForSession),
    [c.countsForSession, sessions]
  );
  const confirmedEvents = useMemo(
    () => confirmedEventsForSessions(c.events, sessions),
    [c.events, sessions]
  );
  const eventCounts = useMemo(() => eventTypeCounts(confirmedEvents), [confirmedEvents]);
  const classFeedbackInRange = useMemo(
    () => classFeedback.filter((item) => {
      const date = formatIsoDateInAuckland(new Date(item.createdAt));
      return date >= c.dateFrom && date <= c.dateTo;
    }),
    [c.dateFrom, c.dateTo, classFeedback]
  );
  const pagedClassFeedback = usePagination(classFeedbackInRange, feedbackPage, setFeedbackPage, 5);
  const sessionRows = useMemo(
    () =>
      sessions.map((session) => {
        const counts = c.countsForSession(session.id);
        const recorded = counts.present + counts.late + counts.absent;
        return {
          id: session.id,
          label: session.dateLabel,
          detail: `${session.time} · ${sessionRoomLabel(session)}`,
          present: counts.present,
          late: counts.late,
          absent: counts.absent,
          notRecorded: counts.unknown,
          attendanceRate: percentageOf(counts.present + counts.late, recorded)
        };
      }),
    [c.countsForSession, sessions]
  );

  const addClassFeedback = async (payload: { courseOfferingId: string; comment: string }) => {
    setSavingFeedback(true);
    try {
      const created = await createClassFeedback(payload);
      setClassFeedback((current) => [created, ...current]);
      setInsight(null);
      c.showToast('Class feedback added. Generate the AI summary again to include it.');
      return true;
    } catch (error) {
      c.showToast(apiMessage(error));
      return false;
    } finally {
      setSavingFeedback(false);
    }
  };

  const reportActions = (
    <div className="profile-action-bar__actions class-report__actions">
      <button type="button" className="btn btn--with-icon" onClick={() => setAddingFeedback(true)}>
        <IconPlus /> Add class feedback
      </button>
      <button type="button" className="btn btn--primary" disabled={!rangeValid} onClick={() => window.print()}>
        Export class report
      </button>
    </div>
  );

  return (
    <div className="class-report">
      {detailHeader && (
        <div className="report-detail-heading report-detail-heading--actions dashboard-enter stagger-1">
          <button type="button" className="btn btn--with-icon" onClick={detailHeader.onBack}>
            <IconChevronLeft /> Back to class reports
          </button>
          <div className="report-detail-heading__identity">
            <h2>{detailHeader.title}</h2>
            <p>{detailHeader.subtitle}</p>
          </div>
          {reportActions}
        </div>
      )}

      {showToolbar && (
        <div className="toolbar report-toolbar">
          <label className="field">
            From
            <input type="date" value={c.dateFrom} onChange={(event) => c.setDateFrom(event.target.value)} />
          </label>
          <label className="field">
            To
            <input type="date" value={c.dateTo} onChange={(event) => c.setDateTo(event.target.value)} />
          </label>
          <div className="reports__export-action">{reportActions}</div>
        </div>
      )}

      {!showToolbar && !detailHeader && (
        <div className="profile-action-bar class-report__action-bar dashboard-enter stagger-1">
          {reportActions}
        </div>
      )}

      {showToolbar && !rangeValid && (
        <div className="notice notice--warn" role="alert">
          <span className="notice__mark" aria-hidden="true" />
          <span>The end date must be on or after the start date.</span>
        </div>
      )}

      <section className="card dashboard-enter stagger-0">
        <div className="card__body">
          <div className="card__title reports__section-title">Attendance summary</div>
          <div className="profile-attendance-summary">
            <div className="profile-attendance-summary__chart">
              <AttendanceDonutChart
                attendance={attendance}
                emptyTitle="No attendance recorded in this range."
                emptyHint="Choose a period containing completed sessions."
                note={sessions.length > 0 ? `Based on ${sessions.length} completed session${sessions.length === 1 ? '' : 's'}` : undefined}
              />
            </div>
            <AttendanceCoveragePanel attendance={attendance} />
          </div>
        </div>
      </section>

      <div className="reports-overview-grid">
        <section className="card dashboard-enter stagger-1">
          <div className="card__body">
            <div className="card__title-line">
              <div className="card__title">Confirmed event summary</div>
              <span className="cell-sub">{confirmedEvents.length} total</span>
            </div>
            {Object.keys(eventCounts).length === 0 ? (
              <div className="empty empty--compact">No confirmed or corrected events in this range.</div>
            ) : (
              <div className="class-report__event-list">
                {Object.entries(eventCounts).map(([type, count]) => (
                  <div key={type} className="kv">
                    <span className="kv__k">{type}</span>
                    <span className="kv__v mono">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <ReportInsightPanel
          insight={insight}
          loading={insightLoading}
          error={insightError}
          disabled={!rangeValid}
          onGenerate={() => void loadInsight()}
          onRetry={() => void loadInsight()}
        />
      </div>

      <section className="card report-list-card dashboard-enter stagger-2">
        <div className="card__head">
          <div className="card__title-row">
            <span className="icon-inline icon-inline--title" aria-hidden="true"><IconGraduationCap /></span>
            <div>
              <div className="card__title">Class feedback</div>
              <div className="card__sub">
                Original class-wide notes remain visible here and inform class and overall AI summaries.
              </div>
            </div>
          </div>
          <span className="badge badge--neutral">{classFeedbackInRange.length} in range</span>
        </div>

        {feedbackError && (
          <div className="notice notice--warn" role="alert">
            <span className="notice__mark" aria-hidden="true" />
            <span>{feedbackError}</span>
            <span className="spacer" />
            <button type="button" className="btn btn--sm" onClick={() => void loadClassFeedback()}>Retry</button>
          </div>
        )}

        {feedbackLoading && classFeedback.length === 0 ? (
          <div className="empty empty--inline" role="status">Loading class feedback…</div>
        ) : classFeedbackInRange.length === 0 && !feedbackError ? (
          <div className="empty">
            No class-wide feedback was recorded in the selected period.
          </div>
        ) : (
          <div className="report-feedback-list">
            {pagedClassFeedback.rows.map((item) => (
              <article key={item.id} className="report-feedback-row">
                <div>
                  <strong>{item.teacherName}</strong>
                  <span>{formatDateTime(item.createdAt)}</span>
                </div>
                <p>{item.comment}</p>
              </article>
            ))}
          </div>
        )}

        {classFeedbackInRange.length > 0 && (
          <Pager
            label={pagedClassFeedback.label}
            page={pagedClassFeedback.page}
            pageCount={pagedClassFeedback.pageCount}
            canPrev={pagedClassFeedback.canPrev}
            canNext={pagedClassFeedback.canNext}
            onPrev={pagedClassFeedback.prev}
            onNext={pagedClassFeedback.next}
            onGoToPage={pagedClassFeedback.goToPage}
          />
        )}
      </section>

      <section className="card dashboard-enter stagger-2">
        <div className="card__head">
          <div>
            <div className="card__title">Session breakdown</div>
            <div className="card__sub">Completed sessions in the selected reporting period.</div>
          </div>
        </div>
        <table className="table table--compact">
          <thead><tr><th>Session</th><th>Present</th><th>Late</th><th>Absent</th><th>Not recorded</th><th>Attendance</th></tr></thead>
          <tbody>
            {sessionRows.map((row) => (
              <tr key={row.id}>
                <td><div className="cell-strong">{row.label}</div><div className="cell-sub">{row.detail}</div></td>
                <td className="mono">{row.present}</td>
                <td className="mono">{row.late}</td>
                <td className="mono">{row.absent}</td>
                <td className="mono">{row.notRecorded}</td>
                <td className="mono">{row.attendanceRate === null ? '—' : `${row.attendanceRate}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {sessions.length === 0 && <div className="empty">No completed sessions match this date range.</div>}
      </section>

      <ReportSummaryPrint
        title={classLabel}
        scopeLabel="Class report"
        dateFrom={c.dateFrom}
        dateTo={c.dateTo}
        attendance={attendance}
        completedSessionCount={sessions.length}
        confirmedEventCount={confirmedEvents.length}
        eventCounts={eventCounts}
        insight={insight}
        sessionRows={sessionRows}
      />

      {addingFeedback && (
        <CreateFeedbackModal
          target="class"
          courseOfferingId={courseOfferingId}
          classLabel={classLabel}
          saving={savingFeedback}
          onCreate={addClassFeedback}
          onClose={() => setAddingFeedback(false)}
        />
      )}
    </div>
  );
}
