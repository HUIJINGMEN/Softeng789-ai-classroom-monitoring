import type { ReactNode } from 'react';
import { percentageOf } from '../../lib/attendanceAnalytics';
import { formatRate } from '../../lib/format';
import { formatReportDateRange } from '../../lib/sessionTime';
import type { ReportInsight } from '../../types';
import type { AttendanceBreakdown } from '../AttendanceDonutChart';
import CourseTile from '../CourseTile';
import {
  IconArrowRight,
  IconBarChart,
  IconGraduationCap,
  IconUsers
} from '../icons';
import PersonAvatar from '../PersonAvatar';
import type { ReportLevel } from '../ReportLevelTabs';

interface MobileReportHeaderProps {
  readonly level: ReportLevel;
  readonly classCount: number;
  readonly studentCount: number;
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly scopeLabel: string;
  readonly onLevelChange: (level: ReportLevel) => void;
  readonly onDateFromChange: (value: string) => void;
  readonly onDateToChange: (value: string) => void;
}

const REPORT_VIEWS = [
  { level: 'overview', label: 'Overview', icon: IconBarChart },
  { level: 'classes', label: 'Classes', icon: IconGraduationCap },
  { level: 'students', label: 'Students', icon: IconUsers }
] as const;

export function MobileReportHeader({
  level,
  classCount,
  studentCount,
  dateFrom,
  dateTo,
  scopeLabel,
  onLevelChange,
  onDateFromChange,
  onDateToChange
}: MobileReportHeaderProps) {
  const countFor = (reportLevel: ReportLevel) => {
    if (reportLevel === 'classes') return classCount;
    if (reportLevel === 'students') return studentCount;
    return null;
  };

  return (
    <section className="mobile-reports-control" aria-label="Report controls">
      <nav className="mobile-reports-switcher" aria-label="Report view">
        {REPORT_VIEWS.map((item) => {
          const Icon = item.icon;
          const active = item.level === level;
          const count = countFor(item.level);
          return (
            <button
              key={item.level}
              type="button"
              className={active ? 'mobile-reports-switcher__item is-active' : 'mobile-reports-switcher__item'}
              aria-current={active ? 'page' : undefined}
              onClick={() => onLevelChange(item.level)}
            >
              <Icon />
              <span>{item.label}</span>
              {count !== null && <small>{count}</small>}
            </button>
          );
        })}
      </nav>

      <details className="mobile-report-period">
        <summary>
          <span>
            <small>Reporting period</small>
            <strong>{formatReportDateRange(dateFrom, dateTo)}</strong>
          </span>
          <span className="mobile-report-period__scope">{scopeLabel}</span>
        </summary>
        <div className="mobile-report-period__fields">
          <label>
            <span>From</span>
            <input type="date" value={dateFrom} onChange={(event) => onDateFromChange(event.target.value)} />
          </label>
          <label>
            <span>To</span>
            <input type="date" value={dateTo} onChange={(event) => onDateToChange(event.target.value)} />
          </label>
        </div>
      </details>
    </section>
  );
}

interface MobileReportOverviewProps {
  readonly attendance: AttendanceBreakdown;
  readonly completedSessionCount: number;
  readonly confirmedEventCount: number;
  readonly eventCounts: Readonly<Record<string, number>>;
  readonly pendingCount: number;
  readonly rejectedCount: number;
  readonly insight: ReportInsight | null;
  readonly insightLoading: boolean;
  readonly insightError: string;
  readonly rangeValid: boolean;
  readonly onGenerateInsight: () => void;
  readonly onRetryInsight: () => void;
  readonly onExport: () => void;
}

const STATUS_SEGMENTS = [
  { key: 'present', label: 'Present', className: 'is-present' },
  { key: 'late', label: 'Late', className: 'is-late' },
  { key: 'absent', label: 'Absent', className: 'is-absent' },
  { key: 'unknown', label: 'Not recorded', className: 'is-unknown' }
] as const;

interface MobileAttendanceSnapshotProps {
  readonly attendance: AttendanceBreakdown;
  readonly completedSessionCount: number;
  readonly title?: string;
  readonly policyText?: string;
  readonly action?: ReactNode;
}

