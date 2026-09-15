import { useMemo, useState } from 'react';
import AlertDetailModal from '../components/AlertDetailModal';
import HealthAlertCard from '../components/HealthAlertCard';
import HealthIncidentReportRow from '../components/HealthIncidentReportRow';
import { IconHeartPulse } from '../components/icons';
import SelectMenu from '../components/SelectMenu';
import SearchField from '../components/SearchField';
import { useAlertReview } from '../hooks/useAlertReview';
import type { Console } from '../hooks/useConsole';
import type { HealthAlertStatus } from '../types';

const ALL = 'All';

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Two months back rather than an empty string — an empty native date input falls back to
// rendering its placeholder segments in the browser's own locale (e.g. "年/月/日" on a
// Chinese-locale machine), which a page-level lang="en" attribute can't override. Defaulting to a
// real value sidesteps that entirely, and a two-month window is a sensible default range anyway.
function twoMonthsAgo(): string {
  const date = new Date();
  date.setMonth(date.getMonth() - 2);
  return isoDate(date);
}

export default function AdminHealthAlerts({ console: c }: { readonly console: Console }) {
  const [classFilter, setClassFilter] = useState(ALL);
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState<typeof ALL | HealthAlertStatus>(ALL);
  const [sourceFilter, setSourceFilter] = useState<typeof ALL | 'ai-detected' | 'teacher-reported'>(ALL);
  const [studentQuery, setStudentQuery] = useState('');
  const [dateFrom, setDateFrom] = useState(twoMonthsAgo);
  const [dateTo, setDateTo] = useState(() => isoDate(new Date()));
  const { setOpenAlertId, openAlert, reviewing, handleConfirm, handleDismiss } = useAlertReview(c);

  const classOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...c.healthAlerts.map((alert) => alert.classLabel),
          ...c.healthIncidentReports.map((report) => report.classLabel)
        ])
      ).sort((left, right) => left.localeCompare(right)),
    [c.healthAlerts, c.healthIncidentReports]
  );
  const typeOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...c.healthAlerts.map((alert) => alert.eventType),
          ...c.healthIncidentReports.map((report) => report.incidentType)
        ])
      ).sort((left, right) => left.localeCompare(right)),
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
  const teacherReportedCount = c.healthIncidentReports.filter(
    (report) => report.source === 'teacher-reported'
  ).length;

  const resetFilters = () => {
    setClassFilter(ALL);
    setTypeFilter(ALL);
    setStatusFilter(ALL);
    setSourceFilter(ALL);
    setStudentQuery('');
    setDateFrom(twoMonthsAgo());
    setDateTo(isoDate(new Date()));
  };

  return (
    <div className="page__inner health-workspace">
      <section className="health-summary dashboard-enter stagger-0" aria-label="System health incident summary">
        <div className={`health-summary__item${awaitingCount > 0 ? ' health-summary__item--attention' : ''}`}>
          <span>AI concerns to review</span>
          <strong>{awaitingCount}</strong>
          <small>Across every class</small>
        </div>
        <div className="health-summary__item">
          <span>Incident records from AI</span>
          <strong>{confirmedCount}</strong>
          <small>Created after teacher review</small>
        </div>
        <div className="health-summary__item">
          <span>Dismissed concerns</span>
          <strong>{dismissedCount}</strong>
          <small>No incident record required</small>
        </div>
        <div className="health-summary__item">
          <span>Teacher reported</span>
          <strong>{teacherReportedCount}</strong>
          <small>Reported without an AI alert</small>
        </div>
      </section>

      <div className="workspace-filter workspace-filter--health dashboard-enter stagger-2">
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
              { value: 'awaiting-review', label: 'Needs review' },
              { value: 'confirmed', label: 'Incident recorded' },
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
        <SearchField
          label="Student"
          value={studentQuery}
          placeholder="Student name"
          onChange={setStudentQuery}
        />
        <label className="field">
          From
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        </label>
        <label className="field">
          To
          <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </label>
        <button type="button" className="btn btn--quiet workspace-filter__reset" onClick={resetFilters}>
          Reset filters
        </button>
      </div>

      <section className="health-attention dashboard-enter stagger-3">
        <div className="health-section-head">
          <div>
            <h3>AI concerns</h3>
            <p>Potential health or safety events awaiting or showing the result of teacher review.</p>
          </div>
          <span className="health-section-head__count">{filteredAlerts.length} of {c.healthAlerts.length}</span>
        </div>

        {c.healthAlertsError && (
          <div className="notice notice--warn">
            <span className="notice__mark" aria-hidden="true" />
            <span>{c.healthAlertsError}</span>
          </div>
        )}

        {c.healthAlertsLoading && <div className="workspace-loading">Loading health alerts…</div>}

        {!c.healthAlertsLoading && filteredAlerts.length === 0 && !c.healthAlertsError && (
          <div className="workspace-empty workspace-empty--health">
            <div className="workspace-empty__mark" aria-hidden="true"><IconHeartPulse /></div>
            <div className="empty__title">No health alerts match these filters</div>
            <div className="empty__hint">Adjust the class, source, status or date range to broaden the system-wide view.</div>
          </div>
        )}

        {filteredAlerts.map((alert) => (
          <HealthAlertCard
            key={alert.id}
            alert={alert}
            onOpen={() => setOpenAlertId(alert.id)}
            onOpenStudent={(studentId) => {
              c.setProfileId(studentId);
              c.setPage('students');
            }}
            onOpenSession={(sessionId) => {
              c.selectSession(sessionId);
              c.setPage('session-detail');
            }}
          />
        ))}
      </section>

      <section className="health-records dashboard-enter stagger-4">
        <div className="health-section-head">
          <div>
            <h3>Incident records</h3>
            <p>Permanent records from reviewed AI concerns and direct teacher reports.</p>
          </div>
          <span className="health-section-head__count">
            {filteredReports.length} of {c.healthIncidentReports.length}
          </span>
        </div>

        {c.healthIncidentReportsError && (
          <div className="notice notice--warn">
            <span className="notice__mark" aria-hidden="true" />
            <span>{c.healthIncidentReportsError}</span>
          </div>
        )}

        {c.healthIncidentReportsLoading && <div className="workspace-loading">Loading incident records…</div>}

        {!c.healthIncidentReportsLoading && filteredReports.length === 0 && !c.healthIncidentReportsError && (
          <div className="workspace-empty workspace-empty--records">
            <div className="empty__title">No incident records match these filters</div>
            <div className="empty__hint">Incident records remain separate from unreviewed AI concerns.</div>
          </div>
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
