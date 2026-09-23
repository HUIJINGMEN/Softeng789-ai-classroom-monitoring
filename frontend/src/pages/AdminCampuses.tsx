import CampusDirectoryPanel from '../features/campuses/CampusDirectoryPanel';
import CampusManagementDialogs from '../features/campuses/CampusManagementDialogs';
import CampusRoomsPanel from '../features/campuses/CampusRoomsPanel';
import { useCampusManagement } from '../features/campuses/useCampusManagement';
import type { Console } from '../hooks/useConsole';

interface Props {
  readonly console: Console;
}

/** Route-level coordinator for campus administration. */
export default function AdminCampuses({ console }: Props) {
  const workspace = useCampusManagement(console);

  return (
    <div className="page__inner">
      {workspace.listError && (
        <div className="notice notice--warn">
          <span className="notice__mark" aria-hidden="true" />
          <span>{workspace.listError}</span>
          <span className="spacer" />
          <button type="button" className="btn btn--sm" onClick={() => void workspace.refresh()}>
            Retry
          </button>
        </div>
      )}

      <div className="campus-management">
        <CampusDirectoryPanel workspace={workspace} />
        <CampusRoomsPanel workspace={workspace} />
      </div>

      <CampusManagementDialogs workspace={workspace} />
    </div>
  );
}
