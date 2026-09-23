import { useMemo, useState } from 'react';
import CreateFeedbackModal from '../components/CreateFeedbackModal';
import CreateAccomplishmentModal from '../components/CreateAccomplishmentModal';
import ReviewAccomplishmentCorrectionModal from '../components/ReviewAccomplishmentCorrectionModal';
import ExportShareModal from '../components/ExportShareModal';
import Modal from '../components/Modal';
import PrepareFeedbackReportModal, { type StudentReportSelection } from '../components/PrepareFeedbackReportModal';
import StudentReportPrint from '../components/StudentReportPrint';
import StudentProfileDesktopView from '../features/student-profile/StudentProfileDesktopView';
import StudentProfileMobileView from '../features/student-profile/StudentProfileMobileView';
import { buildStudentProfileModel } from '../features/student-profile/studentProfileModel';
import { useStudentProfileRecords } from '../features/student-profile/useStudentProfileRecords';
import { apiMessage } from '../lib/apiClient';
import { updateStudentAccountStatus } from '../lib/studentApi';
import type { Console } from '../hooks/useConsole';
import type { Accomplishment, FeedbackSummary, Student } from '../types';

interface Props {
  readonly profile: Student;
  readonly console: StudentProfileConsole;
  readonly isAdmin: boolean;
}

type StudentProfileConsole = Pick<
  Console,
  | 'attendanceStatusFor'
  | 'dateFrom'
  | 'dateTo'
  | 'events'
  | 'refreshAccomplishments'
  | 'refreshStudents'
  | 'sessions'
  | 'setProfileId'
  | 'showToast'
  | 'updateAccomplishment'
>;

// Rendered with `key={profile.id}` by the caller, so React fully remounts this component (and
// resets all the useState below) whenever the admin looks at a different student — no manual
// "reset on profile change" effect needed here.
export default function StudentProfile({ profile, console: c, isAdmin }: Props) {
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

  const [addingFeedback, setAddingFeedback] = useState(false);
  const [addingAccomplishment, setAddingAccomplishment] = useState(false);
  const [preparingReport, setPreparingReport] = useState(false);
  const [shareSummaries, setShareSummaries] = useState<FeedbackSummary[] | null>(null);
  const [printReport, setPrintReport] = useState<StudentReportSelection | null>(null);
  const [reviewingAccomplishment, setReviewingAccomplishment] = useState<Accomplishment | null>(null);

  const records = useStudentProfileRecords({
    studentRecordId: profile.recordId,
    showToast: c.showToast,
    onAccomplishmentUpdated: c.updateAccomplishment
  });
  const {
    progressReports,
    savingFeedback,
    summaries,
    classOptions: reportClassOptions,
    accomplishments,
    refreshSummaries,
    refreshAccomplishments,
    addFeedback,
    replaceAccomplishment
  } = records;

  const profileModel = useMemo(
    () => buildStudentProfileModel({
      student: profile,
      sessions: c.sessions,
      events: c.events,
      accomplishments,
      attendanceStatusFor: c.attendanceStatusFor
    }),
    [accomplishments, c.attendanceStatusFor, c.events, c.sessions, profile]
  );
  return (
    <div className="page__inner student-profile-page">
      <StudentProfileMobileView
        student={profile}
        sessions={c.sessions}
        attendanceStatusFor={c.attendanceStatusFor}
        model={profileModel}
        records={records}
        onBack={() => {
          c.setProfileId(null);
          window.scrollTo({ top: 0, behavior: 'auto' });
        }}
        onAddFeedback={() => setAddingFeedback(true)}
        onAddAccomplishment={() => setAddingAccomplishment(true)}
        onPrepareReport={() => setPreparingReport(true)}
        onReviewAccomplishment={setReviewingAccomplishment}
      />

      <StudentProfileDesktopView
        student={profile}
        sessions={c.sessions}
        attendanceStatusFor={c.attendanceStatusFor}
        model={profileModel}
        records={records}
        isAdmin={isAdmin}
        updatingStatus={updatingStatus}
        onBack={() => {
          c.setProfileId(null);
          window.scrollTo({ top: 0, behavior: 'auto' });
        }}
        onAddFeedback={() => setAddingFeedback(true)}
        onAddAccomplishment={() => setAddingAccomplishment(true)}
        onPrepareReport={() => setPreparingReport(true)}
        onToggleStudentStatus={() => {
          if (profile.accountStatus === 'active') {
            setConfirmingWithdraw(true);
          } else {
            void reactivateStudent();
          }
        }}
        onReviewAccomplishment={setReviewingAccomplishment}
      />

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
                className="btn btn--danger"
                disabled={updatingStatus}
                onClick={() => void withdrawStudent()}
              >
                {updatingStatus ? 'Withdrawing…' : 'Withdraw student'}
              </button>
            </>
          }
        />
      )}

      {addingFeedback && profile.recordId && (
        <CreateFeedbackModal
          target="student"
          studentRecordId={profile.recordId}
          studentName={profile.name}
          saving={savingFeedback}
          onCreate={addFeedback}
          onClose={() => setAddingFeedback(false)}
        />
      )}

      {addingAccomplishment && profile.recordId && (
        <CreateAccomplishmentModal
          courseOptions={reportClassOptions.map((option) => ({ id: option.courseOfferingId, label: option.label }))}
          students={[profile]}
          initialStudentIds={[profile.recordId]}
          onClose={() => setAddingAccomplishment(false)}
          onCreated={async () => { await Promise.all([refreshAccomplishments(), c.refreshAccomplishments()]); }}
          showToast={c.showToast}
        />
      )}

      {reviewingAccomplishment && (
        <ReviewAccomplishmentCorrectionModal
          accomplishment={reviewingAccomplishment}
          onClose={() => setReviewingAccomplishment(null)}
          onReviewed={(updated) => {
            replaceAccomplishment(updated);
          }}
          showToast={c.showToast}
        />
      )}

      {shareSummaries && (
        <ExportShareModal summaries={shareSummaries} onClose={() => setShareSummaries(null)} onUpdated={refreshSummaries} showToast={c.showToast} />
      )}

      {preparingReport && (
        <PrepareFeedbackReportModal
          reports={progressReports}
          summaries={summaries}
          availableCourses={reportClassOptions.map((option) => ({
            id: option.courseOfferingId,
            label: option.label
          }))}
          dateFrom={c.dateFrom}
          dateTo={c.dateTo}
          onClose={() => setPreparingReport(false)}
          onUpdated={refreshSummaries}
          onContinue={(selection) => {
            setPrintReport(selection);
            setPreparingReport(false);
            setShareSummaries(selection.summaries);
          }}
          showToast={c.showToast}
        />
      )}

      <StudentReportPrint student={profile} report={printReport} accomplishments={accomplishments} console={c} />
    </div>
  );
}
