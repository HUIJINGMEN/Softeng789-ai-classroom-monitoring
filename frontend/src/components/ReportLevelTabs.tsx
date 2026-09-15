import { IconBarChart, IconGraduationCap, IconUsers } from './icons';

export type ReportLevel = 'overview' | 'classes' | 'students';

interface Props {
  readonly level: ReportLevel;
  readonly onChange: (level: ReportLevel) => void;
}

const items: Array<{
  level: ReportLevel;
  label: string;
  icon: typeof IconBarChart;
}> = [
  { level: 'overview', label: 'Overview', icon: IconBarChart },
  { level: 'classes', label: 'Classes', icon: IconGraduationCap },
  { level: 'students', label: 'Students', icon: IconUsers }
];

export default function ReportLevelTabs({ level, onChange }: Props) {
  return (
    <div className="report-view-navigation">
      <nav className="report-level-tabs" aria-label="Report view">
        {items.map((item) => {
          const Icon = item.icon;
          const active = level === item.level;

          return (
            <button
              key={item.level}
              type="button"
              aria-current={active ? 'page' : undefined}
              className={active ? 'report-level-tab report-level-tab--active' : 'report-level-tab'}
              onClick={() => onChange(item.level)}
            >
              <Icon />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
