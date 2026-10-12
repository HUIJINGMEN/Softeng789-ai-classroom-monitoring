import { IconCalendar, IconUsers } from '../../components/icons';

export type StudentWorkspace = 'status' | 'directory';

interface Props {
  readonly current: StudentWorkspace;
  readonly onChange: (workspace: StudentWorkspace) => void;
}

const WORKSPACES = [
  {
    value: 'status' as const,
    label: 'Overview table',
    description: 'Open the full-width register',
    icon: <IconCalendar />
  },
  {
    value: 'directory' as const,
    label: 'Student directory',
    description: 'Profiles and enrolments',
    icon: <IconUsers />
  }
];

export default function StudentWorkspaceTabs({ current, onChange }: Props) {
  return (
    <nav className="student-workspace-tabs" aria-label="Students workspace">
      {WORKSPACES.map((workspace) => (
        <button
          type="button"
          key={workspace.value}
          className={current === workspace.value ? 'is-active' : ''}
          aria-current={current === workspace.value ? 'page' : undefined}
          onClick={() => onChange(workspace.value)}
        >
          <span className="student-workspace-tabs__icon" aria-hidden="true">{workspace.icon}</span>
          <span>
            <strong>{workspace.label}</strong>
            <small>{workspace.description}</small>
          </span>
        </button>
      ))}
    </nav>
  );
}
