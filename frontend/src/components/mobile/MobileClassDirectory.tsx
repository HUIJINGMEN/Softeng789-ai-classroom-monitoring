import CourseTile from '../CourseTile';
import Pager from '../Pager';
import SearchField from '../SearchField';
import SelectMenu from '../SelectMenu';
import { IconChevronRight, IconPlus } from '../icons';
import MobileDirectorySkeleton from './MobileDirectorySkeleton';

export interface MobileClassRecord {
  readonly id: string;
  readonly courseCode: string;
  readonly subject: string;
  readonly academicTerm: string;
  readonly studentCount: number;
  readonly sessionCount: number;
  readonly attendanceRate: number | null;
  readonly nextDate?: string;
  readonly nextMeta?: string;
}

interface Props {
  readonly scope: 'assigned' | 'institution';
  readonly records: readonly MobileClassRecord[];
  readonly totalCount: number;
  readonly query: string;
  readonly term: string;
  readonly termOptions: readonly string[];
  readonly loading: boolean;
  readonly error: string;
  readonly pageLabel: string;
  readonly page: number;
  readonly pageCount: number;
  readonly canPrev: boolean;
  readonly canNext: boolean;
  readonly onQueryChange: (value: string) => void;
  readonly onTermChange: (value: string) => void;
  readonly onOpen: (id: string) => void;
  readonly onAdd?: () => void;
  readonly onRetry: () => void;
  readonly onClear: () => void;
  readonly onPrev: () => void;
  readonly onNext: () => void;
  readonly onGoToPage: (page: number) => void;
}

function rateTone(rate: number | null): string {
  if (rate === null) return 'is-neutral';
  if (rate >= 80) return 'is-good';
  if (rate >= 60) return 'is-fair';
  return 'is-low';
}

export default function MobileClassDirectory(props: Props) {
  const institutionWide = props.scope === 'institution';
  return (
    <section className="mobile-directory" aria-labelledby="mobile-classes-title">
      <header className={`mobile-directory__intro${props.onAdd ? ' mobile-directory__intro--action' : ''}`}>
        <div>
          <h2 id="mobile-classes-title">{institutionWide ? 'Class directory' : 'Your classes'}</h2>
          <p>{props.totalCount} class{props.totalCount === 1 ? '' : 'es'} {institutionWide ? 'across the institution' : 'assigned to you'}</p>
        </div>
        {props.onAdd ? (
          <button type="button" className="mobile-directory__primary" onClick={props.onAdd}>
            <IconPlus /><span>Create</span>
          </button>
        ) : (
          <span className="mobile-directory__count" aria-live="polite">{props.records.length} shown</span>
        )}
      </header>

      <div className="mobile-directory__tools">
        <SearchField
          value={props.query}
          onChange={props.onQueryChange}
          label="Search classes"
          placeholder="Course or teacher"
        />
        <SelectMenu
          className="mobile-directory__filter"
          value={props.term}
          options={[
            { value: 'All', label: 'All terms' },
            ...props.termOptions.map((option) => ({ value: option, label: option }))
          ]}
          onChange={props.onTermChange}
          ariaLabel="Filter classes by term"
          align="right"
        />
      </div>

      {props.error && (
        <div className="mobile-directory__notice" role="alert">
          <span>{props.error}</span>
          <button type="button" onClick={props.onRetry}>Retry</button>
        </div>
      )}

      <div className="mobile-record-list" aria-live="polite">
        {props.records.map((record) => (
          <button key={record.id} type="button" className="mobile-class-record" onClick={() => props.onOpen(record.id)}>
            <span className="mobile-class-record__top">
              <CourseTile courseCode={record.courseCode} />
              <span className="mobile-class-record__identity">
                <strong>{record.courseCode}</strong>
                <small>{record.subject || record.academicTerm}</small>
              </span>
              <span className="mobile-record__chevron" aria-hidden="true"><IconChevronRight /></span>
            </span>

            <span className="mobile-class-record__metrics">
              <span><small>Students</small><strong>{record.studentCount}</strong></span>
              <span><small>Sessions</small><strong>{record.sessionCount}</strong></span>
              <span className={rateTone(record.attendanceRate)}>
                <small>Attendance</small>
                <strong>{record.attendanceRate === null ? '—' : `${record.attendanceRate}%`}</strong>
              </span>
            </span>

            <span className="mobile-class-record__schedule">
              <small>Next or latest</small>
              <span>
                <strong>{record.nextDate ?? 'No sessions yet'}</strong>
                {record.nextMeta && <em>{record.nextMeta}</em>}
              </span>
            </span>
          </button>
        ))}

        {props.loading && props.totalCount === 0 && <MobileDirectorySkeleton label="Loading classes" />}
        {!props.loading && !props.error && props.records.length === 0 && (
          <div className="mobile-directory__state">
            <strong>{props.totalCount === 0 ? (institutionWide ? 'No classes yet' : 'No assigned classes') : 'No matching classes'}</strong>
            <span>{props.totalCount === 0 ? (institutionWide ? 'Create the first class to begin.' : 'Assigned classes will appear here.') : 'Try another course or term.'}</span>
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