export function MobileAttendanceSnapshot({
  attendance,
  completedSessionCount,
  title = 'Attendance snapshot',
  policyText,
  action
}: MobileAttendanceSnapshotProps) {
  const recorded = attendance.present + attendance.late + attendance.absent;
  const coverage = percentageOf(recorded, attendance.total, 0);

  return (
    <section className="mobile-report-snapshot">
      <div className="mobile-report-snapshot__head">
        <div>
          <h2>{title}</h2>
          <p>{completedSessionCount} completed session{completedSessionCount === 1 ? '' : 's'} in this period</p>
        </div>
        {action}
      </div>

      {attendance.total === 0 ? (
        <div className="mobile-report-empty">
          <strong>No attendance in this period</strong>
          <span>Choose a range containing completed sessions.</span>
        </div>
      ) : (
        <>
          <div className="mobile-report-snapshot__scores">
            <div className="mobile-report-snapshot__primary">
              <span>Attendance</span>
              <strong>{formatRate(attendance.rate)}</strong>
              <small>of recorded marks</small>
            </div>
            <div className="mobile-report-snapshot__coverage">
              <span>Recorded</span>
              <strong>{coverage}%</strong>
              <small>{recorded} of {attendance.total} marks</small>
            </div>
          </div>

          <div className="mobile-report-distribution" aria-label="Attendance status distribution">
            <div className="mobile-report-distribution__bar" aria-hidden="true">
              {STATUS_SEGMENTS.map((segment) => {
                const value = attendance[segment.key];
                const width = attendance.total === 0 ? 0 : (value / attendance.total) * 100;
                return <span key={segment.key} className={segment.className} style={{ width: `${width}%` }} />;
              })}
            </div>
            <dl>
              {STATUS_SEGMENTS.map((segment) => {
                const value = attendance[segment.key];
                const percent = percentageOf(value, attendance.total, 0);
                return (
                  <div key={segment.key} className={segment.className}>
                    <dt>{segment.label}</dt>
                    <dd><strong>{value}</strong><span>{percent}%</span></dd>
                  </div>
                );
              })}
            </dl>
          </div>
        </>
      )}

      {policyText && <p className="mobile-report-policy">{policyText}</p>}
    </section>
  );
}

interface MobileConfirmedEventsProps {
  readonly counts: Readonly<Record<string, number>>;
  readonly total: number;
  readonly subtitle: string;
  readonly emptyMessage: string;
}

