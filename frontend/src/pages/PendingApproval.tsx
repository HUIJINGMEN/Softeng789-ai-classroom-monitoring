import { useTheme } from '../hooks/useTheme';
import { avatarTone, initials } from '../lib/format';
import type { AuthUser } from '../types';

interface Props {
  readonly user: AuthUser;
  readonly status: 'PENDING' | 'REJECTED';
  readonly onLogout: () => void;
}

export default function PendingApproval({ user, status, onLogout }: Props) {
  const { theme, setTheme } = useTheme();
  const tone = avatarTone(user.id, 0);
  const firstName = user.name.split(' ')[0] || user.name;
  const rejected = status === 'REJECTED';

  return (
    <div className="student-portal">
      <header className="student-portal__top">
        <div className="student-portal__identity">
          <div className={`person__avatar ${tone}`} aria-hidden="true">
            {initials(user.name)}
          </div>
          <div>
            <div className="student-portal__identity-name">{user.name}</div>
            <div className="student-portal__identity-role">Student · {user.email}</div>
          </div>
        </div>

        <div className="header__actions">
          <button
            type="button"
            className="btn"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            title="Switch theme"
          >
            {theme === 'light' ? 'Dark' : 'Light'}
          </button>
          <button type="button" className="btn btn--quiet" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </header>

      <div className="student-portal__page">
        <div className="student-portal__inner pending-approval">
          <section className="card dashboard-enter stagger-0 pending-approval__card">
            {rejected ? (
              <>
                <span className="badge badge--absent">Not approved</span>
                <div className="card__title pending-approval__title">Registration not approved</div>
                <p className="card__sub pending-approval__body">
                  Hi {firstName}, an Admin reviewed your registration and it wasn't approved this
                  time. If you think this is a mistake, contact your department to have it
                  reviewed again.
                </p>
              </>
            ) : (
              <>
                <span className="badge badge--pending-review">Awaiting approval</span>
                <div className="card__title pending-approval__title">Registration submitted</div>
                <p className="card__sub pending-approval__body">
                  Thanks, {firstName}. Your account and the classes you selected are waiting for an
                  Admin to review. You'll be able to see your attendance, progress and reports here
                  as soon as it's approved — check back later, or ask your teacher if it's taking a
                  while.
                </p>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
