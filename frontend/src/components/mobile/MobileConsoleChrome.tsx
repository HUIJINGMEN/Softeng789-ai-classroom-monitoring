import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import type { NavEntry } from '../Sidebar';
import type { Page, Theme } from '../../types';

interface Props {
  readonly role: 'teacher' | 'admin';
  readonly current: Page;
  readonly title: string;
  readonly userName: string;
  readonly userInitials: string;
  readonly theme: Theme;
  readonly entries: readonly NavEntry[];
  readonly onNavigate: (page: Page) => void;
  readonly onCapture?: (file: File) => void;
  readonly onToggleTheme: () => void;
  readonly onLogout: () => void;
}

function LineIcon({ children }: { readonly children: ReactNode }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">{children}</svg>;
}

function CloseIcon() {
  return <LineIcon><path d="m6 6 12 12M18 6 6 18" /></LineIcon>;
}

const navItems: Record<'dashboard' | 'classes' | 'students' | 'reports', { page: Page; label: string; icon: ReactNode }> = {
  dashboard: {
    page: 'dashboard', label: 'Home',
    icon: <LineIcon><path d="M4 10.5 12 4l8 6.5V20h-6v-6h-4v6H4Z" /></LineIcon>
  },
  classes: {
    page: 'classes', label: 'Classes',
    icon: <LineIcon><path d="m3 9 9-5 9 5-9 5Z" /><path d="M6.5 11.2V17c2.8 2.2 8.2 2.2 11 0v-5.8" /></LineIcon>
  },
  students: {
    page: 'students', label: 'Students',
    icon: <LineIcon><circle cx="9" cy="8" r="3" /><path d="M3 20c0-4 2.5-6.5 6-6.5s6 2.5 6 6.5" /><path d="M16 6.5a3 3 0 0 1 0 5.8M17 14c2.5.7 4 2.7 4 6" /></LineIcon>
  },
  reports: {
    page: 'reports', label: 'Reports',
    icon: <LineIcon><path d="M5 20V10M12 20V4M19 20v-7" /><path d="M3 20h18" /></LineIcon>
  }
};

const ADMIN_MORE_GROUPS: readonly { label: string; pages: readonly Page[] }[] = [
  { label: 'People & access', pages: ['achievements', 'staff', 'registrations'] },
  { label: 'Operations', pages: ['campuses', 'live', 'attendance'] },
  { label: 'Review queues', pages: ['events', 'health-alerts'] },
  { label: 'System', pages: ['settings'] }
];

const TEACHER_MORE_GROUPS: readonly { label: string; pages: readonly Page[] }[] = [
  { label: 'Teaching', pages: ['live', 'attendance', 'achievements'] },
  { label: 'Review & reports', pages: ['events', 'health-alerts', 'reports'] },
  { label: 'System', pages: ['settings'] }
];

function ChevronIcon() {
  return <LineIcon><path d="m9 6 6 6-6 6" /></LineIcon>;
}

function AppearanceIcon() {
  return <LineIcon><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></LineIcon>;
}

function SignOutIcon() {
  return <LineIcon><path d="M10 4H5v16h5M14 8l4 4-4 4M9 12h9" /></LineIcon>;
}

