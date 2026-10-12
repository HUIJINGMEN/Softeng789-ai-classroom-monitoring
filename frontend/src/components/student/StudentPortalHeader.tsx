import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { avatarTone, initials } from '../../lib/format';
import type { AuthUser, Student } from '../../types';
import BrandMark, { BRAND_NAME } from '../BrandMark';
import ThemeToggleButton from '../ThemeToggleButton';
import { IconAward, IconBarChart, IconCalendar, IconChevronDown, IconClipboardCheck, IconHome, IconMessageSquare, IconWallet } from '../icons';
import { STUDENT_VIEW_LABELS, type StudentView } from './studentPortalTypes';

interface Props {
  readonly user: AuthUser;
  readonly profile: Student | null;
  readonly view: StudentView;
  readonly feedbackCount: number;
  readonly accomplishmentCount: number;
  readonly reportCount: number;
  readonly amountDue: number;
  readonly onContactSchool: () => void;
  readonly onOpenView: (view: StudentView) => void;
  readonly onLogout: () => void;
}

interface NavigationItem {
  readonly view: StudentView;
  readonly icon: ReactNode;
  readonly count?: number;
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
  amountDue,
  onContactSchool,
  onOpenView,
  onLogout
}: Props) {
  const { theme, setTheme } = useTheme();
  const displayName = profile?.name ?? user.name;
  const [progressOpen, setProgressOpen] = useState(false);
  const progressMenuRef = useRef<HTMLDivElement | null>(null);
  const progressButtonRef = useRef<HTMLButtonElement | null>(null);
  const navigation: NavigationItem[] = [
    { view: 'overview', icon: <IconHome /> },
    { view: 'schedule', icon: <IconCalendar /> },
    { view: 'attendance', icon: <IconClipboardCheck /> },
    { view: 'payments', icon: <IconWallet />, count: amountDue > 0 ? 1 : undefined }
  ];
  const progressNavigation: NavigationItem[] = [
    { view: 'feedback', icon: <IconMessageSquare />, count: feedbackCount },
    { view: 'accomplishments', icon: <IconAward />, count: accomplishmentCount },
    { view: 'reports', icon: <IconBarChart />, count: reportCount }
  ];
  const progressActive = progressNavigation.some((item) => item.view === view);

  useEffect(() => {
    if (!progressOpen) return undefined;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!progressMenuRef.current?.contains(event.target as Node)) setProgressOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setProgressOpen(false);
      progressButtonRef.current?.focus();
    };
    document.addEventListener('pointerdown', closeOnPointerDown);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [progressOpen]);

  return (
    <header className="student-portal__top">
      <div className="student-brand" aria-label={`${BRAND_NAME} Student Portal`}>
        <span className="student-brand__mark" aria-hidden="true"><BrandMark /></span>
        <span>
          <strong>{BRAND_NAME}</strong>
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
              <span className="student-nav__label">{STUDENT_VIEW_LABELS[item.view]}</span>
              {Boolean(item.count) && <span className="student-nav__count">{countLabel(item.count ?? 0)}</span>}
            </button>
          );
        })}
        <div className="student-nav__group" ref={progressMenuRef}>
          <button
            ref={progressButtonRef}
            type="button"
            className={`student-nav__item student-nav__progress${progressActive ? ' student-nav__item--active' : ''}`}
            aria-haspopup="menu"
            aria-expanded={progressOpen}
            aria-current={progressActive ? 'page' : undefined}
            onClick={() => setProgressOpen((open) => !open)}
          >
            <IconBarChart />
            <span className="student-nav__label">Progress</span>
            <IconChevronDown />
          </button>

          {progressOpen && (
            <div className="student-nav__menu" role="menu" aria-label="Progress pages">
              {progressNavigation.map((item) => {
                const active = view === item.view;
                return (
                  <button
                    type="button"
                    role="menuitem"
                    className={active ? 'is-active' : ''}
                    onClick={() => {
                      setProgressOpen(false);
                      onOpenView(item.view);
                    }}
                    key={item.view}
                  >
                    <span className="student-nav__menu-icon">{item.icon}</span>
                    <span><strong>{STUDENT_VIEW_LABELS[item.view]}</strong><small>{item.view === 'feedback' ? 'Teacher notes' : item.view === 'accomplishments' ? 'Awards and milestones' : 'Published summaries'}</small></span>
                    {Boolean(item.count) && <span className="student-nav__menu-count">{countLabel(item.count ?? 0)}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      <div className="student-account">
        <button type="button" className="btn btn--quiet btn--sm student-contact-school" aria-label="Contact school" onClick={onContactSchool}>
          <IconMessageSquare />
          <span>Contact school</span>
        </button>
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
