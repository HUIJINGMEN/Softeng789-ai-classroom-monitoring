import { IconActivity, IconGraduationCap, IconMonitor, IconUser, IconUsers } from './icons';
import { useCountUp } from '../hooks/useCountUp';

interface Props {
  readonly activeClassesCount: number;
  readonly archivedClassesCount: number;
  readonly totalClassesCount: number;
  readonly totalStudents: number;
  readonly teacherCount: number;
  readonly activeSessionsCount: number;
  readonly aiEventsToday: number;
  readonly onOpenActiveSession?: () => void;
}

export default function AdminStatsRow({
  activeClassesCount,
  archivedClassesCount,
  totalClassesCount,
  totalStudents,
  teacherCount,
  activeSessionsCount,
  aiEventsToday,
  onOpenActiveSession
}: Props) {
  const classesCount = useCountUp(activeClassesCount);
  const studentsCount = useCountUp(totalStudents);
  const teachersCount = useCountUp(teacherCount);
  const sessionsCount = useCountUp(activeSessionsCount);
  const eventsTodayCount = useCountUp(aiEventsToday);

  const stats = [
    {
      label: 'Classes',
      value: String(classesCount),
      delta:
        archivedClassesCount > 0
          ? `${activeClassesCount} active · ${archivedClassesCount} archived`
          : `${activeClassesCount} active`,
      icon: <IconGraduationCap />
    },
    {
      label: 'Students',
      value: String(studentsCount),
      delta: `Across ${totalClassesCount} class${totalClassesCount === 1 ? '' : 'es'}`,
      icon: <IconUsers />
    },
    {
      label: 'Teachers',
      value: String(teachersCount),
      delta: `${teacherCount} teaching staff`,
      icon: <IconUser />
    },
    {
      label: 'Active sessions',
      value: String(sessionsCount),
      delta:
        activeSessionsCount > 0 ? `${activeSessionsCount} running now →` : 'None running right now',
      icon: <IconMonitor />,
      onClick: activeSessionsCount > 0 ? onOpenActiveSession : undefined
    },
    {
      label: 'AI Events Today',
      value: String(eventsTodayCount),
      delta: aiEventsToday > 0 ? `${aiEventsToday} detected today` : 'No events today',
      icon: <IconActivity />
    }
  ];

  return (
    <div className="stat-grid stat-grid--admin">
      {stats.map((stat, index) => {
        const body = (
          <>
            <div className="stat__head">
              <span className="icon-inline" aria-hidden="true">
                {stat.icon}
              </span>
              <span className="stat__label">{stat.label}</span>
            </div>
            <div className="stat__value">{stat.value}</div>
            <div className="stat__delta stat__delta--muted">{stat.delta}</div>
          </>
        );
        const className = `stat dashboard-enter stagger-${index}`;
        return stat.onClick ? (
          <button key={stat.label} type="button" className={className} onClick={stat.onClick}>
            {body}
          </button>
        ) : (
          <div key={stat.label} className={className}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
