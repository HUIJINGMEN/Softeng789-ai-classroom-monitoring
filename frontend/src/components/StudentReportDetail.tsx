import { useCallback, useEffect, useMemo, useState } from 'react';
import AttendanceDonutChart from './AttendanceDonutChart';
import CreateFeedbackModal from './CreateFeedbackModal';
import ExportShareModal from './ExportShareModal';
import { IconChevronLeft, IconPlus, IconUsers } from './icons';
import Pager from './Pager';
import PersonAvatar from './PersonAvatar';
import PrepareFeedbackReportModal, { type StudentReportSelection } from './PrepareFeedbackReportModal';
import StudentReportPrint from './StudentReportPrint';
import { apiMessage } from '../lib/apiClient';
import { eventMatchesStudent } from '../lib/eventDisplay';
import { listFeedbackSummaries } from '../lib/feedbackSummaryApi';
import { avatarTone, formatDateTime } from '../lib/format';
import { listMyClassOptions } from '../lib/healthIncidentApi';
import { createProgressReport, listProgressReportsForStudent } from '../lib/progressReportApi';
import { completedSessionsInRange, confirmedEventsForSessions, eventTypeCounts, metricsForStudent } from '../lib/reportMetrics';
import { studentCourseLabel } from '../lib/studentCourses';
import { usePagination } from '../lib/table';
import type { Console } from '../hooks/useConsole';
import type { FeedbackSummary, HealthClassOption, ProgressReport, Student } from '../types';

interface Props {
  readonly student: Student;
  readonly console: Console;
  readonly onBack: () => void;
}

