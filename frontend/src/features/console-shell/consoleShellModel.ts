import type { ReportLevel } from '../../components/ReportLevelTabs';
import type { Page } from '../../types';

export function consoleAppClassName(page: Page, isAdmin: boolean, reportLevel: ReportLevel): string {
  const reportWorkspace =
    page === 'reports' && (reportLevel === 'students' || (isAdmin && reportLevel === 'overview'));
  return [
    'app',
    'app--mobile-console',
    isAdmin ? 'app--admin' : 'app--teacher',
    reportWorkspace && 'app--report-workspace'
  ]
    .filter(Boolean)
    .join(' ');
}
