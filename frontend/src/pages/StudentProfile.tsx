import { useState } from 'react';
import Modal from '../components/Modal';
import PersonAvatar from '../components/PersonAvatar';
import ShowMoreOrPager from '../components/ShowMoreOrPager';
import { useExpandablePage } from '../hooks/useExpandablePage';
import { apiMessage } from '../lib/apiClient';
import { eventMatchesStudent, eventSessionLabel } from '../lib/eventDisplay';
import { avatarTone, formatRate, statusClass } from '../lib/format';
import { studentCourses } from '../lib/studentCourses';
import { updateStudentAccountStatus } from '../lib/studentApi';
import type { Console } from '../hooks/useConsole';
import type { Student } from '../types';

interface Props {
  readonly profile: Student;
  readonly console: Console;
}

// "Unknown" is the right internal value (it's what attendanceStatusFor returns and what the
// correction dropdown elsewhere in the app matches against) — it just reads like a system error
// rather than "no one marked this yet" when shown as a label here.
function attendanceStatusLabel(status: string): string {
  return status === 'Unknown' ? 'Not recorded' : status;
}

// Rendered with `key={profile.id}` by the caller, so React fully remounts this component (and
// resets all the useState below) whenever the admin looks at a different student — no manual
// "reset on profile change" effect needed here.
export default function StudentProfile({ profile, console: c }: Props) {
  const [updatingStatus, setUpdatingStatus] = useState(false);
  // Reactivating is a single click (same as everywhere else in the app — Staff, Classes), but
  // withdrawing a student loses them system access and drops every current class enrolment, so it
  // gets a confirmation step first rather than firing on the first click.
  const [confirmingWithdraw, setConfirmingWithdraw] = useState(false);

  const reactivateStudent = async () => {
    if (!profile.recordId) return;
    setUpdatingStatus(true);
    try {
      await updateStudentAccountStatus(profile.recordId, 'active');
      await c.refreshStudents();
    } catch (error) {
      c.showToast(apiMessage(error));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const withdrawStudent = async () => {
    if (!profile.recordId) return;
    setUpdatingStatus(true);
    try {
      await updateStudentAccountStatus(profile.recordId, 'withdrawn');
      await c.refreshStudents();
      setConfirmingWithdraw(false);
    } catch (error) {
      c.showToast(apiMessage(error));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const confirmed = c.events.filter(
    (event) =>
      eventMatchesStudent(event, profile) &&
      (event.status === 'Confirmed' || event.status === 'Corrected')
  );

  const profileCourses = studentCourses(profile);
  const coursesExpand = useExpandablePage(profileCourses, 3);

  // Most-recent-first regardless of whatever order c.sessions happens to be in — a newly
  // created session gets prepended to that array on creation, so it isn't reliably date-sorted.
  const attendanceHistory = c.sessions
    .filter((session) => profileCourses.includes(session.course))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const attendanceAllUnrecorded =
    attendanceHistory.length > 0 &&
    attendanceHistory.every((session) => c.attendanceStatusFor(profile.id, session.id) === 'Unknown');
  const attendanceExpand = useExpandablePage(attendanceHistory, 4);
  const eventsExpand = useExpandablePage(confirmed, 4);

  // No ProgressReport entity exists anywhere in this app yet (no teacher-authored report table,
  // no API for it) — so the honest count is always 0 and the section always shows the "none
  // yet" state below. Kept as a derived value rather than a literal so the one place that needs
  // to change, once a real report source exists, is this line.
  const progressReports: never[] = [];

  return (
    <div className="page__inner">
      <button type="button" className="btn page-action" onClick={() => c.setProfileId(null)}>
        ← Back to all students
      </button>

      <section className="card dashboard-enter stagger-0">
        <div className="card__body profile-hero">
          <PersonAvatar
            photoUrl={profile.registrationPhoto}
            name={profile.name}
            tone={avatarTone(profile.id, 0)}
            alt={`${profile.name} registration`}
            large
          />
          <div className="profile-hero__main">
            <div className="profile-hero__name row-inline">
              {profile.name}
              {profile.accountStatus === 'withdrawn' && (
                <span className="badge badge--neutral">Withdrawn</span>
              )}
            </div>
            <div className="cell-sub profile-hero__sub">
              {profile.id} · {profile.program || 'Programme not provided'}
              {profile.email ? ` · ${profile.email}` : ''}
            </div>
          </div>
          <div className="profile-hero__stats">
            <div>
              <div className="stat__label">Classes</div>
              <div className="profile-hero__metric">{profileCourses.length}</div>
            </div>
            <div>
              <div className="stat__label">Attendance</div>
              <div className="profile-hero__metric">{formatRate(profile.rate)}</div>
            </div>
            <div>
              <div className="stat__label">Reports</div>
              <div className="profile-hero__metric">{progressReports.length}</div>
            </div>
          </div>
          {profile.recordId && (
            <button
              type="button"
              className="btn"
              disabled={updatingStatus}
              onClick={() =>
                profile.accountStatus === 'active'
                  ? setConfirmingWithdraw(true)
                  : void reactivateStudent()
              }
            >
              {profile.accountStatus === 'active' ? 'Withdraw student' : 'Reactivate student'}
            </button>
          )}
        </div>
      </section>

      {confirmingWithdraw && (
        <Modal
          onClose={() => setConfirmingWithdraw(false)}
          size="confirm"
          role="alertdialog"
          titleId="confirm-withdraw-title"
          title="Withdraw this student?"
          subtitle="The student will lose system access and all active class enrolments will be marked as withdrawn. Historical records will be retained."
          footer={
            <>
              <button
                type="button"
                className="btn"
                disabled={updatingStatus}
                onClick={() => setConfirmingWithdraw(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={updatingStatus}
                onClick={() => void withdrawStudent()}
              >
                {updatingStatus ? 'Withdrawing…' : 'Withdraw student'}
              </button>
            </>
          }
        />
      )}

      <div className="grid-profile">
        <div className="profile-column">
          <section className="card dashboard-enter stagger-1">
            <div className="card__body">
              <div className="card__title card__title--spaced">Student information</div>
              <div className="kv">
                <span className="kv__k">Student ID</span>
                <span className="kv__v">{profile.id}</span>
              </div>
              <div className="kv">
                <span className="kv__k">Programme</span>
                <span className="kv__v">{profile.program || 'Not provided'}</span>
              </div>
              <div className="kv">
                <span className="kv__k">University email</span>
                <span className="kv__v">{profile.email}</span>
              </div>
              <div className="kv">
                <span className="kv__k">Assigned seat</span>
                <span className="kv__v">{profile.seat}</span>
              </div>
            </div>
          </section>

          <section className="card dashboard-enter stagger-2">
            <div className="card__body">
              <div className="card__title card__title--spaced">Enrolled classes</div>
              <div className="card__sub">
                {profileCourses.length} enrolled class{profileCourses.length === 1 ? '' : 'es'}
              </div>
              {coursesExpand.visibleItems.map((course) => (
                <div key={course} className="kv">
                  <span className="kv__v">{course}</span>
                </div>
              ))}
              <ShowMoreOrPager
                showingAll={coursesExpand.showingAll}
                hasMore={coursesExpand.hasMore}
                onShowAll={coursesExpand.showAll}
                paged={coursesExpand.paged}
                moreLabel={`Show all ${profileCourses.length} classes →`}
              />
            </div>
          </section>
        </div>

        <div className="profile-column">
          <section className="card dashboard-enter stagger-1">
            <div className="card__body">
              <div className="card__title card__title--spaced">Attendance history</div>
              {attendanceHistory.length === 0 ? (
                <div className="empty empty--compact">No attendance history yet.</div>
              ) : attendanceAllUnrecorded && !attendanceExpand.showingAll ? (
                <>
                  <div className="empty empty--compact">
                    No attendance has been recorded for this student yet.
                  </div>
                  <div className="cell-sub">
                    {attendanceHistory.length} classroom session
                    {attendanceHistory.length === 1 ? '' : 's'} found.
                  </div>
                  <button
                    type="button"
                    className="btn btn--quiet btn--sm"
                    onClick={attendanceExpand.showAll}
                  >
                    View session history →
                  </button>
                </>
              ) : (
                <>
                  {attendanceExpand.visibleItems.map((session) => {
                    const status = c.attendanceStatusFor(profile.id, session.id);
                    return (
                      <div key={session.id} className="kv kv--history">
                        <div>
                          <div className="cell-strong cell-strong--compact">{session.dateLabel}</div>
                          <div className="cell-sub">
                            {session.course} · {session.room}
                          </div>
                        </div>
                        <span className={statusClass(status)}>{attendanceStatusLabel(status)}</span>
                      </div>
                    );
                  })}
                  <ShowMoreOrPager
                    showingAll={attendanceExpand.showingAll}
                    hasMore={attendanceExpand.hasMore}
                    onShowAll={attendanceExpand.showAll}
                    paged={attendanceExpand.paged}
                    moreLabel="View full attendance history →"
                  />
                </>
              )}
            </div>
          </section>

          <section className="card dashboard-enter stagger-2">
            <div className="card__body">
              <div className="card__title-line">
                <div className="card__title">Progress Reports</div>
                <span className="cell-sub">
                  {progressReports.length} report{progressReports.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="empty empty--compact">
                No progress reports have been created for this student yet.
              </div>
            </div>
          </section>

          <section className="card dashboard-enter stagger-3">
            <div className="card__body">
              <div className="card__title-line">
                <div className="card__title">Recent Confirmed Events</div>
                <span className="cell-sub">{confirmed.length}</span>
              </div>
              {confirmed.length === 0 ? (
                <div className="empty empty--compact">No confirmed events for this student.</div>
              ) : (
                <>
                  <div className="card__sub card__sub--events">
                    Teacher-confirmed or corrected observations only.
                  </div>
                  {eventsExpand.visibleItems.map((event) => (
                    <div key={event.id} className="kv kv--event">
                      <div>
                        <div className="cell-strong cell-strong--compact">{event.type}</div>
                        <div className="cell-sub">
                          {eventSessionLabel(event, c.sessions)} · {event.start} · {event.duration}
                        </div>
                      </div>
                      <span className={statusClass(event.status)}>{event.status}</span>
                    </div>
                  ))}
                  <ShowMoreOrPager
                    showingAll={eventsExpand.showingAll}
                    hasMore={eventsExpand.hasMore}
                    onShowAll={eventsExpand.showAll}
                    paged={eventsExpand.paged}
                    moreLabel={`View all ${confirmed.length} confirmed events →`}
                  />
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
