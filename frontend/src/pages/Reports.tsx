import type { ReportLevel } from '../components/ReportLevelTabs';
import ReportsDesktopView from '../features/reports/ReportsDesktopView';
import ReportsMobileView from '../features/reports/ReportsMobileView';
import { useReportsWorkspace } from '../features/reports/useReportsWorkspace';
import useMediaQuery from '../hooks/useMediaQuery';
import type { Console } from '../hooks/useConsole';

interface Props {
  readonly console: Console;
  readonly isAdmin: boolean;
  readonly level: ReportLevel;
  readonly onLevelChange: (level: ReportLevel) => void;
}

/** Route-level coordinator. Data ownership lives in useReportsWorkspace and each breakpoint has a
 * focused presentation component, while both continue to consume the exact same derived model. */
export default function Reports({ console, isAdmin, level, onLevelChange }: Props) {
  const isMobile = useMediaQuery('(max-width: 760px)');
  const workspace = useReportsWorkspace({ console, isAdmin, level });

  if (isMobile) {
    return (
      <ReportsMobileView
        console={console}
        isAdmin={isAdmin}
        level={level}
        onLevelChange={onLevelChange}
        workspace={workspace}
      />
    );
  }

  return (
    <ReportsDesktopView
      console={console}
      isAdmin={isAdmin}
      level={level}
      workspace={workspace}
    />
  );
}