export function MobileConfirmedEvents({ counts, total, subtitle, emptyMessage }: MobileConfirmedEventsProps) {
  const entries = Object.entries(counts).sort((left, right) => right[1] - left[1]);

  return (
    <section className="mobile-report-section mobile-report-events">
      <div className="mobile-report-section__head">
        <div>
          <h2>Confirmed events</h2>
          <p>{subtitle}</p>
        </div>
        <strong className="mobile-report-section__count">{total}</strong>
      </div>
      {entries.length === 0 ? (
        <div className="mobile-report-empty mobile-report-empty--compact">
          <strong>No confirmed events</strong>
          <span>{emptyMessage}</span>
        </div>
      ) : (
        <ul className="mobile-report-events__list">
          {entries.map(([type, count]) => (
            <li key={type}><span>{type}</span><strong>{count}</strong></li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function MobileReportOverview({
  attendance,
  completedSessionCount,
  confirmedEventCount,
  eventCounts,
  pendingCount,
  rejectedCount,
  insight,
  insightLoading,
  insightError,
  rangeValid,
  onGenerateInsight,
  onRetryInsight,
  onExport
}: MobileReportOverviewProps) {
  return (
    <div className="mobile-report-overview">
      <MobileAttendanceSnapshot
        attendance={attendance}
        completedSessionCount={completedSessionCount}
        action={(
          <button type="button" className="btn btn--sm btn--primary" disabled={!rangeValid} onClick={onExport}>
            Export
          </button>
        )}
        policyText={`Only confirmed or corrected AI observations are included. ${pendingCount} pending and ${rejectedCount} rejected are excluded.`}
      />

      <section className="mobile-report-section mobile-report-insight" aria-busy={insightLoading}>
        <div className="mobile-report-section__head">
          <div>
            <h2>AI feedback summary</h2>
            <p>Optional summary of teacher feedback in this period.</p>
          </div>
          {!insightError && (
            <button
              type="button"
              className={insight ? 'btn btn--sm' : 'btn btn--sm btn--primary'}
              disabled={!rangeValid || insightLoading}
              onClick={onGenerateInsight}
            >
              {insightLoading ? 'Generating…' : insight ? 'Refresh' : 'Generate'}
            </button>
          )}
        </div>
        {insightLoading && (
          <output className="mobile-report-insight__loading" aria-label="Generating feedback summary">
            <span /><span /><span />
          </output>
        )}
        {insightError && (
          <div className="mobile-report-inline-error">
            <span>{insightError}</span>
            <button type="button" className="btn btn--sm" onClick={onRetryInsight}>Try again</button>
          </div>
        )}
        {insight && !insightLoading && (
          <div className="mobile-report-insight__content">
            <p>{insight.summary}</p>
            <details>
              <summary>Strengths and next steps</summary>
              <div><strong>Strengths</strong><p>{insight.strengths}</p></div>
              <div><strong>Next steps</strong><p>{insight.nextSteps}</p></div>
            </details>
            <small>Based on {insight.sourceFeedbackCount} teacher feedback note{insight.sourceFeedbackCount === 1 ? '' : 's'}</small>
          </div>
        )}
      </section>

      <MobileConfirmedEvents
        counts={eventCounts}
        total={confirmedEventCount}
        subtitle="Reviewed observations included in reports."
        emptyMessage="Nothing reviewed falls inside this period."
      />
    </div>
  );
}

interface MobileReportDirectoryProps {
  readonly title: string;
  readonly description: string;
  readonly countLabel: string;
  readonly filters: ReactNode;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
}

export function MobileReportDirectory({
  title,
  description,
  countLabel,
  filters,
  children,
  footer
}: MobileReportDirectoryProps) {
  return (
    <section className="mobile-report-directory">
      <header className="mobile-report-directory__head">
        <div><h2>{title}</h2><p>{description}</p></div>
        <span>{countLabel}</span>
      </header>
      <div className="mobile-report-directory__filters">{filters}</div>
      <div className="mobile-report-directory__list">{children}</div>
      {footer && <div className="mobile-report-directory__footer">{footer}</div>}
    </section>
  );
}

interface MobileClassReportItemProps {
  readonly courseCode: string;
  readonly subject: string;
  readonly academicTerm: string;
  readonly attendanceRate: number | null;
  readonly sessionCount: number;
  readonly eventCount: number;
  readonly teacherNames: string;
  readonly onOpen: () => void;
}

export function MobileClassReportItem({
  courseCode,
  subject,
  academicTerm,
  attendanceRate,
  sessionCount,
  eventCount,
  teacherNames,
  onOpen
}: MobileClassReportItemProps) {
  const attendanceLabel = attendanceRate === null ? '—' : formatRate(attendanceRate);

  return (
    <button type="button" className="mobile-report-row" onClick={onOpen}>
      <CourseTile courseCode={courseCode} />
      <span className="mobile-report-row__content">
        <span className="mobile-report-row__title"><strong>{courseCode}</strong><small>{academicTerm}</small></span>
        <span className="mobile-report-row__subtitle">{subject}</span>
        <span className="mobile-report-row__meta">
          {sessionCount} session{sessionCount === 1 ? '' : 's'} · {eventCount} confirmed event{eventCount === 1 ? '' : 's'}
        </span>
        <span className="mobile-report-row__owner">{teacherNames || 'No teacher assigned'}</span>
      </span>
      <span className="mobile-report-row__result">
        <strong>{attendanceLabel}</strong>
        <small>attendance</small>
        <IconArrowRight />
      </span>
    </button>
  );
}

interface MobileStudentReportItemProps {
  readonly name: string;
  readonly studentId: string;
  readonly photoUrl?: string | null;
  readonly tone: string;
  readonly courseLabel: string;
  readonly attendanceRate: number | null;
  readonly recordedCount: number;
  readonly sessionCount: number;
  readonly eventCount: number;
  readonly onOpen: () => void;
}

export function MobileStudentReportItem({
  name,
  studentId,
  photoUrl,
  tone,
  courseLabel,
  attendanceRate,
  recordedCount,
  sessionCount,
  eventCount,
  onOpen
}: MobileStudentReportItemProps) {
  const attendanceLabel = attendanceRate === null ? '—' : formatRate(attendanceRate);

  return (
    <button type="button" className="mobile-report-row mobile-report-row--student" onClick={onOpen}>
      <PersonAvatar photoUrl={photoUrl} name={name} tone={tone} alt={`${name} registration`} />
      <span className="mobile-report-row__content">
        <span className="mobile-report-row__title"><strong>{name}</strong><small>{studentId}</small></span>
        <span className="mobile-report-row__subtitle">{courseLabel}</span>
        <span className="mobile-report-row__meta">
          {recordedCount}/{sessionCount} sessions recorded · {eventCount} confirmed event{eventCount === 1 ? '' : 's'}
        </span>
      </span>
      <span className="mobile-report-row__result">
        <strong>{attendanceLabel}</strong>
        <small>attendance</small>
        <IconArrowRight />
      </span>
    </button>
  );
}
