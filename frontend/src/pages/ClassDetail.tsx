import { useEffect, useMemo, useState } from 'react';
import BackButton from '../components/BackButton';
import ClassAttendanceTab from '../components/ClassAttendanceTab';
import ClassAccomplishmentsTab from '../components/ClassAccomplishmentsTab';
import ClassDetailTabs, { type ClassDetailTabDef } from '../components/ClassDetailTabs';
import ClassHeaderCard from '../components/ClassHeaderCard';
import ClassOverviewTab from '../components/ClassOverviewTab';
import ClassReportsTab from '../components/ClassReportsTab';
import ClassSessionsCard from '../components/ClassSessionsCard';
import ClassStudentsCard from '../components/ClassStudentsCard';
import ClassTeachersCard from '../components/ClassTeachersCard';
import {
  BatchInvoiceReviewModal,
  ClassBillingSetup,
  CreatePaymentRequestModal,
  InvoiceReviewModal,
  LessonReconciliationWorkspace,
  nearestTeachingWeek,
  type StudentInvoice
} from '../features/payments';
import { apiMessage } from '../lib/apiClient';
import { buildClassRow, withClassAttendanceRates } from '../lib/classRows';
import { listClassStudents, type ClassApiResponse } from '../lib/classAdminApi';
import { listClassroomSessions, mapClassroomSessionApiToUi } from '../lib/classroomApi';
import { listStudents, mapStudentApiToUi } from '../lib/studentApi';
import { formatIsoDateInAuckland } from '../lib/sessionTime';
import type { Console } from '../hooks/useConsole';
import useMediaQuery from '../hooks/useMediaQuery';
import type { Session, StaffMember, Student } from '../types';

type TabKey = 'overview' | 'students' | 'sessions' | 'billing' | 'attendance' | 'accomplishments' | 'reports' | 'teachers';
type BillingView = 'register' | 'setup';

const TABS: ClassDetailTabDef<TabKey>[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'sessions', label: 'Schedule' },
  { key: 'students', label: 'Students' },
  { key: 'billing', label: 'Billing' },
  { key: 'attendance', label: 'Class Attendance' },
  { key: 'accomplishments', label: 'Achievements' },
  { key: 'reports', label: 'Reports' },
  { key: 'teachers', label: 'Teachers' }
];

interface Props {
  readonly klass: ClassApiResponse;
  readonly staff: readonly StaffMember[];
  readonly classes: readonly ClassApiResponse[];
  readonly console: Console;
  readonly onBack: () => void;
  readonly onChanged: () => void;
}

