import type { ReactNode } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { avatarTone, initials } from '../../lib/format';
import type { AuthUser, Student } from '../../types';
import ThemeToggleButton from '../ThemeToggleButton';
import { IconAward, IconBarChart, IconClipboardCheck, IconHome, IconMessageSquare } from '../icons';
import { STUDENT_VIEW_LABELS, type StudentView } from './studentPortalTypes';

interface Props {
  readonly user: AuthUser;
  readonly profile: Student | null;
  readonly view: StudentView;
  readonly feedbackCount: number;
  readonly accomplishmentCount: number;
  readonly reportCount: number;
  readonly onOpenView: (view: StudentView) => void;
  readonly onLogout: () => void;
}

interface NavigationItem {
  readonly view: StudentView;
  readonly icon: ReactNode;
  readonly count?: number;
  readonly compactLabel?: string;
}

function countLabel(count: number) {
  return count > 99 ? '99+' : String(count);
}

export default function StudentPortalHeader({
  user,
  profile,
  view,
  feedbackCount,
  accomplishmentCount,
  reportCount,
  onOpenView,
  onLogout
}: Props) {
  const { theme, setTheme } = useTheme();
  const displayName = profile?.name ?? user.name;
  const navigation: NavigationItem[] = [
    { view: 'overview', icon: <IconHome /> },
    { view: 'attendance', icon: <IconClipboardCheck /> },
    { view: 'feedback', icon: <IconMessageSquare />, count: feedbackCount },
    {
      view: 'accomplishments',
      icon: <IconAward />,
      count: accomplishmentCount,
      compactLabel: 'Achievements'
    },
    { view: 'reports', icon: <IconBarChart />, count: reportCount }
  ];

  return (
    <header className="student-portal__top">
      <div className="student-brand" aria-label="ClassroomIQ Student Portal">
        <span className="student-brand__mark" aria-hidden="true">CM</span>
        <span>
          <strong>ClassroomIQ</strong>
          <small>Student Portal</small>
        </span>
      </div>

      <nav className="student-nav" aria-label="Student portal">
        {navigation.map((item) => {
          const active = view === item.view;
          return (
            <button
              type="button"
              className={`student-nav__item${active ? ' student-nav__item--active' : ''}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => onOpenView(item.view)}
              key={item.view}
            >
              {item.icon}
              <span
                className={item.compactLabel ? 'student-nav__label student-nav__label--compact' : 'student-nav__label'}
                data-compact-label={item.compactLabel}
              >
                {STUDENT_VIEW_LABELS[item.view]}
              </span>
              {Boolean(item.count) && <span className="student-nav__count">{countLabel(item.count ?? 0)}</span>}
            </button>
          );
        })}
      </nav>

      <div className="student-account">
        <ThemeToggleButton
          theme={theme}
          onToggle={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        />
        <div className={`person__avatar ${avatarTone(user.id, 0)}`} aria-hidden="true">
          {initials(displayName)}
        </div>
        <div className="student-account__copy">
          <strong>{displayName}</strong>
          <span>{profile?.studentNumber ?? 'Student'}</span>
        </div>
        <button type="button" className="btn btn--quiet btn--sm" onClick={onLogout}>
          Sign out
        </button>
      </div>
    </header>
  );
}
