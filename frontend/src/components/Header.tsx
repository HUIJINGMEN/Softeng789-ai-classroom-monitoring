import { sessionDisplayName } from '../lib/eventDisplay';
import type { Session, Theme } from '../types';

interface Props {
  title: string;
  subtitle: string;
  session: Session;
  theme: Theme;
  onToggleTheme: () => void;
  onStartDemo: () => void;
  showPrototypeBadge?: boolean;
}

export default function Header({
  title,
  subtitle,
  session,
  theme,
  onToggleTheme,
  onStartDemo,
  showPrototypeBadge = true
}: Props) {
  return (
    <header className="header">
      <div className="header__titles">
        <h1 className="header__title">{title}</h1>
        <div className="header__sub">{subtitle}</div>
      </div>

      <div className="header__actions">
        <div className="session-chip">
          <span className="session-chip__dot" />
          <span>
            {sessionDisplayName(session)}
          </span>
        </div>

        <button type="button" className="btn" onClick={onStartDemo}>
          Guided demo
        </button>

        <button type="button" className="btn" onClick={onToggleTheme} title="Switch theme">
          {theme === 'light' ? 'Dark' : 'Light'}
        </button>

        {showPrototypeBadge && <div className="badge-proto">Prototype</div>}
      </div>
    </header>
  );
}
