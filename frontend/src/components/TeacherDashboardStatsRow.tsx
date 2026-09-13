import { IconActivity, IconGraduationCap, IconMonitor, IconUsers } from './icons';
import DashboardStatsGrid, { type DashboardStatItem } from './DashboardStatsGrid';
import { useCountUp } from '../hooks/useCountUp';

interface Props {
  readonly myClassesCount: number;
  readonly totalStudents: number;
  readonly activeSessionsCount: number;
  readonly pendingAiEvents: number;
  readonly onOpenActiveSession?: () => void;
  readonly onOpenStudents: () => void;
  readonly onOpenClasses: () => void;
  readonly onOpenEvents: () => void;
}

export default function TeacherDashboardStatsRow({
  myClassesCount,
  totalStudents,
  activeSessionsCount,
  pendingAiEvents,
  onOpenActiveSession,
  onOpenStudents,
  onOpenClasses,
  onOpenEvents
}: Props) {
  const classesCount = useCountUp(myClassesCount);
  const studentsCount = useCountUp(totalStudents);
  const sessionsCount = useCountUp(activeSessionsCount);
  const pendingEventsCount = useCountUp(pendingAiEvents);

  const stats: DashboardStatItem[] = [
    {
      label: 'My classes',
      value: String(classesCount),
      detail: `${myClassesCount} class${myClassesCount === 1 ? '' : 'es'} you teach`,
      icon: <IconGraduationCap />,
      tone: 'accent',
      onClick: onOpenClasses
    },
    {
      label: 'My students',
      value: String(studentsCount),
      detail: `Across ${myClassesCount} class${myClassesCount === 1 ? '' : 'es'}`,
      icon: <IconUsers />,
      tone: 'accent',
      onClick: onOpenStudents
    },
    {
      label: 'Active sessions',
      value: String(sessionsCount),
      detail:
        activeSessionsCount > 0 ? `${activeSessionsCount} running now` : 'None running right now',
      icon: <IconMonitor />,
        tone: 'success',
      onClick: activeSessionsCount > 0 ? onOpenActiveSession : undefined
    },
    {
      label: 'AI Reviews',
      value: String(pendingEventsCount),
      detail: pendingAiEvents > 0 ? `${pendingAiEvents} awaiting review` : 'Review queue is clear',
      icon: <IconActivity />,
        tone: 'attention',
      onClick: onOpenEvents
    }
  ];

  return <DashboardStatsGrid stats={stats} />;
}
