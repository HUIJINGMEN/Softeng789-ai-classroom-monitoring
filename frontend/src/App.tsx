import { lazy, Suspense, type ReactNode } from 'react';
import { useAuth } from './hooks/useAuth';

const Landing = lazy(() => import('./pages/Landing'));
const PendingApproval = lazy(() => import('./pages/PendingApproval'));
const StudentPortal = lazy(() => import('./pages/StudentPortal'));
const TeacherApp = lazy(() => import('./pages/TeacherApp'));

export default function App() {
  const auth = useAuth();

  if (auth.restoring) {
    return <div className="app-loading">Loading your account…</div>;
  }

  let page: ReactNode;

  if (!auth.user) {
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
      page = <StudentPortal user={auth.user} onLogout={auth.logout} />;
    }
  } else {
    page = <TeacherApp user={auth.user} onLogout={auth.logout} />;
  }

  return <Suspense fallback={<div className="app-loading">Loading your workspace…</div>}>{page}</Suspense>;
}
