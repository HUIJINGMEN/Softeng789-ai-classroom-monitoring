import {
  IconBarChart,
  IconClipboardCheck,
  IconStudentReport,
  IconUsers
} from '../../../components/icons';
import {
  ADMIN_PAYMENT_WORKSPACES,
  type AdminPaymentWorkspace
} from '../admin/adminPaymentWorkspace';

interface Props {
  readonly current: AdminPaymentWorkspace;
  readonly onChange: (workspace: AdminPaymentWorkspace) => void;
}

const WORKSPACE_ICONS = {
  students: IconUsers,
  invoices: IconStudentReport,
  reviews: IconClipboardCheck,
  overview: IconBarChart
} satisfies Record<AdminPaymentWorkspace, () => JSX.Element>;

export default function AdminPaymentWorkspaceTabs({ current, onChange }: Props) {
  return (
    <nav className="payment-workspace-tabs" aria-label="Payments workspace">
      {ADMIN_PAYMENT_WORKSPACES.map((workspace) => {
        const WorkspaceIcon = WORKSPACE_ICONS[workspace.value];
        const active = current === workspace.value;
        return (
          <button
            type="button"
            key={workspace.value}
            className={active ? 'is-active' : ''}
            aria-current={active ? 'page' : undefined}
            onClick={() => onChange(workspace.value)}
          >
            <span className="payment-workspace-tabs__icon" aria-hidden="true">
              <WorkspaceIcon />
            </span>
            <span className="payment-workspace-tabs__copy">
              <strong>{workspace.label}</strong>
              <small>{workspace.description}</small>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
