import { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { apiMessage } from '../lib/apiClient';
import { avatarTone, faceEnrollmentLabel, initials, statusClass } from '../lib/format';
import { formatSessionDateLabel, formatSessionTimeRange, formatTimestampClock } from '../lib/sessionTime';
import { getStudent, mapStudentApiToUi } from '../lib/studentApi';
import { getMyAttendanceHistory } from '../lib/studentPortalApi';
import type { AttendanceStatus, AuthUser, Student, StudentAttendanceHistoryEntry } from '../types';

interface Props {
  readonly user: AuthUser;
  readonly onLogout: () => void;
}

export default function StudentPortal({ user, onLogout }: Props) {
  const { theme, setTheme } = useTheme();
  const [profile, setProfile] = useState<Student | null>(null);
  const [profileError, setProfileError] = useState('');
  const [history, setHistory] = useState<StudentAttendanceHistoryEntry[]>([]);
  const [historyError, setHistoryError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setProfileError('');
    setHistoryError('');

    Promise.allSettled([getStudent(user.id), getMyAttendanceHistory(user.id)]).then(
      ([profileResult, historyResult]) => {
        if (cancelled) return;
        if (profileResult.status === 'fulfilled') {
          setProfile(mapStudentApiToUi(profileResult.value));
        } else {
          setProfileError(apiMessage(profileResult.reason));
        }
        if (historyResult.status === 'fulfilled') {
          setHistory(historyResult.value);
        } else {
          setHistoryError(apiMessage(historyResult.reason));
        }
        setLoading(false);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [user.id, user.token]);

  const counts = useMemo(() => {
    const base: Record<AttendanceStatus, number> = { Present: 0, Late: 0, Absent: 0, Unknown: 0 };
    history.forEach((row) => {
      base[row.status] += 1;
    });
    const attended = base.Present + base.Late;
    const rate = history.length > 0 ? Math.round((attended / history.length) * 100) : 0;
    return { ...base, rate, total: history.length };
  }, [history]);

  const stats = [
    { label: 'Present', value: counts.Present, tone: 'present', helper: 'On time' },
    { label: 'Late', value: counts.Late, tone: 'late', helper: 'Arrived after start' },
    { label: 'Absent', value: counts.Absent, tone: 'absent', helper: 'No check-in recorded' },
    {
      label: 'Attendance rate',
      value: `${counts.rate}%`,
      tone: 'rate',
      helper: `${counts.total} session${counts.total === 1 ? '' : 's'} recorded`
    }
  ];

  const displayName = profile ? profile.name : user.name;
  const tone = avatarTone(user.id, 0);

  return (
    <div className="student-portal">
      <header className="student-portal__top">
        <div className="student-portal__identity">
          <div className={`person__avatar ${tone}`} aria-hidden="true">
            {initials(displayName)}
          </div>
          <div>
            <div className="student-portal__identity-name">{displayName}</div>
            <div className="student-portal__identity-role">Student · {user.email}</div>
          </div>
        </div>

        <div className="header__actions">
          <button
            type="button"
            className="btn"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            title="Switch theme"
          >
            {theme === 'light' ? 'Dark' : 'Light'}
          </button>
          <button type="button" className="btn btn--quiet" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </header>

      <div className="student-portal__page">
        <div className="student-portal__inner">
          <section className="card profile-card dashboard-enter stagger-0">
            <div className={`person__avatar person__avatar--large ${tone}`} aria-hidden="true">
              {initials(displayName)}
            </div>
            <div className="profile-card__body">
              <div className="card__title">{displayName}</div>
              <div className="profile-card__meta">
                <span>{profile?.studentNumber ?? '—'}</span>
                <span>{profile?.program ?? '—'}</span>
                <span>{(profile?.courses ?? [profile?.course ?? '—']).join(', ')}</span>
                {profile && (
                  <span className={statusClass(profile.faceEnrollmentStatus ?? 'NOT_ENROLLED')}>
                    Face enrolment: {faceEnrollmentLabel(profile.faceEnrollmentStatus)}
                  </span>
                )}
              </div>
            </div>
          </section>

          {profileError && (
            <div className="notice notice--warn">
              <span className="notice__mark" aria-hidden="true" />
              <span>{profileError}</span>
            </div>
          )}

          <div className="stat-grid">
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className={`stat attendance-stat attendance-stat--${stat.tone} dashboard-enter stagger-${index + 1}`}
              >
                <div className="attendance-stat__head">
                  <span className="attendance-stat__marker" aria-hidden="true" />
                  <div className="stat__label">{stat.label}</div>
                </div>
                <div className="stat__value stat__value--attendance">{stat.value}</div>
                <div className="stat__delta stat__delta--muted">{stat.helper}</div>
              </div>
            ))}
          </div>

          {historyError && (
            <div className="notice notice--warn">
              <span className="notice__mark" aria-hidden="true" />
              <span>{historyError}</span>
            </div>
          )}

          <section className="card dashboard-enter stagger-6">
            <div className="card__head">
              <div>
                <div className="card__title">My attendance history</div>
                <div className="card__sub">Every classroom session you were enrolled for.</div>
              </div>
            </div>

            <table className="table table--compact">
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Date &amp; time</th>
                  <th>Status</th>
                  <th>Check-in</th>
                  <th>Check-out</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.sessionId}>
                    <td>
                      <div className="cell-strong">{row.course}</div>
                      <div className="cell-sub">{row.room}</div>
                    </td>
                    <td className="mono">
                      {formatSessionDateLabel(row.sessionDate)}
                      <div className="cell-sub">
                        {formatSessionTimeRange(row.startTime, row.endTime, row.sessionDate)}
                      </div>
                    </td>
                    <td>
                      <span className={statusClass(row.status)}>{row.status}</span>
                    </td>
                    <td className="mono">{formatTimestampClock(row.checkInTime)}</td>
                    <td className="mono">{formatTimestampClock(row.checkOutTime)}</td>
                  </tr>
                ))}

                {loading &&
                  ['62%', '80%', '48%', '71%'].map((width, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="table__skeleton-cell">
                        <div className={`skeleton skeleton--w-${width.replace('%', '')}`} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>

            {!loading && history.length === 0 && !historyError && (
              <div className="empty">No attendance has been recorded for you yet.</div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
