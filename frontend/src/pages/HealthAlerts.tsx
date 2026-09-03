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

  return (
    <div className="page__inner">
      <section className="card card--min-list dashboard-enter stagger-1">
        <div className="card__head">
          <div className="card__title-row">
            <span className="icon-inline icon-inline--title" aria-hidden="true">
              <IconHeartPulse />
            </span>
            <div>
              <div className="card__title">Health Alerts</div>
              <div className="card__sub">
                {c.awaitingReviewCount > 0
                  ? `${c.awaitingReviewCount} alert${c.awaitingReviewCount === 1 ? '' : 's'} awaiting review`
                  : 'No alerts awaiting review'}
              </div>
            </div>
          </div>
          <div className="card__actions">
            <button type="button" className="btn btn--primary" onClick={() => setReporting(true)}>
              + Create health report
            </button>
          </div>
        </div>

        {c.healthAlertsError && (
          <div className="notice notice--warn">
            <span className="notice__mark" aria-hidden="true" />
            <span>{c.healthAlertsError}</span>
          </div>
        )}

        {!c.healthAlertsLoading && c.healthAlerts.length === 0 && !c.healthAlertsError && (
          <div className="empty">No AI-detected health alerts for your classes yet.</div>
        )}

        {c.healthAlerts.map((alert) => (
          <HealthAlertCard key={alert.id} alert={alert} onOpen={() => setOpenAlertId(alert.id)} />
        ))}
      </section>

      <section className="card card--min-list dashboard-enter stagger-2">
        <div className="card__head">
          <div className="card__title-row">
            <div>
              <div className="card__title">Health Incident Reports</div>
              <div className="card__sub">
                {c.healthIncidentReports.length} record{c.healthIncidentReports.length === 1 ? '' : 's'}
              </div>
            </div>
          </div>
        </div>

        {c.healthIncidentReportsError && (
          <div className="notice notice--warn">
            <span className="notice__mark" aria-hidden="true" />
            <span>{c.healthIncidentReportsError}</span>
          </div>
        )}

        {!c.healthIncidentReportsLoading &&
          c.healthIncidentReports.length === 0 &&
          !c.healthIncidentReportsError && <div className="empty">No health incident reports yet.</div>}

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
