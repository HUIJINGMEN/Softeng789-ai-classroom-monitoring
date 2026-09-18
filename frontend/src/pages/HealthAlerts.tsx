import { useState } from 'react';
import AlertDetailModal from '../components/AlertDetailModal';
import CreateHealthIncidentReportModal from '../components/CreateHealthIncidentReportModal';
import HealthAlertCard from '../components/HealthAlertCard';
import HealthIncidentReportRow from '../components/HealthIncidentReportRow';
import { IconHeartPulse } from '../components/icons';
import { useAlertReview } from '../hooks/useAlertReview';
import { apiMessage } from '../lib/apiClient';
import type { Console } from '../hooks/useConsole';

export default function HealthAlerts({ console: c }: { readonly console: Console }) {
  const [reporting, setReporting] = useState(false);
  const [creatingReport, setCreatingReport] = useState(false);
  const { setOpenAlertId, openAlert, reviewing, handleConfirm, handleDismiss } = useAlertReview(c);

  const handleCreateReport = async (payload: Parameters<Console['createReport']>[0]) => {
    setCreatingReport(true);
    try {
      await c.createReport(payload);
      return true;
    } catch (error) {
      c.showToast(apiMessage(error));
      return false;
    } finally {
      setCreatingReport(false);
    }
  };

  const reviewedAlerts = c.healthAlerts.filter((alert) => alert.status !== 'awaiting-review').length;
  const alertsNeedingReview = c.healthAlerts.filter((alert) => alert.status === 'awaiting-review');
  const teacherReports = c.healthIncidentReports.filter((report) => report.source === 'teacher-reported').length;

  return (
    <div className="page__inner health-workspace">
      <div className="health-page-actions dashboard-enter stagger-0">
        <div className="workspace-scope workspace-scope--health">
          <span className="workspace-scope__dot" aria-hidden="true" />
          Scoped to classes you teach
        </div>
        <button type="button" className="btn btn--health" onClick={() => setReporting(true)}>
          Create health report
        </button>
      </div>

      <section className="health-summary dashboard-enter stagger-1" aria-label="Health incident summary">
        <div className={`health-summary__item${c.awaitingReviewCount > 0 ? ' health-summary__item--attention' : ''}`}>
          <span>AI concerns to review</span>
          <strong>{c.awaitingReviewCount}</strong>
          <small>{c.awaitingReviewCount > 0 ? 'Check observable evidence' : 'Nothing needs review'}</small>
        </div>
        <div className="health-summary__item">
          <span>Reviewed AI concerns</span>
          <strong>{reviewedAlerts}</strong>
          <small>Recorded or dismissed</small>
        </div>
        <div className="health-summary__item">
          <span>Incident records</span>
          <strong>{c.healthIncidentReports.length}</strong>
          <small>Permanent health &amp; safety records</small>
        </div>
        <div className="health-summary__item">
          <span>Teacher reported</span>
          <strong>{teacherReports}</strong>
          <small>Created without an AI alert</small>
        </div>
      </section>

      {(c.healthAlertsError || c.healthIncidentReportsError) && (
        <div className="notice notice--warn">
          <span className="notice__mark" aria-hidden="true" />
          <span>{c.healthAlertsError || c.healthIncidentReportsError}</span>
        </div>
      )}

      <section className="health-attention dashboard-enter stagger-2">
        <div className="health-section-head">
          <div>
            <h3>AI concerns needing attention</h3>
            <p>Candidate observations stay here until a teacher creates an incident record or dismisses them.</p>
          </div>
          <span className="source-badge source-badge--ai">AI detected</span>
        </div>

        {!c.healthAlertsLoading && alertsNeedingReview.length === 0 && !c.healthAlertsError && (
          <div className="workspace-empty workspace-empty--health">
            <div className="workspace-empty__mark" aria-hidden="true"><IconHeartPulse /></div>
            <div className="empty__title">No active health alerts</div>
            <div className="empty__hint">
              AI-detected health concerns for your classes will appear here. You can still report an incident manually.
            </div>
            <button type="button" className="btn btn--health" onClick={() => setReporting(true)}>
              Create health report
            </button>
          </div>
        )}

        {alertsNeedingReview.map((alert) => (
          <HealthAlertCard
            key={alert.id}
            alert={alert}
            onOpen={() => setOpenAlertId(alert.id)}
            onOpenStudent={(studentId) => {
              c.setProfileId(studentId);
              c.setPage('students');
              window.scrollTo({ top: 0, behavior: 'auto' });
            }}
            onOpenSession={(sessionId) => {
              c.selectSession(sessionId);
              c.setPage('session-detail');
              window.scrollTo({ top: 0, behavior: 'auto' });
            }}
          />
        ))}
      </section>

      <section className="health-records dashboard-enter stagger-3">
        <div className="health-section-head">
          <div>
            <h3>Incident records</h3>
            <p>AI-origin and teacher-reported records, with the response captured at the time.</p>
          </div>
          <span className="health-section-head__count">{c.healthIncidentReports.length} total</span>
        </div>

        {!c.healthIncidentReportsLoading &&
          c.healthIncidentReports.length === 0 &&
          !c.healthIncidentReportsError && (
            <div className="workspace-empty workspace-empty--records">
              <div className="empty__title">No incident records yet</div>
              <div className="empty__hint">Confirmed AI concerns and reports created by teachers will be kept here.</div>
            </div>
          )}

        {c.healthIncidentReports.map((report) => (
          <HealthIncidentReportRow key={report.id} report={report} />
        ))}
      </section>

      {openAlert && (
        <AlertDetailModal
          alert={openAlert}
          saving={reviewing}
          onConfirm={handleConfirm}
          onDismiss={handleDismiss}
          onClose={() => setOpenAlertId(null)}
        />
      )}

      {reporting && (
        <CreateHealthIncidentReportModal
          saving={creatingReport}
          onCreate={handleCreateReport}
          onClose={() => setReporting(false)}
        />
      )}
    </div>
  );
}
