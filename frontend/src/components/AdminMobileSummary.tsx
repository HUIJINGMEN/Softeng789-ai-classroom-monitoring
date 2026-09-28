import {
  IconActivity,
  IconChevronRight,
  IconGraduationCap,
  IconMonitor,
  IconUser,
  IconUsers
} from './icons';
import type { ReactNode } from 'react';

interface Props {
  readonly activeClasses: number;
  readonly students: number;
  readonly teachers: number;
  readonly liveSessions: number;
  readonly pendingReviews: number;
  readonly unassignedClasses: number;
  readonly onOpenClasses: () => void;
  readonly onOpenStudents: () => void;
  readonly onOpenStaff: () => void;
  readonly onOpenLive: () => void;
  readonly onOpenReviews: () => void;
}

interface MetricProps {
  readonly icon: ReactNode;
  readonly label: string;
  readonly value: number;
  readonly onClick: () => void;
}

function InstitutionMetric({ icon, label, value, onClick }: MetricProps) {
  return (
    <button type="button" className="admin-mobile-summary__metric" onClick={onClick}>
      <span aria-hidden="true">{icon}</span>
      <strong>{value}</strong>
      <small>{label}</small>
    </button>
  );
}

export default function AdminMobileSummary({
  activeClasses,
  students,
  teachers,
  liveSessions,
  pendingReviews,
  unassignedClasses,
  onOpenClasses,
  onOpenStudents,
  onOpenStaff,
  onOpenLive,
  onOpenReviews
}: Props) {
  const needsAttention = pendingReviews > 0 || unassignedClasses > 0;

  return (
    <section className="admin-mobile-summary" aria-labelledby="admin-mobile-summary-title">
      <header className="admin-mobile-summary__head">
        <div>
          <span>Today</span>
          <h2 id="admin-mobile-summary-title">Institution status</h2>
        </div>
        <span className={needsAttention ? 'is-attention' : 'is-clear'}>
          <i aria-hidden="true" />
          {needsAttention ? 'Needs attention' : 'All clear'}
        </span>
      </header>

      <div className="admin-mobile-summary__priorities">
        <button
          type="button"
          className={`admin-mobile-summary__priority${pendingReviews > 0 ? ' is-attention' : ''}`}
          onClick={onOpenReviews}
        >
          <span className="admin-mobile-summary__priority-icon" aria-hidden="true"><IconActivity /></span>
          <span>
            <small>Review queue</small>
            <strong>{pendingReviews > 0 ? `${pendingReviews} AI review${pendingReviews === 1 ? '' : 's'}` : 'Queue is clear'}</strong>
            <em>{pendingReviews > 0 ? 'Candidate observations awaiting a decision' : 'No observations need a decision'}</em>
          </span>
          <IconChevronRight />
        </button>

        <button
          type="button"
          className={`admin-mobile-summary__priority${liveSessions > 0 ? ' is-live' : ''}`}
          onClick={onOpenLive}
        >
          <span className="admin-mobile-summary__priority-icon" aria-hidden="true"><IconMonitor /></span>
          <span>
            <small>Live now</small>
            <strong>{liveSessions > 0 ? `${liveSessions} active session${liveSessions === 1 ? '' : 's'}` : 'No active sessions'}</strong>
            <em>{liveSessions > 0 ? 'Open monitoring for the current session' : 'The institution is quiet right now'}</em>
          </span>
          <IconChevronRight />
        </button>
      </div>

      <div className="admin-mobile-summary__institution">
        <div className="admin-mobile-summary__institution-head">
          <span>Institution</span>
          {unassignedClasses > 0 && <small>{unassignedClasses} class{unassignedClasses === 1 ? '' : 'es'} need a teacher</small>}
        </div>
        <div className="admin-mobile-summary__metrics">
          <InstitutionMetric icon={<IconGraduationCap />} label="Active classes" value={activeClasses} onClick={onOpenClasses} />
          <InstitutionMetric icon={<IconUsers />} label="Students" value={students} onClick={onOpenStudents} />
          <InstitutionMetric icon={<IconUser />} label="Teachers" value={teachers} onClick={onOpenStaff} />
        </div>
      </div>
    </section>
  );
}
