import AttendanceCoveragePanel from '../../components/AttendanceCoveragePanel';
import AttendanceDistributionSummary from '../../components/AttendanceDistributionSummary';
import ConfirmedEventSummary from '../../components/ConfirmedEventSummary';
import ReportInsightPanel from '../../components/ReportInsightPanel';
import {
  MobileAttendanceSnapshot,
  MobileConfirmedEvents
} from '../../components/mobile/MobileReportsWorkspace';
import type { ClassReportWorkspace } from './useClassReportWorkspace';

interface Props {
  readonly isMobile: boolean;
  readonly workspace: ClassReportWorkspace;
}

export default function ClassReportSummary({ isMobile, workspace }: Props) {
  const insightPanel = (
    <ReportInsightPanel
      insight={workspace.insight}
      loading={workspace.insightLoading}
      error={workspace.insightError}
      disabled={!workspace.rangeValid}
      onGenerate={() => void workspace.loadInsight()}
      onRetry={() => void workspace.loadInsight()}
    />
  );

  if (isMobile) {
    return (
      <>
        <MobileAttendanceSnapshot
          attendance={workspace.attendance}
          completedSessionCount={workspace.sessions.length}
        />
        <div className="mobile-report-detail-grid">
          {insightPanel}
          <MobileConfirmedEvents
            counts={workspace.eventCounts}
            total={workspace.confirmedEvents.length}
            subtitle="Reviewed observations included in this class report."
            emptyMessage="No confirmed or corrected events in this range."
          />
        </div>
      </>
    );
  }

  return (
    <>
      <section className="card reports-attendance-card dashboard-enter stagger-0">
        <div className="card__head">
          <div>
            <div className="card__title">Attendance summary</div>
            <div className="card__sub">
              Recorded attendance across completed sessions in this reporting period.
            </div>
          </div>
          <span className="reports-overview__scope">
            {workspace.sessions.length} completed sessions
          </span>
        </div>
        <div className="card__body">
          <div className="reports-attendance-overview">
            <div className="reports-attendance-overview__distribution">
              <AttendanceDistributionSummary
                attendance={workspace.attendance}
                emptyTitle="No attendance recorded in this range."
                emptyHint="Choose a period containing completed sessions."
                rateDescription={
                  workspace.recordedAttendanceCount > 0
                    ? `${workspace.attendingAttendanceCount} of ${workspace.recordedAttendanceCount} recorded marks were present or late.`
                    : 'Attendance rate will appear once statuses are recorded.'
                }
              />
            </div>
            <AttendanceCoveragePanel attendance={workspace.attendance} />
          </div>
        </div>
      </section>

      <div className="reports-overview-grid">
        {insightPanel}
        <ConfirmedEventSummary
          counts={workspace.eventCounts}
          total={workspace.confirmedEvents.length}
          subtitle="Reviewed observations included in this class report."
          emptyMessage="No confirmed or corrected events in this range."
          stagger={1}
        />
      </div>
    </>
  );
}
