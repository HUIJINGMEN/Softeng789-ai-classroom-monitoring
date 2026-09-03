import { useMemo, useState } from 'react';
import AlertDetailModal from '../components/AlertDetailModal';
import HealthAlertCard from '../components/HealthAlertCard';
import HealthIncidentReportRow from '../components/HealthIncidentReportRow';
import { IconHeartPulse } from '../components/icons';
import SelectMenu from '../components/SelectMenu';
import { useAlertReview } from '../hooks/useAlertReview';
import type { Console } from '../hooks/useConsole';
import type { HealthAlertStatus } from '../types';

const ALL = 'All';

export default function AdminHealthAlerts({ console: c }: { readonly console: Console }) {
  const [classFilter, setClassFilter] = useState(ALL);
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState<typeof ALL | HealthAlertStatus>(ALL);
  const [sourceFilter, setSourceFilter] = useState<typeof ALL | 'ai-detected' | 'teacher-reported'>(ALL);
  const [studentQuery, setStudentQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const { setOpenAlertId, openAlert, reviewing, handleConfirm, handleDismiss } = useAlertReview(c);

  const classOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...c.healthAlerts.map((alert) => alert.classLabel),
          ...c.healthIncidentReports.map((report) => report.classLabel)
        ])
      ).sort(),
    [c.healthAlerts, c.healthIncidentReports]
  );
  const typeOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...c.healthAlerts.map((alert) => alert.eventType),
          ...c.healthIncidentReports.map((report) => report.incidentType)
        ])
      ).sort(),
    [c.healthAlerts, c.healthIncidentReports]
  );

  const query = studentQuery.trim().toLowerCase();
  const matchesCommon = (classLabel: string, type: string, studentName: string, isoDate: string) => {
    const day = isoDate.slice(0, 10);
    return (
      (classFilter === ALL || classLabel === classFilter) &&
      (typeFilter === ALL || type === typeFilter) &&
      (!query || studentName.toLowerCase().includes(query)) &&
      (!dateFrom || day >= dateFrom) &&
      (!dateTo || day <= dateTo)
    );
  };

  const filteredAlerts = c.healthAlerts.filter(
    (alert) =>
      matchesCommon(alert.classLabel, alert.eventType, alert.studentName, alert.detectedAt) &&
      (statusFilter === ALL || alert.status === statusFilter) &&
      (sourceFilter === ALL || sourceFilter === 'ai-detected')
  );
  const filteredReports = c.healthIncidentReports.filter(
    (report) =>
      matchesCommon(report.classLabel, report.incidentType, report.studentName, report.occurredAt) &&
      (sourceFilter === ALL || report.source === sourceFilter)
  );

  const awaitingCount = c.healthAlerts.filter((alert) => alert.status === 'awaiting-review').length;
  const confirmedCount = c.healthAlerts.filter((alert) => alert.status === 'confirmed').length;
  const dismissedCount = c.healthAlerts.filter((alert) => alert.status === 'dismissed').length;

  return (
    <div className="page__inner">
      <div className="stat-grid dashboard-enter stagger-0">
        <div className="stat">
          <div className="stat__head">
            <span className="icon-inline" aria-hidden="true">
              <IconHeartPulse />
            </span>
            <span className="stat__label">Awaiting review</span>
          </div>
          <div className="stat__value">{awaitingCount}</div>
          <div className="stat__delta stat__delta--muted">Across every class</div>
        </div>
        <div className="stat">
          <div className="stat__head">
            <span className="stat__label">Confirmed</span>
          </div>
          <div className="stat__value">{confirmedCount}</div>
          <div className="stat__delta stat__delta--muted">Became incident reports</div>
        </div>
        <div className="stat">
          <div className="stat__head">
            <span className="stat__label">Dismissed</span>
          </div>
          <div className="stat__value">{dismissedCount}</div>
          <div className="stat__delta stat__delta--muted">Reviewed, no report needed</div>
        </div>
      </div>

      <div className="toolbar dashboard-enter stagger-1">
        <div className="field">
          <span>Class</span>
          <SelectMenu
            value={classFilter}
            options={[ALL, ...classOptions].map((value) => ({ value, label: value }))}
            ariaLabel="Filter by class"
            onChange={setClassFilter}
          />
        </div>
        <div className="field">
          <span>Event / incident type</span>
          <SelectMenu
            value={typeFilter}
            options={[ALL, ...typeOptions].map((value) => ({ value, label: value }))}
            ariaLabel="Filter by type"
            onChange={setTypeFilter}
          />
        </div>
        <div className="field">
          <span>Alert status</span>
          <SelectMenu
            value={statusFilter}
            options={[
              { value: ALL, label: 'All' },
              { value: 'awaiting-review', label: 'Awaiting review' },
              { value: 'confirmed', label: 'Confirmed' },
              { value: 'dismissed', label: 'Dismissed' }
            ]}
            ariaLabel="Filter by alert status"
            onChange={(value) => setStatusFilter(value as typeof ALL | HealthAlertStatus)}
          />
        </div>
        <div className="field">
          <span>Source</span>
          <SelectMenu
            value={sourceFilter}
            options={[
              { value: ALL, label: 'All' },
              { value: 'ai-detected', label: 'AI detected' },
              { value: 'teacher-reported', label: 'Teacher reported' }
            ]}
            ariaLabel="Filter by source"
            onChange={(value) => setSourceFilter(value as typeof ALL | 'ai-detected' | 'teacher-reported')}
          />
        </div>
        <label className="field">
          Student
          <input
            value={studentQuery}
            placeholder="Student name"
            onChange={(event) => setStudentQuery(event.target.value)}
          />
        </label>
        <label className="field">
          From
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        </label>
        <label className="field">
          To
          <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </label>
        <span className="spacer" />
      </div>

      <section className="card card--min-list dashboard-enter stagger-2">
        <div className="card__head">
          <div className="card__title-row">
            <span className="icon-inline icon-inline--title" aria-hidden="true">
              <IconHeartPulse />
            </span>
            <div>
              <div className="card__title">Health Alerts</div>
              <div className="card__sub">
                {filteredAlerts.length} of {c.healthAlerts.length} alert{c.healthAlerts.length === 1 ? '' : 's'}
              </div>
            </div>
          </div>
        </div>

        {c.healthAlertsError && (
          <div className="notice notice--warn">
            <span className="notice__mark" aria-hidden="true" />
            <span>{c.healthAlertsError}</span>
          </div>
        )}

        {filteredAlerts.length === 0 && !c.healthAlertsError && (
          <div className="empty">No health alerts match the current filters.</div>
        )}

        {filteredAlerts.map((alert) => (
          <HealthAlertCard key={alert.id} alert={alert} onOpen={() => setOpenAlertId(alert.id)} />
        ))}
      </section>

      <section className="card card--min-list dashboard-enter stagger-3">
        <div className="card__head">
          <div className="card__title-row">
            <div>
              <div className="card__title">Health Incident Reports</div>
              <div className="card__sub">
                {filteredReports.length} of {c.healthIncidentReports.length} record
                {c.healthIncidentReports.length === 1 ? '' : 's'}
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

        {filteredReports.length === 0 && !c.healthIncidentReportsError && (
          <div className="empty">No health incident reports match the current filters.</div>
        )}

        {filteredReports.map((report) => (
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
    </div>
  );
}
