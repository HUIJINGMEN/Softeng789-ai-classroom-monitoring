import { useEffect } from 'react';
import BrandMark, { BRAND_NAME } from '../components/BrandMark';
import ThemeToggleButton from '../components/ThemeToggleButton';
import { IconChevronLeft } from '../components/icons';
import { StudentOverviewWorkspace } from '../features/student-overview';
import useMediaQuery from '../hooks/useMediaQuery';
import { useTheme } from '../hooks/useTheme';
import { initials } from '../lib/format';
import type { AuthUser } from '../types';

interface Props {
  readonly user: AuthUser;
  readonly onLogout: () => void;
}

function openConsoleRecord(page: 'students' | 'payments', studentId: string) {
  const target = `/?page=${page}&student=${encodeURIComponent(studentId)}`;
  window.open(target, '_blank', 'noopener,noreferrer');
}

export default function StudentOverviewPage({ user, onLogout }: Props) {
  const isMobile = useMediaQuery('(max-width: 760px)');
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `Student status table · ${BRAND_NAME}`;
    return () => { document.title = previousTitle; };
  }, []);

  return (
    <div className="student-overview-page">
      <a className="skip-link" href="#student-overview-content">Skip to student table</a>
      <header className="student-overview-page__bar">
        <div className="student-overview-page__brand">
          <BrandMark />
          <span>
            <strong>{BRAND_NAME}</strong>
            <small>Student status register</small>
          </span>
        </div>

        <a className="student-overview-page__back" href="/?page=students">
          <IconChevronLeft />
          <span>Back to Students</span>
        </a>

        <div className="student-overview-page__account">
          <ThemeToggleButton
            theme={theme}
            onToggle={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          />
          <span className="student-overview-page__avatar" aria-hidden="true">{initials(user.name)}</span>
          <span className="student-overview-page__user">{user.name}</span>
          <button type="button" className="btn btn--quiet btn--sm" onClick={onLogout}>Sign out</button>
        </div>
      </header>

      <main id="student-overview-content" className="student-overview-page__main" tabIndex={-1}>
        {user.role === 'admin' ? (
          <StudentOverviewWorkspace
            mobile={isMobile}
            onOpenStudent={(studentId) => openConsoleRecord('students', studentId)}
            onOpenPayment={(student) => openConsoleRecord('payments', student.studentId)}
          />
        ) : (
          <section className="student-overview-page__denied">
            <h1>Admin access required</h1>
            <p>This institution-wide attendance and payment table is available to administrators.</p>
            <a className="btn btn--primary" href="/">Return to the console</a>
          </section>
        )}
      </main>
    </div>
  );
}
