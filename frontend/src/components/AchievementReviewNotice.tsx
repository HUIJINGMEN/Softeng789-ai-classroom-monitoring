import type { Console } from '../hooks/useConsole';
import { IconAward } from './icons';

export default function AchievementReviewNotice({ console: c }: { readonly console: Console }) {
  const count = c.pendingAccomplishmentReviewCount;
  if (count === 0) return null;

  return (
    <aside className="notice notice--warn achievement-review-notice" aria-label="Achievement reviews waiting">
      <span className="achievement-review-notice__icon" aria-hidden="true"><IconAward /></span>
      <div>
        <strong>{count} achievement change request{count === 1 ? '' : 's'} need review</strong>
        <span>Students are waiting for a teacher response.</span>
      </div>
      <button type="button" className="btn btn--sm" onClick={() => c.setPage('achievements')}>Review requests</button>
    </aside>
  );
}
