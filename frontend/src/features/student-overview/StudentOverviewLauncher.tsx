import { IconArrowRight, IconCalendar } from '../../components/icons';

export default function StudentOverviewLauncher() {
  return (
    <section className="student-overview-launcher" aria-labelledby="student-overview-launcher-title">
      <span className="student-overview-launcher__icon" aria-hidden="true">
        <IconCalendar />
      </span>
      <div className="student-overview-launcher__copy">
        <h2 id="student-overview-launcher-title">Student status table</h2>
        <p>
          Open the full-width register to compare every student, payment account and lesson date
          without the console sidebar taking up table space.
        </p>
        <span>Opens in a new tab so your place in Students stays here.</span>
      </div>
      <a
        className="btn btn--primary btn--with-icon student-overview-launcher__action"
        href="/student-overview"
        target="_blank"
        rel="noopener noreferrer"
      >
        Open full table
        <IconArrowRight />
      </a>
    </section>
  );
}
