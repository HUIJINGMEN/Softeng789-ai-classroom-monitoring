import { useEffect, useMemo, useState } from 'react';
import { IconChevronLeft, IconChevronRight } from '../../components/icons';
import Pager from '../../components/Pager';
import SearchField from '../../components/SearchField';
import { apiMessage } from '../../lib/apiClient';
import { saveDownload } from '../../lib/saveDownload';
import { formatIsoDateInAuckland } from '../../lib/sessionTime';
import {
  downloadLessonReconciliation,
  endOfIsoWeek,
  LessonCreditPanel,
  shiftIsoWeek,
  startOfIsoWeek,
  weekRangeLabel,
  type StudentPaymentAccountRow
} from '../payments';
import {
  StudentOverviewLegend,
  StudentOverviewMobileList,
  StudentOverviewTable
} from './StudentOverviewRegister';
import useStudentOverview from './useStudentOverview';
import useSelectedLessonVisibility from './useSelectedLessonVisibility';
import { ALL_CLASSES, type LessonSelection, type LessonSelectionId } from './types';
import { resolveLessonSelection } from './studentOverviewState';

interface Props {
  readonly mobile: boolean;
  readonly onOpenStudent: (studentId: string) => void;
  readonly onOpenPayment: (student: StudentPaymentAccountRow) => void;
}

