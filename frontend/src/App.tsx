import { useAuth } from './hooks/useAuth';
import Landing from './pages/Landing';
import StudentPortal from './pages/StudentPortal';
import TeacherApp from './pages/TeacherApp';

export default function App() {
  const auth = useAuth();

  if (auth.restoring) {
    return <div className="app-loading">Loading your account…</div>;
  }

  if (!auth.user) {
    return <Landing auth={auth} />;
  }

  if (auth.user.role === 'student') {
    return <StudentPortal user={auth.user} onLogout={auth.logout} />;
  }

  return <TeacherApp user={auth.user} onLogout={auth.logout} />;
}
