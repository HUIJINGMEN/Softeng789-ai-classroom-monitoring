import { IconActivity, IconGraduationCap, IconMonitor, IconUser, IconUsers } from './icons';
import DashboardStatsGrid, { type DashboardStatItem } from './DashboardStatsGrid';
import { useCountUp } from '../hooks/useCountUp';

interface Props {
  readonly activeClassesCount: number;
  readonly archivedClassesCount: number;
  readonly totalClassesCount: number;
  readonly totalStudents: number;
  readonly teacherCount: number;
  readonly activeSessionsCount: number;
  readonly pendingAiEvents: number;
  readonly onOpenActiveSession?: () => void;
  readonly onOpenClasses: () => void;
  readonly onOpenStudents: () => void;
  readonly onOpenStaff: () => void;
  readonly onOpenEvents: () => void;
}

export default function AdminStatsRow({
  activeClassesCount,
  archivedClassesCount,
  totalClassesCount,
  totalStudents,
  teacherCount,
  activeSessionsCount,
  pendingAiEvents,
  onOpenActiveSession,
  onOpenClasses,
  onOpenStudents,
  onOpenStaff,
  onOpenEvents
}: Props) {
  const classesCount = useCountUp(activeClassesCount);
  const studentsCount = useCountUp(totalStudents);
  const teachersCount = useCountUp(teacherCount);
  const sessionsCount = useCountUp(activeSessionsCount);
  const pendingEventsCount = useCountUp(pendingAiEvents);

  const stats: DashboardStatItem[] = [
    {
      label: 'Classes',
      value: String(classesCount),
      detail:
        (archivedClassesCount > 0
          ? `${activeClassesCount} active · ${archivedClassesCount} archived`
          : `${activeClassesCount} active`),
      icon: <IconGraduationCap />,
      tone: 'accent',
      onClick: onOpenClasses
    },
    {
      label: 'Students',
      value: String(studentsCount),
      detail: `Across ${totalClassesCount} class${totalClassesCount === 1 ? '' : 'es'}`,
      icon: <IconUsers />,
      tone: 'accent',
      onClick: onOpenStudents
    },
    {
      label: 'Teachers',
      value: String(teachersCount),
      detail: `${teacherCount} teaching staff`,
      icon: <IconUser />,
      tone: 'accent',
      onClick: onOpenStaff
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

  return <DashboardStatsGrid stats={stats} compact />;
}
