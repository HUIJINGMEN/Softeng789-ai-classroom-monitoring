import Pager from '../Pager';
import PersonAvatar from '../PersonAvatar';
import SearchField from '../SearchField';
import SelectMenu from '../SelectMenu';
import { IconChevronRight, IconUserPlus } from '../icons';
import { formatRate, studentRateLabel, studentRateLabelClass } from '../../lib/format';
import { STUDENT_LEVEL_OPTIONS } from '../../lib/studentLevels';
import type { StudentLevel } from '../../types';
import MobileDirectorySkeleton from './MobileDirectorySkeleton';

export interface MobileStudentRecord {
  readonly id: string;
  readonly name: string;
  readonly studentNumber: string;
  readonly photoUrl?: string | null;
  readonly tone: string;
  readonly primaryCourse: string;
  readonly extraCourseCount: number;
  readonly rate: number | null;
  readonly withdrawn: boolean;
}

interface Props {
  readonly scope: 'assigned' | 'institution';
  readonly records: readonly MobileStudentRecord[];
  readonly totalCount: number;
  readonly query: string;
  readonly course: string;
  readonly courseOptions: readonly string[];
  readonly level: 'All' | StudentLevel;
  readonly loading: boolean;
  readonly error: string;
  readonly pageLabel: string;
  readonly page: number;
  readonly pageCount: number;
  readonly canPrev: boolean;
  readonly canNext: boolean;
  readonly onQueryChange: (value: string) => void;
  readonly onCourseChange: (value: string) => void;
  readonly onLevelChange: (value: 'All' | StudentLevel) => void;
  readonly onAdd: () => void;
  readonly onOpen: (id: string) => void;
  readonly onRetry: () => void;
  readonly onClear: () => void;
  readonly onPrev: () => void;
  readonly onNext: () => void;
  readonly onGoToPage: (page: number) => void;
}

export default function MobileStudentDirectory(props: Props) {
  const activeFilterCount = Number(props.course !== 'All' && props.course !== 'All courses')
    + Number(props.level !== 'All');
  const institutionWide = props.scope === 'institution';

  return (
    <section className="mobile-directory" aria-labelledby="mobile-students-title">
      <header className="mobile-directory__intro mobile-directory__intro--action">
        <div>
          <h2 id="mobile-students-title">Student directory</h2>
          <p>{props.totalCount} student{props.totalCount === 1 ? '' : 's'} {institutionWide ? 'across the institution' : 'in your classes'}</p>
        </div>
        <button type="button" className="mobile-directory__primary" onClick={props.onAdd}>
          <IconUserPlus /><span>Add</span>
        </button>
      </header>

      <SearchField
        className="mobile-directory__search"
        value={props.query}
        onChange={props.onQueryChange}
        label="Search students"
        placeholder="Name or student ID"
      />

      <details className="mobile-directory__filters">
        <summary>
          <span>Filters</span>
          <small>{activeFilterCount > 0 ? `${activeFilterCount} active` : `${props.records.length} shown`}</small>
        </summary>
        <div>
          <div className="field">
            <span>Course</span>
            <SelectMenu
              value={props.course}
              options={props.courseOptions.map((value) => ({
                value,
                label: value === 'All' || value === 'All courses' ? 'All courses' : value
              }))}
              onChange={props.onCourseChange}
              ariaLabel="Filter students by course"
            />
          </div>
          <div className="field">
            <span>Level</span>
            <SelectMenu
              value={props.level}
              options={[{ value: 'All' as const, label: 'All levels' }, ...STUDENT_LEVEL_OPTIONS]}
              onChange={props.onLevelChange}
              ariaLabel="Filter students by level"
            />
          </div>
          {activeFilterCount > 0 && <button type="button" className="mobile-directory__clear" onClick={props.onClear}>Clear filters</button>}
        </div>
      </details>

      {props.error && (
        <div className="mobile-directory__notice" role="alert">
          <span>{props.error}</span>
          <button type="button" onClick={props.onRetry}>Retry</button>
        </div>
      )}

      <div className="mobile-record-list" aria-live="polite">
        {props.records.map((student) => (
          <button key={student.id} type="button" className="mobile-student-record" onClick={() => props.onOpen(student.id)}>
            <span className="mobile-student-record__identity">
              <PersonAvatar
                photoUrl={student.photoUrl}
                name={student.name}
                tone={student.tone}
                alt={`${student.name} registration`}
              />
              <span>
                <strong>{student.name}</strong>
                <small>{student.studentNumber}</small>
              </span>
              {student.withdrawn && <em>Withdrawn</em>}
              <span className="mobile-record__chevron" aria-hidden="true"><IconChevronRight /></span>
            </span>
            <span className="mobile-student-record__summary">
              <span>
                <small>Classes</small>
                <strong>{student.primaryCourse}</strong>
                {student.extraCourseCount > 0 && <em>+{student.extraCourseCount} more</em>}
              </span>
              <span>
                <small>Attendance</small>
                {student.rate === null ? (
                  <strong>—</strong>
                ) : (
                  <><strong>{formatRate(student.rate)}</strong><em className={studentRateLabelClass(student.rate)}>{studentRateLabel(student.rate)}</em></>
                )}
              </span>
            </span>
          </button>
        ))}

        {props.loading && props.totalCount === 0 && <MobileDirectorySkeleton label="Loading students" />}
        {!props.loading && !props.error && props.records.length === 0 && (
          <div className="mobile-directory__state">
            <strong>{props.totalCount === 0 ? 'No students yet' : 'No matching students'}</strong>
            <span>{props.totalCount === 0 ? 'Add a student to start the directory.' : 'Try another name, course or level.'}</span>
            {props.totalCount > 0 && <button type="button" onClick={props.onClear}>Clear filters</button>}
          </div>
        )}
      </div>

      {props.records.length > 0 && (
        <Pager
          label={props.pageLabel}
          page={props.page}
          pageCount={props.pageCount}
          canPrev={props.canPrev}
          canNext={props.canNext}
          onPrev={props.onPrev}
          onNext={props.onNext}
          onGoToPage={props.onGoToPage}
        />
      )}
    </section>
  );
}
