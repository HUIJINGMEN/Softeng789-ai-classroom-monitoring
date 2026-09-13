import { IconMoon, IconSun } from './icons';
import type { Theme } from '../types';

interface Props {
  readonly theme: Theme;
  readonly onToggle: () => void;
}

/** Shared across staff and student surfaces so theme switching keeps one visual and accessible
 * contract everywhere: the icon describes the theme the button will switch to. */
export default function ThemeToggleButton({ theme, onToggle }: Props) {
  const nextTheme = theme === 'light' ? 'dark' : 'light';

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={onToggle}
      aria-label={`Switch to ${nextTheme} theme`}
      aria-pressed={theme === 'dark'}
      title={`Switch to ${nextTheme} theme`}
    >
      {theme === 'light' ? <IconMoon /> : <IconSun />}
    </button>
  );
}