// The four cards below (header/teachers/students/sessions) each own their own section-specific
// state and are rendered with key={klass.id}, so switching to a different class remounts them
// fresh instead of needing a manual state-reset effect — the same pattern StudentProfile already
// uses for the same reason. Only the data that's either shared across cards (busy/actionError,
// since every action funnels through one runAction) or genuinely cross-card (attendanceRate is
// shown in the header but derived from the sessions the sessions card lists) stays up here.
//
// Overview/Attendance/Reports and the header's persistent stat row read from `row`, computed off
// Console's own c.sessions/c.countsForSession (already loaded for an admin caller across every
// class) — the separately-fetched `sessions` state below stays exactly as it was purely to back
// the Sessions tab's own loading/error UI, which c.sessions doesn't track per-class.
export default function ClassDetail({ klass, staff, classes, console: c, onBack, onChanged }: Props) {
  const isMobile = useMediaQuery('(max-width: 760px)');
  const [tab, setTab] = useState<TabKey>('overview');
  const [billingView, setBillingView] = useState<BillingView>('register');
  const [students, setStudents] = useState<Student[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [studentsError, setStudentsError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [creatingPaymentRequest, setCreatingPaymentRequest] = useState(false);
  const [billingRecipients, setBillingRecipients] = useState<readonly { id: string; name: string }[]>([]);
  const [batchInvoices, setBatchInvoices] = useState<StudentInvoice[]>([]);
  const [reviewingInvoice, setReviewingInvoice] = useState<{
    id: string;
    studentName: string;
    studentNumber: string;
  } | null>(null);
  const [lessonAccountsRefresh, setLessonAccountsRefresh] = useState(0);
  const [lessonNotice, setLessonNotice] = useState('');

  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState('');

  useEffect(() => {
    if (c.classDetailSection !== 'sessions') return;
    setTab('sessions');
    c.setClassDetailSection(null);
  }, [c.classDetailSection, c.setClassDetailSection]);

  const row = useMemo(
    () => buildClassRow(klass.id, c.sessions, c.countsForSession),
    [klass.id, c.sessions, c.countsForSession]
  );

  // The Overview preview uses this offering's exact roster and this offering's completed sessions.
  // This prevents a student's attendance in another course from changing the current class view.
  const enrichedRoster = useMemo(
    () => withClassAttendanceRates(students, row.classSessions, c.attendanceStatusFor),
    [students, row.classSessions, c.attendanceStatusFor]
  );

  const lessonServiceRange = useMemo(() => {
    const dates = row.classSessions
      .filter((session) => session.status !== 'Cancelled')
      .map((session) => session.date)
      .sort();
    return { from: dates[0] ?? '', to: dates[dates.length - 1] ?? '' };
  }, [row.classSessions]);

  const lessonRegisterWeek = useMemo(() => nearestTeachingWeek(
    row.classSessions
      .filter((session) => session.status !== 'Cancelled')
      .map((session) => session.date),
    formatIsoDateInAuckland(new Date())
  ), [row.classSessions]);

  const refreshStudents = () => {
    setStudentsLoading(true);
    Promise.all([listClassStudents(klass.id), listStudents()])
      .then(([classStudents, everyStudent]) => {
        setStudents(classStudents.map((student) => mapStudentApiToUi(student)));
        setAllStudents(everyStudent.map((student) => mapStudentApiToUi(student)));
        setStudentsError('');
      })
      .catch((error) => setStudentsError(apiMessage(error)))
      .finally(() => setStudentsLoading(false));
  };

  const refreshSessions = () => {
    setSessionsLoading(true);
    listClassroomSessions()
      .then((all) => {
        const mapped = all
          .filter((session) => session.courseOfferingId === klass.id)
          .map((session) => mapClassroomSessionApiToUi(session, klass.studentCount));
        setSessions(mapped);
        setSessionsError('');
      })
      .catch((error) => setSessionsError(apiMessage(error)))
      .finally(() => setSessionsLoading(false));
  };

  useEffect(refreshStudents, [klass.id]);
  useEffect(refreshSessions, [klass.id]);

  const runAction = async (action: () => Promise<unknown>) => {
    setActionError('');
    setBusy(true);
    try {
      await action();
      onChanged();
    } catch (error) {
      setActionError(apiMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const openStudent = (studentId: string) => {
    c.setProfileId(studentId);
    c.setPage('students');
  };

  const openPaymentAccount = (studentId: string) => {
    c.setPaymentAccountFocusId(studentId);
    c.setPage('payments');
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  return (
    <div className="page__inner class-detail-page">
      <BackButton label="Back to classes" onClick={onBack} className="page-action" />

      <ClassHeaderCard
        key={`${klass.id}-header`}
        klass={klass}
        busy={busy}
        runAction={runAction}
        attendanceRate={row.attendance.rate}
        completedSessionCount={row.completedSessionCount}
        nextSession={row.nextSession}
      />

      {actionError && (
        <div className="notice notice--warn">
          <span className="notice__mark" aria-hidden="true" />
          <span>{actionError}</span>
        </div>
      )}

      {lessonNotice && <output className="notice notice--success">{lessonNotice}</output>}

      <ClassDetailTabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'overview' && (
        <ClassOverviewTab
          attendance={row.attendance}
          classSessions={row.classSessions}
          nextSession={row.nextSession}
          roster={enrichedRoster}
          onViewSessions={() => setTab('sessions')}
          onViewStudents={() => setTab('students')}
          onOpenStudent={openStudent}
        />
      )}

      {tab === 'students' && (
        <ClassStudentsCard
          key={`${klass.id}-students`}
          klass={klass}
          classes={classes}
          allStudents={allStudents}
          students={students}
          studentsLoading={studentsLoading}
          studentsError={studentsError}
          busy={busy}
          runAction={runAction}
          refreshStudents={refreshStudents}
          classSessions={row.classSessions}
          attendanceStatusFor={c.attendanceStatusFor}
          onOpenStudent={openStudent}
        />
      )}

      {tab === 'sessions' && (
        <ClassSessionsCard
          key={`${klass.id}-sessions`}
          klass={klass}
          sessions={sessions}
          sessionsLoading={sessionsLoading}
          sessionsError={sessionsError}
          console={c}
          onRetry={refreshSessions}
          editable
        />
      )}

      {tab === 'billing' && (
        <div className="class-billing-workspace">
          <nav className="class-billing-nav" aria-label="Billing workspace">
            <button
              type="button"
              className={billingView === 'register' ? 'is-active' : ''}
              aria-current={billingView === 'register' ? 'page' : undefined}
              onClick={() => setBillingView('register')}
            >
              <strong>Class register</strong>
              <span>Attendance, payments and make-ups</span>
            </button>
            <button
              type="button"
              className={billingView === 'setup' ? 'is-active' : ''}
              aria-current={billingView === 'setup' ? 'page' : undefined}
              onClick={() => setBillingView('setup')}
            >
              <strong>Billing setup</strong>
              <span>Pricing and absence rules</span>
            </button>
          </nav>

          {billingView === 'setup' ? (
            <ClassBillingSetup
              key={`${klass.id}-${klass.billingPlan.purchaseMode}`}
              klass={klass}
              sessions={row.classSessions}
              onChanged={onChanged}
              onIssuePayment={() => {
                setLessonNotice('');
                setBillingRecipients([]);
                setCreatingPaymentRequest(true);
              }}
            />
          ) : (
            <LessonReconciliationWorkspace
              mobile={isMobile}
              courseOfferingId={klass.id}
              initialWeekStart={lessonRegisterWeek}
              refreshToken={lessonAccountsRefresh}
              purchaseMode={klass.billingPlan.purchaseMode}
              onOpenStudent={openStudent}
              onOpenPayment={(student) => openPaymentAccount(student.studentId)}
              onCreateInvoices={(selected) => {
                setLessonNotice('');
                setBillingRecipients(selected);
                setCreatingPaymentRequest(true);
              }}
            />
          )}
        </div>
      )}

      {tab === 'attendance' && (
        <ClassAttendanceTab
          attendance={row.attendance}
          classSessions={row.classSessions}
          countsForSession={c.countsForSession}
          attendanceRowsForSession={c.attendanceRowsForSession}
          students={allStudents}
          onOpenStudent={openStudent}
        />
      )}

      {tab === 'accomplishments' && (
        <ClassAccomplishmentsTab
          courseOfferingId={klass.id}
          classLabel={`${klass.courseCode} · ${klass.academicTerm}`}
          students={students}
          console={c}
        />
      )}

      {tab === 'reports' && (
        <ClassReportsTab
          courseOfferingId={klass.id}
          classLabel={`${klass.courseCode} · ${klass.academicTerm}`}
          console={c}
        />
      )}

      {tab === 'teachers' && (
        <ClassTeachersCard key={`${klass.id}-teachers`} klass={klass} staff={staff} busy={busy} runAction={runAction} />
      )}

      {creatingPaymentRequest && (
        <CreatePaymentRequestModal
          initialCourseOfferingId={klass.id}
          classLabel={`${klass.courseCode} · ${klass.academicTerm}`}
          initialServiceFrom={lessonServiceRange.from}
          initialServiceTo={lessonServiceRange.to}
          billingPlan={klass.billingPlan}
          sessionOptions={row.classSessions
            .filter((session) => session.status !== 'Cancelled')
            .map((session) => ({ id: session.id, date: session.date, label: `${session.dateLabel} · ${session.time}` }))}
          initialStudents={billingRecipients}
          onClose={() => {
            setCreatingPaymentRequest(false);
            setBillingRecipients([]);
          }}
          onCreated={(invoices) => {
            setCreatingPaymentRequest(false);
            setBillingRecipients([]);
            setLessonNotice(`${invoices.length} invoice draft${invoices.length === 1 ? '' : 's'} created. Review before sending.`);
            const first = invoices[0];
            if (invoices.length > 1) {
              setBatchInvoices(invoices);
            } else if (first) {
              setReviewingInvoice({
                id: first.id,
                studentName: first.studentName,
                studentNumber: first.studentNumber
              });
            }
            setLessonAccountsRefresh((value) => value + 1);
          }}
        />
      )}
      {reviewingInvoice && (
        <InvoiceReviewModal
          invoiceId={reviewingInvoice.id}
          studentName={reviewingInvoice.studentName}
          studentNumber={reviewingInvoice.studentNumber}
          onClose={() => setReviewingInvoice(null)}
          onUpdated={() => setLessonAccountsRefresh((value) => value + 1)}
        />
      )}
      {batchInvoices.length > 0 && (
        <BatchInvoiceReviewModal
          invoices={batchInvoices}
          onClose={() => setBatchInvoices([])}
          onSent={() => {
            setBatchInvoices([]);
            setLessonNotice('All selected invoices were sent. Student access will activate according to the payment rules.');
            setLessonAccountsRefresh((value) => value + 1);
          }}
        />
      )}
    </div>
  );
}
