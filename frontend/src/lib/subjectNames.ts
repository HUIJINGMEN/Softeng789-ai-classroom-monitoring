// Course.name is always identical to Course.code in this system (see CourseLookupService on the
// backend) — there's no real department/subject-area field to read a full name from. This only
// spells out the small set of subject-code prefixes that actually appear in this university's own
// course codes (real abbreviations, not invented names); an unrecognised prefix returns null so
// the UI can simply omit the subtitle rather than guess.
const SUBJECT_NAMES: Record<string, string> = {
  COMPSCI: 'Computer Science',
  SOFTENG: 'Software Engineering',
  ENGSCI: 'Engineering Science',
  INFOSYS: 'Information Systems'
};

export function subjectName(courseCode: string): string | null {
  const prefix = courseCode.trim().split(/\s+/)[0]?.toUpperCase();
  return prefix ? (SUBJECT_NAMES[prefix] ?? null) : null;
}
