interface Props {
  readonly courses: readonly string[];
  readonly value: string;
  readonly onChange: (course: string) => void;
}

export default function StudentCourseFilter({ courses, value, onChange }: Props) {
  return (
    <label className="student-course-filter">
      <span>Class</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="all">All classes</option>
        {courses.map((course) => (
          <option value={course} key={course}>{course}</option>
        ))}
      </select>
    </label>
  );
}
