import { useRef, useState, type KeyboardEvent } from 'react';
import BackButton from '../../components/BackButton';
import { IconAward, IconBarChart, IconClipboardCheck, IconMessageSquare } from '../../components/icons';
import PersonAvatar from '../../components/PersonAvatar';
import { avatarTone, formatRate, studentRateLabel, studentRateLabelClass } from '../../lib/format';
import { studentLevelLabel } from '../../lib/studentLevels';
import type { Accomplishment, AttendanceStatus, Session, Student } from '../../types';
import {
  MobileAchievementsSection,
  MobileAttendanceSection,
  MobileFeedbackSection,
  MobileMoreSection
} from './StudentProfileMobileSections';
import type { StudentProfileModel } from './studentProfileModel';
import type { StudentProfileRecords } from './useStudentProfileRecords';

type MobileProfileSection = 'feedback' | 'attendance' | 'achievements' | 'more';

interface Props {
  readonly student: Student;
  readonly sessions: Session[];
  readonly attendanceStatusFor: (studentId: string, sessionId: string) => AttendanceStatus;
  readonly model: StudentProfileModel;
  readonly records: StudentProfileRecords;
  readonly onBack: () => void;
  readonly onAddFeedback: () => void;
  readonly onAddAccomplishment: () => void;
  readonly onPrepareReport: () => void;
  readonly onReviewAccomplishment: (accomplishment: Accomplishment) => void;
}

const SECTIONS: readonly MobileProfileSection[] = ['feedback', 'attendance', 'achievements', 'more'];

const SECTION_TABS = [
  ['feedback', 'Feedback'],
  ['attendance', 'Attendance'],
  ['achievements', 'Achievements'],
  ['more', 'More']
] as const;

function sectionIndexForKey(key: string, currentIndex: number): number | null {
  if (key === 'ArrowRight') return (currentIndex + 1) % SECTIONS.length;
  if (key === 'ArrowLeft') return (currentIndex - 1 + SECTIONS.length) % SECTIONS.length;
  if (key === 'Home') return 0;
  if (key === 'End') return SECTIONS.length - 1;
  return null;
}

function sectionCount(
  section: MobileProfileSection,
  model: StudentProfileModel,
  records: StudentProfileRecords
): number | null {
  if (section === 'feedback') return records.loadingReports ? null : records.progressReports.length;
  if (section === 'attendance') return model.attendanceHistory.length;
  if (section === 'achievements') {
    return records.loadingAccomplishments ? null : records.accomplishments.length;
  }
  return null;
}

interface ProfileHeroProps {
  readonly student: Student;
  readonly model: StudentProfileModel;
  readonly records: StudentProfileRecords;
}

function ProfileHero({ student, model, records }: ProfileHeroProps) {
  const rate = student.rate;
  const hasRate = rate !== null && model.hasRecordedAttendance;
  let rateStatus = 'Not recorded';
  if (model.hasRecordedAttendance) rateStatus = 'Unavailable';

  return (
    <section className="student-mobile-profile__hero" aria-labelledby="student-mobile-profile-name">
      <div className="student-mobile-profile__identity">
        <PersonAvatar
          photoUrl={student.registrationPhoto}
          name={student.name}
          tone={avatarTone(student.id, 0)}
          alt={`${student.name} registration`}
          large
        />
        <div>
          <div className="student-mobile-profile__name-line">
            <h2 id="student-mobile-profile-name">{student.name}</h2>
            {student.accountStatus === 'withdrawn' && (
              <span className="badge badge--neutral">Withdrawn</span>
            )}
          </div>
          <p>{student.id} · {studentLevelLabel(student.level)}</p>
        </div>
      </div>
      <div className="student-mobile-profile__headline-stats">
        <div className="student-mobile-profile__rate">
          <strong>{model.hasRecordedAttendance ? formatRate(student.rate) : '—'}</strong>
          {hasRate ? (
            <span className={studentRateLabelClass(rate)}>{studentRateLabel(rate)}</span>
          ) : (
            <span className="student-mobile-profile__rate-empty">{rateStatus}</span>
          )}
        </div>
        <div className="student-mobile-profile__support-stat">
          <strong>{model.courses.length}</strong>
          <span>Classes</span>
        </div>
        <div className="student-mobile-profile__support-stat">
          <strong aria-label={records.loadingReports ? 'Loading feedback count' : undefined}>
            {records.loadingReports ? '—' : records.progressReports.length}
          </strong>
          <span>Feedback notes</span>
        </div>
      </div>
    </section>
  );
}

interface AttendanceGlanceProps {
  readonly model: StudentProfileModel;
  readonly onOpenHistory: () => void;
}

function AttendanceGlance({ model, onOpenHistory }: AttendanceGlanceProps) {
  const recorded = model.attendanceBreakdown.total - model.attendanceBreakdown.unknown;
  let emptyMessage = 'Attendance has not been recorded yet.';
  if (model.hasRecordedAttendance) emptyMessage = 'No absences recorded.';

  return (
    <section className="student-mobile-attendance" aria-labelledby="student-mobile-attendance-title">
      <div className="student-mobile-section-heading">
        <div>
          <span className="student-mobile-section-heading__icon" aria-hidden="true"><IconBarChart /></span>
          <div>
            <h3 id="student-mobile-attendance-title">Attendance at a glance</h3>
            <p>Across {model.attendanceBreakdown.total} session{model.attendanceBreakdown.total === 1 ? '' : 's'}</p>
          </div>
        </div>
        <div className="student-mobile-attendance__coverage">
          <strong>{recorded}/{model.attendanceBreakdown.total}</strong>
          <span>recorded</span>
        </div>
      </div>
      <div className="student-mobile-attendance__distribution" aria-label="Attendance status totals">
        <div className="is-present"><span>Present</span><strong>{model.attendanceBreakdown.present}</strong></div>
        <div className="is-late"><span>Late</span><strong>{model.attendanceBreakdown.late}</strong></div>
        <div className="is-absent"><span>Absent</span><strong>{model.attendanceBreakdown.absent}</strong></div>
        <div className="is-unknown"><span>Not recorded</span><strong>{model.attendanceBreakdown.unknown}</strong></div>
      </div>
      {model.absences.length > 0 ? (
        <button type="button" className="student-mobile-attendance__absence-link" onClick={onOpenHistory}>
          <span>
            <strong>{model.absences.length} absence{model.absences.length === 1 ? '' : 's'}</strong>
            <small>Latest: {model.absences[0]?.dateLabel} · {model.absences[0]?.course}</small>
          </span>
          <span aria-hidden="true">View history →</span>
        </button>
      ) : (
        <div className={`student-mobile-attendance__clear${model.hasRecordedAttendance ? '' : ' is-pending'}`}>
          {emptyMessage}
        </div>
      )}
    </section>
  );
}