export default function StudentReportDetail({ student, console: c, onBack }: Props) {
  const [reports, setReports] = useState<ProgressReport[]>([]);
  const [summaries, setSummaries] = useState<FeedbackSummary[]>([]);
  const [classOptions, setClassOptions] = useState<HealthClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportPage, setReportPage] = useState(0);
  const [addingFeedback, setAddingFeedback] = useState(false);
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [shareSummaries, setShareSummaries] = useState<FeedbackSummary[] | null>(null);
  const [printReport, setPrintReport] = useState<StudentReportSelection | null>(null);

  const refreshSummaries = useCallback(() => {
    if (!student.recordId) return Promise.resolve();
    return listFeedbackSummaries(student.recordId).then(setSummaries);
  }, [student.recordId]);

  const load = useCallback(() => {
    if (!student.recordId) {
      setReports([]);
      setSummaries([]);
      setClassOptions([]);
      setLoading(false);
      return Promise.resolve();
    }
    setLoading(true);
    setError('');
    return Promise.all([
      listProgressReportsForStudent(student.recordId),
      listFeedbackSummaries(student.recordId),
      listMyClassOptions()
    ])
      .then(([reportResult, summaryResult, optionResult]) => {
        setReports(reportResult);
        setSummaries(summaryResult);
        setClassOptions(optionResult.filter((option) => option.students.some((item) => item.id === student.recordId)));
      })
      .catch((reason) => setError(apiMessage(reason)))
      .finally(() => setLoading(false));
  }, [student.recordId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setReportPage(0);
    setPrintReport(null);
  }, [c.dateFrom, c.dateTo]);

  const sessions = useMemo(
    () => completedSessionsInRange(c.sessions, c.dateFrom, c.dateTo),
    [c.dateFrom, c.dateTo, c.sessions]
  );
  const confirmedEvents = useMemo(
    () => confirmedEventsForSessions(c.events, sessions),
    [c.events, sessions]
  );
  const metrics = useMemo(
    () => metricsForStudent(student, sessions, confirmedEvents, c.attendanceStatusFor),
    [c.attendanceStatusFor, confirmedEvents, sessions, student]
  );
  const studentEventCounts = useMemo(() => {
    return eventTypeCounts(confirmedEvents.filter((event) => eventMatchesStudent(event, student)));
  }, [confirmedEvents, student]);
  const reportsInRange = useMemo(
    () => reports
      .filter((report) => {
        const date = report.createdAt.slice(0, 10);
        return date >= c.dateFrom && date <= c.dateTo;
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [c.dateFrom, c.dateTo, reports]
  );
  const pagedReports = usePagination(reportsInRange, reportPage, setReportPage, 5);

  const addFeedback = async (payload: { courseOfferingId: string; comment: string }) => {
    if (!student.recordId) return false;
    setSavingFeedback(true);
    try {
      const created = await createProgressReport({
        studentId: student.recordId,
        courseOfferingId: payload.courseOfferingId,
        comment: payload.comment
      });
      setReports((current) => [created, ...current]);
      c.showToast('Student feedback added.');
      return true;
    } catch (reason) {
      c.showToast(apiMessage(reason));
      return false;
    } finally {
      setSavingFeedback(false);
    }
  };

  return (
    <div className="student-report-detail">
      <div className="profile-action-bar dashboard-enter stagger-1">
        <button type="button" className="btn btn--with-icon" onClick={onBack}>
          <IconChevronLeft /> Back to student reports
        </button>
        <div className="profile-action-bar__actions">
          <button type="button" className="btn btn--with-icon" disabled={!student.recordId} onClick={() => setAddingFeedback(true)}>
            <IconPlus /> Add feedback
          </button>
          <button type="button" className="btn btn--primary" disabled={!student.recordId} onClick={() => setPreparing(true)}>
            Review, export &amp; share
          </button>
        </div>
      </div>

      <section className="card dashboard-enter stagger-1">
        <div className="card__body report-student-hero">
          <PersonAvatar photoUrl={student.registrationPhoto} name={student.name} tone={avatarTone(student.id, 0)} alt={`${student.name} registration`} large />
          <div className="report-student-hero__identity">
            <h2>{student.name}</h2>
            <p>{student.id} · {studentCourseLabel(student)}</p>
          </div>
          <div className="report-student-hero__metrics">
            <div><span>Attendance</span><strong>{metrics.attendance.rate === null ? '—' : `${metrics.attendance.rate}%`}</strong></div>
            <div><span>Completed sessions</span><strong>{metrics.sessionCount}</strong></div>
            <div><span>Feedback notes</span><strong>{reportsInRange.length}</strong></div>
          </div>
        </div>
      </section>

      {error && (
        <div className="notice notice--warn" role="alert">
          <span className="notice__mark" aria-hidden="true" /><span>{error}</span><span className="spacer" />
          <button type="button" className="btn btn--sm" onClick={() => void load()}>Retry</button>
        </div>
      )}

      <div className="reports-overview-grid">
        <section className="card dashboard-enter stagger-2">
          <div className="card__body">
            <div className="card__title reports__section-title">Attendance summary</div>
            <AttendanceDonutChart
              attendance={metrics.attendance}
              emptyTitle="No attendance recorded in this range."
              emptyHint="Choose a period containing completed sessions for this student."
              note={metrics.sessionCount > 0 ? `${metrics.recorded} of ${metrics.sessionCount} attendance marks recorded` : undefined}
            />
          </div>
        </section>

        <section className="card dashboard-enter stagger-2">
          <div className="card__body">
            <div className="card__title-line">
              <div className="card__title">Confirmed event summary</div>
              <span className="cell-sub">{metrics.confirmedEventCount} total</span>
            </div>
            {Object.keys(studentEventCounts).length === 0 ? (
              <div className="empty empty--compact">No confirmed or corrected events for this student in this range.</div>
            ) : (
              Object.entries(studentEventCounts).map(([type, count]) => (
                <div key={type} className="kv"><span className="kv__k">{type}</span><span className="kv__v mono">{count}</span></div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="card report-list-card dashboard-enter stagger-3">
        <div className="card__head">
          <div className="card__title-row">
            <span className="icon-inline icon-inline--title" aria-hidden="true"><IconUsers /></span>
            <div>
              <div className="card__title">Teacher feedback</div>
              <div className="card__sub">Original notes remain visible here. Exported reports use only the reviewed AI summary.</div>
            </div>
          </div>
          <span className="badge badge--neutral">{reportsInRange.length} in range</span>
        </div>
        {loading ? (
          <div className="empty empty--inline" role="status">Loading feedback…</div>
        ) : reportsInRange.length === 0 ? (
          <div className="empty">No teacher feedback was recorded for this student in the selected period.</div>
        ) : (
          <div className="report-feedback-list">
            {pagedReports.rows.map((report) => (
              <article key={report.id} className="report-feedback-row">
                <div className="report-feedback-row__source">
                  {report.photoUrl && (
                    <img
                      src={report.photoUrl}
                      alt={`Feedback evidence for ${student.name}`}
                      className="report-feedback-row__image"
                    />
                  )}
                  <div>
                    <strong>{report.classLabel}</strong>
                    <span>{report.teacherName} · {formatDateTime(report.createdAt)}</span>
                  </div>
                </div>
                <p>{report.comment}</p>
              </article>
            ))}
          </div>
        )}
        {reportsInRange.length > 0 && (
          <Pager label={pagedReports.label} page={pagedReports.page} pageCount={pagedReports.pageCount} canPrev={pagedReports.canPrev} canNext={pagedReports.canNext} onPrev={pagedReports.prev} onNext={pagedReports.next} onGoToPage={pagedReports.goToPage} />
        )}
      </section>

      {preparing && (
        <PrepareFeedbackReportModal
          reports={reports}
          summaries={summaries}
          availableCourses={classOptions.map((option) => ({ id: option.courseOfferingId, label: option.label }))}
          dateFrom={c.dateFrom}
          dateTo={c.dateTo}
          onClose={() => setPreparing(false)}
          onUpdated={refreshSummaries}
          onContinue={(selection) => {
            setPrintReport(selection);
            setPreparing(false);
            setShareSummaries(selection.summaries);
          }}
          showToast={c.showToast}
        />
      )}

      {addingFeedback && student.recordId && (
        <CreateFeedbackModal
          target="student"
          studentRecordId={student.recordId}
          studentName={student.name}
          saving={savingFeedback}
          onCreate={addFeedback}
          onClose={() => setAddingFeedback(false)}
        />
      )}

      {shareSummaries && (
        <ExportShareModal summaries={shareSummaries} onClose={() => setShareSummaries(null)} onUpdated={refreshSummaries} showToast={c.showToast} />
      )}

      <StudentReportPrint student={student} report={printReport} console={c} />
    </div>
  );
}
