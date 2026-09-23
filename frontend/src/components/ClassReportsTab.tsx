import ClassFeedbackPanel from '../features/class-reports/ClassFeedbackPanel';
import ClassReportSummary from '../features/class-reports/ClassReportSummary';
import ClassSessionBreakdown from '../features/class-reports/ClassSessionBreakdown';
import { useClassReportWorkspace } from '../features/class-reports/useClassReportWorkspace';
import useMediaQuery from '../hooks/useMediaQuery';
import type { Console } from '../hooks/useConsole';
import { formatReportDateRange } from '../lib/sessionTime';
import BackButton from './BackButton';
import CreateFeedbackModal from './CreateFeedbackModal';
import { IconPlus } from './icons';
import ReportSummaryPrint from './ReportSummaryPrint';

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
  const isMobile = useMediaQuery('(max-width: 760px)');
  const workspace = useClassReportWorkspace(courseOfferingId, c);

  const reportActions = (
    <div className="profile-action-bar__actions class-report__actions">
      <button
        type="button"
        className="btn btn--with-icon"
        onClick={() => workspace.setAddingFeedback(true)}
      >
        <IconPlus /> Add class feedback
      </button>
      <button
        type="button"
        className="btn btn--primary"
        disabled={!workspace.rangeValid}
        onClick={() => window.print()}
      >
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

      {isMobile && detailHeader && (
        <div className="mobile-report-detail-scope">
          <span>Report period</span>
          <strong>{formatReportDateRange(c.dateFrom, c.dateTo)}</strong>
        </div>
      )}

      {showToolbar && (
        <div className="toolbar report-toolbar">
          <label className="field">
            <span>From</span>
            <input
              type="date"
              value={c.dateFrom}
              onChange={(event) => c.setDateFrom(event.target.value)}
            />
          </label>
          <label className="field">
            <span>To</span>
            <input
              type="date"
              value={c.dateTo}
              onChange={(event) => c.setDateTo(event.target.value)}
            />
          </label>
          <div className="reports__export-action">{reportActions}</div>
        </div>
      )}

      {!showToolbar && !detailHeader && (
        <div className="profile-action-bar class-report__action-bar dashboard-enter stagger-1">
          {reportActions}
        </div>
      )}

      {showToolbar && !workspace.rangeValid && (
        <div className="notice notice--warn" role="alert">
          <span className="notice__mark" aria-hidden="true" />
          <span>The end date must be on or after the start date.</span>
        </div>
      )}

      <ClassReportSummary isMobile={isMobile} workspace={workspace} />
      <ClassFeedbackPanel workspace={workspace} />
      <ClassSessionBreakdown workspace={workspace} />

      <ReportSummaryPrint
        title={classLabel}
        scopeLabel="Class report"
        dateFrom={c.dateFrom}
        dateTo={c.dateTo}
        attendance={workspace.attendance}
        completedSessionCount={workspace.sessions.length}
        confirmedEventCount={workspace.confirmedEvents.length}
        eventCounts={workspace.eventCounts}
        insight={workspace.insight}
        sessionRows={workspace.sessionRows}
      />

      {workspace.addingFeedback && (
        <CreateFeedbackModal
          target="class"
          courseOfferingId={courseOfferingId}
          classLabel={classLabel}
          saving={workspace.savingFeedback}
          onCreate={workspace.addClassFeedback}
          onClose={() => workspace.setAddingFeedback(false)}
        />
      )}
    </div>
  );
}