export default function MobileConsoleChrome(props: Props) {
  const [moreOpen, setMoreOpen] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const moreCloseRef = useRef<HTMLButtonElement>(null);
  const isAdmin = props.role === 'admin';
  const primaryPages: Page[] = isAdmin
    ? ['dashboard', 'classes', 'students', 'reports']
    : ['dashboard', 'classes', 'students'];
  const morePages = props.entries.filter((entry) => !primaryPages.includes(entry.page));
  const moreActive = morePages.some((entry) => entry.page === props.current);
  const groupDefinitions = isAdmin ? ADMIN_MORE_GROUPS : TEACHER_MORE_GROUPS;
  const assignedPages = new Set(groupDefinitions.flatMap((group) => group.pages));
  const moreGroups = groupDefinitions
    .map((group) => ({
      label: group.label,
      entries: morePages.filter((entry) => group.pages.includes(entry.page))
    }))
    .filter((group) => group.entries.length > 0);
  const ungroupedEntries = morePages.filter((entry) => !assignedPages.has(entry.page));
  if (ungroupedEntries.length > 0) moreGroups.push({ label: 'More', entries: ungroupedEntries });

  useEffect(() => {
    if (!moreOpen) return undefined;
    const focusTimer = window.setTimeout(() => moreCloseRef.current?.focus(), 0);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      moreButtonRef.current?.focus();
    };
  }, [moreOpen]);

  const takePhoto = () => cameraRef.current?.click();
  const captureChanged = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) props.onCapture?.(file);
  };
  const navigate = (page: Page) => {
    props.onNavigate(page);
    setMoreOpen(false);
  };

  return (
    <>
      <header className="teacher-mobile-header">
        <div className="teacher-mobile-header__brand" aria-hidden="true">CM</div>
        <div className="teacher-mobile-header__copy">
          <span>{isAdmin ? 'Admin Console' : 'Teacher Console'}</span>
          <strong>{props.title}</strong>
        </div>
        <button
          className="teacher-mobile-header__profile"
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-label="Open account and navigation menu"
          aria-expanded={moreOpen}
          aria-controls="mobile-more-sheet"
        >
          {props.userInitials}
        </button>
      </header>

      <nav className={`teacher-mobile-nav${isAdmin ? ' teacher-mobile-nav--admin' : ''}`} aria-label="Primary navigation">
        {(isAdmin
          ? [navItems.dashboard, navItems.classes, navItems.students, navItems.reports]
          : [navItems.dashboard, navItems.classes]
        ).map((item) => (
          <button
            key={item.page}
            type="button"
            className={props.current === item.page ? 'is-active' : ''}
            aria-current={props.current === item.page ? 'page' : undefined}
            onClick={() => props.onNavigate(item.page)}
          >
            {item.icon}<span>{item.label}</span>
          </button>
        ))}
        {!isAdmin && (
          <button className="teacher-mobile-nav__capture" type="button" onClick={takePhoto} aria-label="Take a photo and add feedback">
            <span><LineIcon><path d="M4 8h3l1.5-2h7L17 8h3v11H4Z" /><circle cx="12" cy="13" r="3.3" /></LineIcon></span>
            <small>Capture</small>
          </button>
        )}
        {!isAdmin && (
          <button
            type="button"
            className={props.current === 'students' ? 'is-active' : ''}
            aria-current={props.current === 'students' ? 'page' : undefined}
            onClick={() => props.onNavigate('students')}
          >
            {navItems.students.icon}<span>Students</span>
          </button>
        )}
        <button
          ref={moreButtonRef}
          type="button"
          className={moreActive ? 'is-active' : ''}
          aria-current={moreActive ? 'page' : undefined}
          aria-expanded={moreOpen}
          aria-controls="mobile-more-sheet"
          onClick={() => setMoreOpen(true)}
        >
          <LineIcon><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></LineIcon>
          <span>More</span>
        </button>
      </nav>
      {!isAdmin && <input ref={cameraRef} className="teacher-mobile-camera-input" type="file" accept="image/*" capture="environment" onChange={captureChanged} />}

      {moreOpen && (
        <div className="teacher-mobile-more" role="presentation" onClick={() => setMoreOpen(false)}>
          <section id="mobile-more-sheet" className="teacher-mobile-more__sheet" role="dialog" aria-modal="true" aria-labelledby="mobile-more-title" onClick={(event) => event.stopPropagation()}>
            <div className="teacher-mobile-more__handle" />
            <div className="teacher-mobile-more__heading">
              <div>
                <strong id="mobile-more-title">More</strong>
                <small>{isAdmin ? 'Institution administration' : 'Teaching tools and account'}</small>
              </div>
              <button ref={moreCloseRef} type="button" onClick={() => setMoreOpen(false)} aria-label="Close menu"><CloseIcon /></button>
            </div>
            <div className="teacher-mobile-more__scroll">
              <div className="teacher-mobile-more__account">
                <span>{props.userInitials}</span>
                <div><strong>{props.userName}</strong><small>{isAdmin ? 'Administrator account' : 'Teacher account'}</small></div>
              </div>

              {moreGroups.map((group) => (
                <section key={group.label} className="teacher-mobile-more__group" aria-label={group.label}>
                  <h3>{group.label}</h3>
                  <div className="teacher-mobile-more__list">
                    {group.entries.map((entry) => (
                      <button
                        key={entry.page}
                        type="button"
                        className={props.current === entry.page ? 'is-active' : ''}
                        aria-current={props.current === entry.page ? 'page' : undefined}
                        onClick={() => navigate(entry.page)}
                      >
                        <span className="teacher-mobile-more__icon">{entry.icon}</span>
                        <span>{entry.label}</span>
                        {entry.count && <small className={entry.urgent ? 'is-urgent' : ''}>{entry.count}</small>}
                        <span className="teacher-mobile-more__chevron" aria-hidden="true"><ChevronIcon /></span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}

              <section className="teacher-mobile-more__group" aria-label="Account settings">
                <h3>Account</h3>
                <div className="teacher-mobile-more__list teacher-mobile-more__list--actions">
                  <button type="button" onClick={props.onToggleTheme}>
                    <span className="teacher-mobile-more__icon"><AppearanceIcon /></span>
                    <span>Appearance</span>
                    <small>{props.theme === 'dark' ? 'Dark' : 'Light'}</small>
                    <span className="teacher-mobile-more__chevron" aria-hidden="true"><ChevronIcon /></span>
                  </button>
                  <button type="button" className="is-danger" onClick={props.onLogout}>
                    <span className="teacher-mobile-more__icon"><SignOutIcon /></span>
                    <span>Sign out</span>
                  </button>
                </div>
              </section>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
