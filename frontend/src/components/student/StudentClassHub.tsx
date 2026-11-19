import { StudentCheckInPanel } from '../../features/photo-attendance';
import type { StudentSchedule } from '../../lib/studentPortalApi';
import type { StudentView } from './studentPortalTypes';
import '../../styles/student-class-hub.css';

export default function StudentClassHub({ studentId, schedule, onOpenView }: {
  studentId: string;
  schedule: StudentSchedule | null;
  onOpenView: (view: StudentView) => void;
}) {
  return <section className="student-class-hub" aria-label="Class and attendance shortcuts">
    <header className="student-class-hub__heading">
      <div><h1>Your class day</h1><p>Check your attendance. Open Camera &amp; activity for face visibility, movement and observation history.</p></div>
      <div className="student-class-hub__actions">
        <button className="btn btn--primary" type="button" onClick={() => onOpenView('camera')}>Open camera &amp; activity</button>
        <button className="btn" type="button" onClick={() => onOpenView('schedule')}>Full schedule</button>
      </div>
    </header>
    <StudentCheckInPanel key={studentId} studentId={studentId} schedule={schedule} onOpenProfile={() => onOpenView('profile')} />
  </section>;
}
