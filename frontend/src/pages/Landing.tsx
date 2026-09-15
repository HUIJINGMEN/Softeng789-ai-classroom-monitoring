import { useEffect, useRef, useState } from 'react';
import AuthPage from './AuthPage';
import type { Auth } from '../hooks/useAuth';

type AuthMode = 'login' | 'register';

/** Matches the slide transition duration on .landing__auth-slot .auth-card. */
const CLOSE_ANIMATION_MS = 700;

export default function Landing({ auth }: { readonly auth: Auth }) {
  // authOpen controls whether the auth layer is mounted at all.
  // authVisible controls the entered/exited transform+opacity state, so the
  // same CSS transition plays in reverse on close instead of an instant unmount.
  const [authOpen, setAuthOpen] = useState(false);
  const [authVisible, setAuthVisible] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const closeTimeoutRef = useRef<number>();

  // The teacher/student console sets body[data-theme="dark"] and leaves it
  // there after logout — several shared classes (e.g. .field input's text
  // colour) key off that attribute, so a stale value here would silently
  // wash out text against this page's own dark video. Landing always wants
  // the light-theme CSS variable defaults, so clear it on arrival.
  useEffect(() => {
    delete document.body.dataset.theme;
  }, []);

  useEffect(() => () => window.clearTimeout(closeTimeoutRef.current), []);

  // Opening the panel is only a state change, not a real navigation — with
  // no history entry pushed, the browser's Back button skips straight past
  // it and leaves the whole app. Pushing a history entry here means Back
  // closes the panel first, same as clicking outside it or "Back to home".
  useEffect(() => {
    const handlePopState = () => {
      if (authOpen) playCloseAnimation();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [authOpen]);

  const playCloseAnimation = () => {
    setAuthVisible(false);
    closeTimeoutRef.current = window.setTimeout(() => {
      setAuthOpen(false);
    }, CLOSE_ANIMATION_MS);
  };

  const openAuth = (mode: AuthMode) => {
    window.clearTimeout(closeTimeoutRef.current);
    setAuthMode(mode);
    setAuthOpen(true);
    window.history.pushState({ authPanel: true }, '');
    // Double rAF: let the browser paint the off-screen starting state first,
    // then flip to the entered state so the transition actually animates.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setAuthVisible(true));
    });
  };

  // Route the close button/backdrop click through the same history entry
  // popState created, so browser Back and our own close control agree.
  const closeAuth = () => {
    if (window.history.state?.authPanel) {
      window.history.back();
    } else {
      playCloseAnimation();
    }
  };

  return (
    <div className="landing">
      <video
        className="landing__video"
        src="/media/landing-bg.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />
      <div className="landing__scrim" aria-hidden="true" />

      <header className="landing__top">
        <div className="landing__brand">
          <span className="landing__brand-badge">CM</span>
          <span className="landing__brand-name">ClassroomIQ</span>
        </div>
      </header>

      <main className={`landing__main${authOpen ? ' landing__main--hidden' : ''}`}>
        <div className="landing__eyebrow">SOFTENG 789 · Classroom Monitoring</div>
        <h1 className="landing__headline">See every classroom, clearly.</h1>
        <p className="landing__copy">
          Attendance, behaviour and live session monitoring in one console — every AI
          observation is reviewed by a teacher before it counts.
        </p>

        <div className="landing__actions">
          <button
            type="button"
            className="landing-btn landing-btn--primary"
            onClick={() => openAuth('login')}
          >
            Sign in
          </button>
          <button
            type="button"
            className="landing-btn landing-btn--ghost"
            onClick={() => openAuth('register')}
          >
            Create account
          </button>
        </div>
      </main>

      <footer className="landing__foot">Classroom Monitoring Research Project</footer>

      {authOpen && (
        <div className={`landing__auth-slot${authVisible ? ' landing__auth-slot--visible' : ''}`}>
          <AuthPage auth={auth} initialMode={authMode} onBack={closeAuth} />
        </div>
      )}
    </div>
  );
}