export default function StudentOverviewWorkspace({ mobile, onOpenStudent, onOpenPayment }: Props) {
  const overview = useStudentOverview();
  const [selectionId, setSelectionId] = useState<LessonSelectionId | null>(null);
  const selection = resolveLessonSelection(overview.data, selectionId, overview.scopeKey);
  const openLesson = (value: LessonSelection) => setSelectionId({ studentId: value.row.studentId,
    courseOfferingId: value.session.courseOfferingId, sessionId: value.session.id, scopeKey: overview.scopeKey });
  useEffect(() => setSelectionId(null), [overview.scopeKey]);
  const selectedLessonKey = selection ? `${selection.row.studentId}:${selection.session.courseOfferingId}:${selection.session.id}` : null;
  const tableRef = useSelectedLessonVisibility(selectedLessonKey, !mobile);
  const [exporting, setExporting] = useState<'' | 'xlsx' | 'pdf'>('');
  const [exportError, setExportError] = useState('');
  const todayWeek = useMemo(() => startOfIsoWeek(formatIsoDateInAuckland(new Date())), []);
  const allClasses = overview.courseOfferingId === ALL_CLASSES;
  const courseView = !allClasses && overview.view === 'COURSE';
  const data = overview.data;
  const moveWeek = (amount: number) => overview.setWeekStart(shiftIsoWeek(overview.weekStart, amount));

  const exportReport = async (format: 'xlsx' | 'pdf') => {
    if (allClasses) return;
    setExporting(format);
    setExportError('');
    try {
      const file = await downloadLessonReconciliation(format, {
        courseOfferingId: overview.courseOfferingId,
        weekStart: overview.weekStart,
        view: overview.view,
        query: overview.query,
        exceptionsOnly: overview.exceptionsOnly
      });
      saveDownload(file, `student-overview-${overview.weekStart}.${format}`);
    } catch (cause) {
      setExportError(apiMessage(cause));
    } finally {
      setExporting('');
    }
  };

  return (
    <section className="student-overview" aria-busy={overview.loading}>
      <header className="student-overview__head">
        <div>
          <h2>Student overview</h2>
          <p>Every student is shown by default. Filter to one class when you need a focused register.</p>
        </div>
        {!allClasses && (
          <fieldset className="lesson-view-switch" aria-label="Overview period">
            <button type="button" className={!courseView ? 'is-active' : ''} onClick={() => overview.setView('WEEK')}>This week</button>
            <button type="button" className={courseView ? 'is-active' : ''} onClick={() => overview.setView('COURSE')}>Whole course</button>
          </fieldset>
        )}
      </header>

      <div className={`student-overview-toolbar${courseView ? ' is-course-view' : ''}${!allClasses ? ' has-exports' : ''}`}>
        <label className="field">
          <span>Class</span>
          <select value={overview.courseOfferingId} onChange={(event) => overview.setCourseOfferingId(event.target.value)}>
            <option value={ALL_CLASSES}>All classes</option>
            {overview.classes.map((item) => <option value={item.id} key={item.id}>{item.courseCode} · {item.academicTerm}</option>)}
          </select>
        </label>
        {!courseView && (
          <div className="lesson-week-control">
            <span>Week</span>
            <div>
              <button type="button" onClick={() => moveWeek(-1)} aria-label="Previous week"><IconChevronLeft /></button>
              <button type="button" className="lesson-week-control__label" onClick={() => overview.setWeekStart(todayWeek)}>
                {weekRangeLabel(overview.weekStart, endOfIsoWeek(overview.weekStart))}
              </button>
              <button type="button" onClick={() => moveWeek(1)} aria-label="Next week"><IconChevronRight /></button>
            </div>
          </div>
        )}
        {courseView && data.sessions.length > 0 && (
          <div className="lesson-course-range"><span>Course dates</span><strong>{weekRangeLabel(data.sessions[0].date, data.sessions[data.sessions.length - 1].date)}</strong></div>
        )}
        <SearchField value={overview.query} onChange={overview.setQuery} label="Search students" placeholder="Name, number or class" />
        <div className="student-overview-filter">
          <span>Filter</span>
          <button
            type="button"
            className={`student-overview-attention-filter${overview.exceptionsOnly ? ' is-active' : ''}`}
            aria-pressed={overview.exceptionsOnly}
            onClick={() => overview.setExceptionsOnly(!overview.exceptionsOnly)}
          >
            <span className="student-overview-attention-filter__mark" aria-hidden="true" />
            <span>Needs attention</span>
            <strong>{data.summary.needsAttention}</strong>
          </button>
        </div>
        {!allClasses && (
          <div className="student-overview-export">
            <span>Export</span>
            <div className="lesson-export-actions" aria-label="Export selected class">
              <button type="button" className="btn" disabled={Boolean(exporting)} onClick={() => void exportReport('xlsx')}>{exporting === 'xlsx' ? 'Exporting…' : 'Excel'}</button>
              <button type="button" className="btn" disabled={Boolean(exporting)} onClick={() => void exportReport('pdf')}>{exporting === 'pdf' ? 'Exporting…' : 'PDF'}</button>
            </div>
          </div>
        )}
      </div>

      {(overview.error || exportError) && (
        <div className="notice notice--warn" role="alert">
          {overview.error || exportError}<span className="spacer" />
          {overview.error && <button type="button" className="btn btn--sm" onClick={overview.reload}>Retry</button>}
        </div>
      )}

      {!overview.loading && !overview.error && <div className="student-overview-summary" aria-label="Student overview summary">
        <div className={data.summary.needsAttention ? 'has-warning' : ''}><strong>{data.summary.needsAttention}</strong><span>Needs attention</span></div>
        <div><strong>{data.summary.totalStudents}</strong><span>Students</span></div>
        <div className={data.summary.paymentIssues ? 'has-warning' : ''}><strong>{data.summary.paymentIssues}</strong><span>Payment issues</span></div>
        <div className={data.summary.attendanceNotRecorded ? 'has-warning' : ''}><strong>{data.summary.attendanceNotRecorded}</strong><span>Not recorded</span></div>
      </div>}

      <StudentOverviewLegend />

      {overview.loading && <output className="payment-page-state">Loading students and lessons for the selected period…</output>}
      {!overview.loading && data.sessions.length === 0 && data.rows.length > 0 && (
        <output className="student-overview-no-sessions">
          <strong>No lessons in this period</strong>
          <span>Students remain visible below; there are no attendance cells to review.</span>
        </output>
      )}
      {data.rows.length > 0 && (mobile
        ? <StudentOverviewMobileList rows={data.rows} sessions={data.sessions} selection={selection} showCourse={allClasses} onOpenStudent={onOpenStudent} onOpenPayment={onOpenPayment} onOpenLesson={openLesson} />
        : <StudentOverviewTable rows={data.rows} sessions={data.sessions} tableRef={tableRef} selection={selection} showCourse={allClasses} onOpenStudent={onOpenStudent} onOpenPayment={onOpenPayment} onOpenLesson={openLesson} />)}
      {!overview.loading && data.rows.length === 0 && !overview.error && (
        <div className="lesson-reconciliation__empty">
          <strong>No students match this view</strong>
          <p>Try another class or week, clear the search, or turn off the attention filter.</p>
        </div>
      )}
      {data.totalItems > 0 && (
        <Pager
          label={`Showing ${data.page * data.size + 1}–${data.page * data.size + data.rows.length} of ${data.totalItems} students`}
          page={data.page}
          pageCount={data.totalPages}
          canPrev={data.page > 0}
          canNext={data.page + 1 < data.totalPages}
          onPrev={() => overview.setPage(Math.max(0, data.page - 1))}
          onNext={() => overview.setPage(data.page + 1)}
          onGoToPage={overview.setPage}
        />
      )}

      {selection && (
        <LessonCreditPanel
          {...selection}
          key={selectedLessonKey}
          courseCode={selection.session.courseCode}
          academicTerm={selection.session.academicTerm}
          onClose={() => setSelectionId(null)}
          onUpdated={() => overview.refreshStudent(selection)}
          onOpenPayment={() => onOpenPayment(selection.paymentAccount)}
        />
      )}
    </section>
  );
}