/** Responsive student profile presentation. Data loading and business rules stay in the feature
 * hook/model so this component owns only mobile navigation and rendering. */
export default function StudentProfileMobileView({
  student,
  sessions,
  attendanceStatusFor,
  model,
  records,
  onBack,
  onAddFeedback,
  onAddAccomplishment,
  onPrepareReport,
  onReviewAccomplishment
}: Props) {
  const [section, setSection] = useState<MobileProfileSection>('feedback');
  const recordRef = useRef<HTMLDivElement>(null);

  const openSection = (nextSection: MobileProfileSection) => {
    setSection(nextSection);
    window.requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      recordRef.current?.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start'
      });
      recordRef.current
        ?.querySelector<HTMLButtonElement>(`[data-mobile-section="${nextSection}"]`)
        ?.focus({ preventScroll: true });
    });
  };

  const handleSectionKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentSection: MobileProfileSection
  ) => {
    const nextIndex = sectionIndexForKey(event.key, SECTIONS.indexOf(currentSection));
    if (nextIndex === null) return;

    event.preventDefault();
    const nextSection = SECTIONS[nextIndex];
    setSection(nextSection);
    window.requestAnimationFrame(() => {
      recordRef.current
        ?.querySelector<HTMLButtonElement>(`[data-mobile-section="${nextSection}"]`)
        ?.focus();
    });
  };

  return (
    <div className="student-profile-mobile-layout">
      <BackButton className="student-mobile-profile__back" label="All students" onClick={onBack} />
      <ProfileHero student={student} model={model} records={records} />

      <section className="student-mobile-profile__actions" aria-label="Student actions">
        <button type="button" className="student-mobile-profile__primary-action" disabled={!student.recordId} onClick={onAddFeedback}>
          <span aria-hidden="true"><IconMessageSquare /></span>
          <span><strong>Add feedback</strong><small>Write a note for this student’s report</small></span>
        </button>
        <div className="student-mobile-profile__secondary-actions">
          <button type="button" disabled={!student.recordId || records.classOptions.length === 0} onClick={onAddAccomplishment}>
            <IconAward /><span>Add achievement</span>
          </button>
          <button type="button" onClick={onPrepareReport}>
            <IconClipboardCheck /><span>Export &amp; share</span>
          </button>
        </div>
      </section>

      {model.achievementsNeedingReview > 0 && (
        <button type="button" className="student-mobile-profile__review-alert" onClick={() => openSection('achievements')}>
          <span className="student-mobile-profile__review-count">{model.achievementsNeedingReview}</span>
          <span>
            <strong>
              Achievement change{model.achievementsNeedingReview === 1 ? '' : 's'}{' '}
              {model.achievementsNeedingReview === 1 ? 'needs' : 'need'} review
            </strong>
            <small>Open the student’s request before sharing.</small>
          </span>
          <span aria-hidden="true">→</span>
        </button>
      )}

      <AttendanceGlance model={model} onOpenHistory={() => openSection('attendance')} />

      <div ref={recordRef} className="student-mobile-profile__record">
        <nav className="student-mobile-profile__tabs" aria-label="Student record sections" role="tablist">
          {SECTION_TABS.map(([itemSection, label]) => {
            const count = sectionCount(itemSection, model, records);
            return (
              <button
                key={itemSection}
                type="button"
                id={`student-mobile-tab-${itemSection}`}
                data-mobile-section={itemSection}
                className={section === itemSection ? 'is-active' : ''}
                role="tab"
                aria-selected={section === itemSection}
                aria-controls="student-mobile-record-panel"
                tabIndex={section === itemSection ? 0 : -1}
                onClick={() => setSection(itemSection)}
                onKeyDown={(event) => handleSectionKeyDown(event, itemSection)}
              >
                <span>{label}</span>
                {count !== null && <small>{count}</small>}
              </button>
            );
          })}
        </nav>

        <section
          id="student-mobile-record-panel"
          className="student-mobile-profile__panel"
          role="tabpanel"
          aria-labelledby={`student-mobile-tab-${section}`}
        >
          {section === 'feedback' && (
            <MobileFeedbackSection student={student} records={records} onAddFeedback={onAddFeedback} />
          )}
          {section === 'attendance' && (
            <MobileAttendanceSection student={student} model={model} attendanceStatusFor={attendanceStatusFor} />
          )}
          {section === 'achievements' && (
            <MobileAchievementsSection
              student={student}
              model={model}
              records={records}
              onAddAccomplishment={onAddAccomplishment}
              onReviewAccomplishment={onReviewAccomplishment}
            />
          )}
          {section === 'more' && <MobileMoreSection student={student} model={model} sessions={sessions} />}
        </section>
      </div>
    </div>
  );
}
