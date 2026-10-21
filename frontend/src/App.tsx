import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { parseAccountLinkHash } from './features/account-access/accountLinkModel';
import { useAuth } from './hooks/useAuth';
import SessionNotice from './components/SessionNotice';

const Landing = lazy(() => import('./pages/Landing'));
const PendingApproval = lazy(() => import('./pages/PendingApproval'));
const StudentPortal = lazy(() => import('./pages/StudentPortal'));
const StudentOverviewPage = lazy(() => import('./pages/StudentOverviewPage'));
const TeacherApp = lazy(() => import('./pages/TeacherApp'));
const AccountAccessPage = lazy(() => import('./pages/AccountAccessPage'));

export default function App() {
  const auth = useAuth();
  const [accountLink] = useState(() => parseAccountLinkHash(window.location.hash));
  useEffect(() => {
    if (accountLink !== null) window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }, [accountLink]);
  const standaloneStudentOverview = /^\/student-overview\/*$/.test(window.location.pathname);

  if (auth.restoring) {
    return <div className="app-loading">Loading your account…</div>;
  }

  let page: ReactNode;

  if (accountLink !== null) {
    page = <AccountAccessPage token={accountLink} auth={auth} />;
  } else if (!auth.user) {
    page = <Landing auth={auth} />;
  } else if (auth.user.role === 'student') {
    if (auth.user.approvalStatus !== 'APPROVED') {
      page = (
        <PendingApproval
          user={auth.user}
          status={auth.user.approvalStatus}
          onLogout={auth.logout}
        />
      );
    } else {
      page = <StudentPortal key={auth.user.id} user={auth.user} onLogout={auth.logout} />;
    }
  } else if (standaloneStudentOverview) {
    page = <StudentOverviewPage user={auth.user} onLogout={auth.logout} />;
  } else {
    page = <TeacherApp key={auth.user.id} user={auth.user} onLogout={auth.logout} />;
  }

  return <>
    {auth.user && <SessionNotice message={auth.error} busy={auth.busy} onRetry={() => void auth.logout()} />}
    <Suspense fallback={<div className="app-loading">Loading your workspace…</div>}>{page}</Suspense>
  </>;
}
