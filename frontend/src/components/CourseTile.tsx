import { courseTone } from '../lib/format';

interface Props {
  readonly courseCode: string;
}

// A two-letter monogram from the course code's first word in a deterministically-toned tile —
// there's no real per-subject icon/category data to draw from (Course.name always equals
// Course.code, see CourseLookupService), so this adds visual variety without implying a fake
// taxonomy.
export default function CourseTile({ courseCode }: Props) {
  const letters = (courseCode.trim().split(/\s+/)[0] ?? courseCode).slice(0, 2).toUpperCase();

  return (
    <div className={`course-tile ${courseTone(courseCode)}`} aria-hidden="true">
      {letters}
    </div>
  );
}
