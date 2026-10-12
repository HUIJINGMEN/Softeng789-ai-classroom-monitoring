import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/theme.css';
// Keep large feature families separate while preserving their original cascade order. These
// files were mechanically extracted from theme.css, so this is an organisational change only.
import './styles/directories-analytics.css';
import './styles/reporting-monitoring.css';
import './styles/registration-settings.css';
import './styles/console-workspaces.css';
import './styles/accomplishments.css';
import './styles/print.css';
// Order matters: these extend/override selectors already defined in theme.css (e.g. the
// auth-card responsive rules), so they must load after it to preserve the original cascade.
import './styles/auth.css';
import './styles/landing.css';
import './styles/student-portal.css';
import './styles/student-desktop.css';
import './styles/student-mobile.css';
import './styles/student-schedule.css';
import './styles/payments.css';
import './styles/payments-student.css';
import './styles/payments-admin-directory.css';
import './styles/payments-invoice-flow.css';
import './styles/payments-mobile.css';
import './styles/payments-requests.css';
import './styles/payments-manual.css';
import './styles/payments-admin-workspaces.css';
import './styles/mobile-teacher.css';
import './styles/mobile-teacher-directories.css';
import './styles/mobile-teacher-flows.css';
import './styles/mobile-reports.css';
import './styles/mobile-admin.css';
// Payments overview has its own information hierarchy and loads last so legacy feature
// overrides cannot flatten its primary balance, action queue and reporting period again.
import './styles/payments-overview.css';
import './styles/student-support.css';
import './styles/student-overview.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
