import { sessionDisplayName } from '../lib/eventDisplay';
import ThemeToggleButton from './ThemeToggleButton';
import type { Session, Theme } from '../types';

interface Props {
  readonly title: string;
  readonly subtitle: string;
  readonly session?: Session;
  readonly theme: Theme;
  readonly onToggleTheme: () => void;
  readonly onStartDemo: () => void;
  readonly userName: string;
  readonly userInitials: string;
  readonly onLogout: () => void;
}

export default function Header({
  title,
  subtitle,
  session,
  theme,
  onToggleTheme,
  onStartDemo,
  userName,
  userInitials,
  onLogout
}: Props) {
  return (
    <header className="header">
      <div className="header__inner">
        <div className="header__titles">
          <h1 className="header__title">{title}</h1>
          <div className="header__sub">{subtitle}</div>
        </div>

        <div className="header__actions">
          {session && (
            <div className="session-chip">
              <span className="session-chip__dot" />
              <span>
                {sessionDisplayName(session)}
              </span>
            </div>
          )}

          <button type="button" className="btn" onClick={onStartDemo}>
            Guided demo
          </button>

          <ThemeToggleButton theme={theme} onToggle={onToggleTheme} />

          <div className="header__user">
            <span className="header__user-avatar">{userInitials}</span>
            <span className="header__user-name">{userName}</span>
          </div>

          <button type="button" className="btn btn--quiet btn--sm" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
