import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AttendanceCoveragePanel from './AttendanceCoveragePanel';
import AttendanceDistributionSummary from './AttendanceDistributionSummary';
import BackButton from './BackButton';
import ConfirmedEventSummary from './ConfirmedEventSummary';
import CreateFeedbackModal from './CreateFeedbackModal';
import { IconGraduationCap, IconPlus } from './icons';
import Pager from './Pager';
import ReportInsightPanel from './ReportInsightPanel';
import ReportSummaryPrint from './ReportSummaryPrint';
import SearchField from './SearchField';
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
  const [sessionQuery, setSessionQuery] = useState('');
  const [sessionPage, setSessionPage] = useState(0);
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
    setSessionPage(0);
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
  const filteredSessionRows = useMemo(() => {
    const query = sessionQuery.trim().toLowerCase();
    if (!query) return sessionRows;
    return sessionRows.filter((row) => `${row.label} ${row.detail}`.toLowerCase().includes(query));
  }, [sessionQuery, sessionRows]);
  const pagedSessionRows = usePagination(filteredSessionRows, sessionPage, setSessionPage, 6);
  const recordedAttendanceCount = attendance.present + attendance.late + attendance.absent;
  const attendingAttendanceCount = attendance.present + attendance.late;

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
          <BackButton label="Back to class reports" onClick={detailHeader.onBack} />
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
            <span>From</span>
            <input type="date" value={c.dateFrom} onChange={(event) => c.setDateFrom(event.target.value)} />
          </label>
          <label className="field">
            <span>To</span>
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

      <section className="card reports-attendance-card dashboard-enter stagger-0">
        <div className="card__head">
          <div>
            <div className="card__title">Attendance summary</div>
            <div className="card__sub">Recorded attendance across completed sessions in this reporting period.</div>
          </div>
          <span className="reports-overview__scope">{sessions.length} completed sessions</span>
        </div>
        <div className="card__body">
          <div className="reports-attendance-overview">
            <div className="reports-attendance-overview__distribution">
              <AttendanceDistributionSummary
                attendance={attendance}
                emptyTitle="No attendance recorded in this range."
                emptyHint="Choose a period containing completed sessions."
                rateDescription={
                  recordedAttendanceCount > 0
                    ? `${attendingAttendanceCount} of ${recordedAttendanceCount} recorded marks were present or late.`
                    : 'Attendance rate will appear once statuses are recorded.'
                }
              />
            </div>
            <AttendanceCoveragePanel attendance={attendance} />
          </div>
        </div>
      </section>

      <div className="reports-overview-grid">
        <ReportInsightPanel
          insight={insight}
          loading={insightLoading}
          error={insightError}
          disabled={!rangeValid}
          onGenerate={() => void loadInsight()}
          onRetry={() => void loadInsight()}
        />

        <ConfirmedEventSummary
          counts={eventCounts}
          total={confirmedEvents.length}
          subtitle="Reviewed observations included in this class report."
          emptyMessage="No confirmed or corrected events in this range."
          stagger={1}
        />
      </div>

      <section className="card report-list-card class-feedback-card dashboard-enter stagger-2">
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
          <span className="report-list-card__count">{classFeedbackInRange.length} in range</span>
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
          <output className="class-feedback-card__status">Loading class feedback…</output>
        ) : classFeedbackInRange.length === 0 && !feedbackError ? (
          <div className="class-feedback-card__empty">
            <div>
              <strong>No feedback in this period</strong>
              <p>Add a class-wide note when there is something useful to include in the AI summary.</p>
            </div>
            <button type="button" className="btn btn--sm btn--with-icon" onClick={() => setAddingFeedback(true)}>
              <IconPlus /> Add feedback
            </button>
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

      <section className="card class-report-sessions dashboard-enter stagger-2">
        <div className="card__head">
          <div>
            <div className="card__title">Session breakdown</div>
            <div className="card__sub">Compare completed sessions. Attendance includes present and late marks.</div>
          </div>
          <span className="report-list-card__count">{filteredSessionRows.length} of {sessionRows.length} sessions</span>
        </div>
        <div className="class-report-sessions__toolbar" role="search" aria-label="Search report sessions">
          <SearchField
            value={sessionQuery}
            placeholder="Date, campus or room"
            onChange={(value) => {
              setSessionQuery(value);
              setSessionPage(0);
            }}
          />
        </div>
        <div className="report-list-table-wrap" tabIndex={0} role="region" aria-label="Session attendance breakdown">
          <table className="table table--compact class-report-session-table">
            <thead>
              <tr>
                <th>Session</th>
                <th>
                  <span>Status breakdown</span>
                  <div className="class-report-session-legend" aria-hidden="true">
                    <span className="class-report-session-legend__present">Present</span>
                    <span className="class-report-session-legend__late">Late</span>
                    <span className="class-report-session-legend__absent">Absent</span>
                    <span className="class-report-session-legend__unknown">Not recorded</span>
                  </div>
                </th>
                <th>Attendance</th>
              </tr>
            </thead>
            <tbody>
              {pagedSessionRows.rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="cell-strong">{row.label}</div>
                    <div className="cell-sub">{row.detail}</div>
                  </td>
                  <td>
                    <div
                      className="class-report-session-mix"
                      aria-label={`${row.present} present, ${row.late} late, ${row.absent} absent, ${row.notRecorded} not recorded`}
                    >
                      <span>{row.present}</span>
                      <span>{row.late}</span>
                      <span>{row.absent}</span>
                      <span>{row.notRecorded}</span>
                    </div>
                  </td>
                  <td className="class-report-session-rate">
                    <strong>{row.attendanceRate === null ? '—' : `${row.attendanceRate}%`}</strong>
                    {row.attendanceRate === null && <span>No recorded marks</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sessions.length === 0 && <div className="class-report-sessions__empty">No completed sessions match this date range.</div>}
        {sessions.length > 0 && filteredSessionRows.length === 0 && (
          <div className="class-report-sessions__empty">No sessions match “{sessionQuery.trim()}”.</div>
        )}
        {filteredSessionRows.length > 0 && (
          <Pager
            label={pagedSessionRows.label}
            page={pagedSessionRows.page}
            pageCount={pagedSessionRows.pageCount}
            canPrev={pagedSessionRows.canPrev}
            canNext={pagedSessionRows.canNext}
            onPrev={pagedSessionRows.prev}
            onNext={pagedSessionRows.next}
            onGoToPage={pagedSessionRows.goToPage}
          />
        )}
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
