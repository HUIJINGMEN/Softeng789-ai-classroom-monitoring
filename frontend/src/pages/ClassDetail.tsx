import { useEffect, useMemo, useState } from 'react';
import ClassHeaderCard from '../components/ClassHeaderCard';
import ClassSessionsCard from '../components/ClassSessionsCard';
import ClassStudentsCard from '../components/ClassStudentsCard';
import ClassTeachersCard from '../components/ClassTeachersCard';
import { apiMessage } from '../lib/apiClient';
import { listClassStudents, type ClassApiResponse } from '../lib/classAdminApi';
import { listClassroomSessions, mapClassroomSessionApiToUi } from '../lib/classroomApi';
import { listStudents, mapStudentApiToUi } from '../lib/studentApi';
import type { Console } from '../hooks/useConsole';
import type { Session, StaffMember, Student } from '../types';

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
export default function ClassDetail({ klass, staff, classes, console: c, onBack, onChanged }: Props) {
  const [students, setStudents] = useState<Student[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [studentsError, setStudentsError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState('');

  // Reuses the same present/late/total rule the Attendance and Reports pages already apply via
  // c.countsForSession — the console prefetches attendance for every session in the system, so
  // this class's own sessions (a subset of the same global list) are already cached there.
  const attendanceRate = useMemo(() => {
    const totals = sessions.reduce(
      (acc, session) => {
        const counts = c.countsForSession(session.id);
        return { present: acc.present + counts.present, late: acc.late + counts.late, total: acc.total + counts.total };
      },
      { present: 0, late: 0, total: 0 }
    );
    return totals.total === 0 ? null : Math.round(((totals.present + totals.late) / totals.total) * 100);
  }, [sessions, c]);

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

  return (
    <div className="page__inner">
      <button type="button" className="btn page-action" onClick={onBack}>
        ← Back to all classes
      </button>

      <ClassHeaderCard key={`${klass.id}-header`} klass={klass} busy={busy} runAction={runAction} attendanceRate={attendanceRate} />

      {actionError && (
        <div className="notice notice--warn">
          <span className="notice__mark" aria-hidden="true" />
          <span>{actionError}</span>
        </div>
      )}

      <div className="grid-2">
        <ClassTeachersCard key={`${klass.id}-teachers`} klass={klass} staff={staff} busy={busy} runAction={runAction} />
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
        />
      </div>

      <ClassSessionsCard
        key={`${klass.id}-sessions`}
        sessions={sessions}
        sessionsLoading={sessionsLoading}
        sessionsError={sessionsError}
        console={c}
      />
    </div>
  );
}
