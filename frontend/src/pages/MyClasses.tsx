import { useEffect, useMemo, useState } from 'react';
import ClassesListToolbar from '../components/ClassesListToolbar';
import CourseTile from '../components/CourseTile';
import DirectoryState from '../components/DirectoryState';
import MyClassDetail from '../components/MyClassDetail';
import MiniAttendanceRing from '../components/MiniAttendanceRing';
import Pager from '../components/Pager';
import SortableHeader from '../components/SortableHeader';
import MobileClassDirectory from '../components/mobile/MobileClassDirectory';
import { IconGraduationCap, IconSearch } from '../components/icons';
import useMediaQuery from '../hooks/useMediaQuery';
import { apiMessage } from '../lib/apiClient';
import { buildClassRow } from '../lib/classRows';
import { listActiveClasses, type ClassSummaryApiResponse } from '../lib/classAdminApi';
import { subjectName } from '../lib/subjectNames';
import { compareNullableValues, usePagination, useSort } from '../lib/table';
import type { Console } from '../hooks/useConsole';

const ALL_TERMS = 'All';
const PAGE_SIZE = 10;
type ClassSortKey = 'course' | 'term' | 'teachers' | 'students' | 'sessions' | 'attendance' | 'next';

/** Teacher-facing counterpart to Admin's Classes page — same "Classes" nav entry, but read-only:
 *  no create button, no roster/teacher management, just the classes this teacher actually teaches
 *  (listActiveClasses is scoped server-side, same endpoint CreateSessionModal's class picker uses)
 *  and a drill-down into each one's roster/sessions (MyClassDetail.tsx). */
export default function MyClasses({ console: c }: { readonly console: Console }) {
  const isMobile = useMediaQuery('(max-width: 760px)');
  const [classes, setClasses] = useState<ClassSummaryApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState(ALL_TERMS);
  const [page, setPage] = useState(0);
  const { sort, toggle } = useSort<ClassSortKey>('course');

  const refresh = () => {
    setLoading(true);
    listActiveClasses()
      .then((result) => {
        setClasses(result);
        setListError('');
      })
      .catch((error) => setListError(apiMessage(error)))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  // Consume dashboard and other cross-page links after this teacher's scoped class list loads.
  // The offering UUID keeps similarly named courses from different terms from opening the wrong class.
  useEffect(() => {
    if (!c.classFocusId) return;
    const match = classes.find((klass) => klass.id === c.classFocusId);
    if (match) {
      setSelectedClassId(match.id);
      c.setClassFocusId(null);
    }
  }, [c.classFocusId, classes, c.setClassFocusId]);

  const termOptions = useMemo(
    () => Array.from(new Set(classes.map((klass) => klass.academicTerm))).sort((left, right) => left.localeCompare(right)),
    [classes]
  );

  const filteredClasses = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    return classes.filter((klass) => {
      if (term !== ALL_TERMS && klass.academicTerm !== term) return false;
      if (!trimmed) return true;
      return (
        klass.courseCode.toLowerCase().includes(trimmed) ||
        klass.offeringCode.toLowerCase().includes(trimmed) ||
        klass.academicTerm.toLowerCase().includes(trimmed) ||
        klass.teachers.some((teacher) => teacher.name.toLowerCase().includes(trimmed))
      );
    });
  }, [classes, query, term]);

  const classRows = useMemo(
    () =>
      filteredClasses.map((klass) => {
        return {
          klass,
          row: buildClassRow(klass.id, c.sessions, c.countsForSession)
        };
      }),
    [filteredClasses, c.sessions, c.countsForSession]
  );

  const sortedRows = useMemo(
    () =>
      [...classRows].sort((left, right) => {
        const valueFor = (entry: (typeof classRows)[number]) => {
          if (sort.key === 'course') return entry.klass.courseCode;
          if (sort.key === 'term') return entry.klass.academicTerm;
          if (sort.key === 'teachers') return entry.klass.teachers.map((teacher) => teacher.name).join(', ');
          if (sort.key === 'students') return entry.klass.studentCount;
          if (sort.key === 'sessions') return entry.row.sessionCount;
          if (sort.key === 'attendance') return entry.row.attendance.rate;
          return entry.row.nextOrLatestSession?.startTime;
        };
        return compareNullableValues(valueFor(left), valueFor(right), sort.dir);
      }),
    [classRows, sort]
  );

  const paged = usePagination(sortedRows, page, setPage, PAGE_SIZE);

  const selectedClass = classes.find((klass) => klass.id === selectedClassId);

  const openClass = (classId: string) => {
    setSelectedClassId(classId);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  // Lifted to Console purely so TeacherApp's page header can show a "Classes / COURSE CODE"
  // breadcrumb — selectedClassId itself stays local, this just mirrors its label up.
  useEffect(() => {
    c.setClassDetailTitle(selectedClass ? selectedClass.courseCode : null);
  }, [selectedClass, c.setClassDetailTitle]);

  if (selectedClass) {
    return <MyClassDetail klass={selectedClass} console={c} onBack={() => {
      setSelectedClassId(null);
      window.scrollTo({ top: 0, behavior: 'auto' });
    }} />;
  }

  if (isMobile) {
    return (
      <div className="page__inner page__inner--mobile-directory">
        <MobileClassDirectory
          scope="assigned"
          records={paged.rows.map(({ klass, row }) => ({
            id: klass.id,
            courseCode: klass.courseCode,
            subject: subjectName(klass.courseCode) ?? '',
            academicTerm: klass.academicTerm,
            studentCount: klass.studentCount,
            sessionCount: row.sessionCount,
            attendanceRate: row.attendance.rate,
            nextDate: row.nextOrLatestSession?.dateLabel,
            nextMeta: row.nextOrLatestSession
              ? `${row.nextOrLatestSession.time}${row.nextOrLatestSession.campusName ? ` · ${row.nextOrLatestSession.campusName}` : ''}`
              : undefined
          }))}
          totalCount={classes.length}
          query={query}
          term={term}
          termOptions={termOptions}
          loading={loading}
          error={listError}
          pageLabel={paged.label}
          page={paged.page}
          pageCount={paged.pageCount}
          canPrev={paged.canPrev}
          canNext={paged.canNext}
          onQueryChange={(value) => { setQuery(value); setPage(0); }}
          onTermChange={(value) => { setTerm(value); setPage(0); }}
          onOpen={openClass}
          onRetry={refresh}
          onClear={() => { setQuery(''); setTerm(ALL_TERMS); }}
          onPrev={paged.prev}
          onNext={paged.next}
          onGoToPage={paged.goToPage}
        />
      </div>
    );
  }

  return (
    <div className="page__inner">
      <section className="card card--min-list dashboard-enter stagger-1">
        <div className="card__head">
          <div className="card__title-row">
            <span className="icon-inline icon-inline--title" aria-hidden="true">
              <IconGraduationCap />
            </span>
            <div>
              <div className="card__title">Classes</div>
              <div className="card__sub">
                {classes.length} class{classes.length === 1 ? '' : 'es'} you teach
              </div>
            </div>
          </div>
          <div className="card__actions">
            <span className="directory-count" aria-live="polite">
              {filteredClasses.length} of {classes.length} classes
            </span>
          </div>
        </div>

        <ClassesListToolbar
          query={query}
          onQueryChange={(value) => {
            setQuery(value);
            setPage(0);
          }}
          term={term}
          onTermChange={(value) => {
            setTerm(value);
            setPage(0);
          }}
          termOptions={termOptions}
        />

        {listError && (
          <div className="notice notice--warn">
            <span className="notice__mark" aria-hidden="true" />
            <span>{listError}</span>
            <span className="spacer" />
            <button type="button" className="btn btn--sm" onClick={refresh}>
              Retry
            </button>
          </div>
        )}

        {(loading || paged.rows.length > 0) && <table className="table table--compact table--mobile-classes">
          <SortableHeader
            columns={[
              { key: 'course', label: 'Course' },
              { key: 'term', label: 'Term', sortable: false },
              { key: 'teachers', label: 'Teachers', sortable: false },
              { key: 'students', label: 'Students' },
              { key: 'sessions', label: 'Sessions' },
              { key: 'attendance', label: 'Attendance', priority: true },
              { key: 'next', label: 'Next / latest session' }
            ]}
            sort={sort}
            onSort={(key) => {
              toggle(key);
              setPage(0);
            }}
          />
          <tbody>
            {paged.rows.map(({ klass, row }) => (
              <tr
                key={klass.id}
                className="table__row--clickable"
                tabIndex={0}
                onClick={() => openClass(klass.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openClass(klass.id);
                  }
                }}
              >
                <td>
                  <div className="person">
                    <CourseTile courseCode={klass.courseCode} />
                    <div>
                      <div className="cell-strong">{klass.courseCode}</div>
                      {subjectName(klass.courseCode) && (
                        <div className="cell-sub">{subjectName(klass.courseCode)}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td>{klass.academicTerm}</td>
                <td>
                  {klass.teachers.length === 0 ? (
                    'No teacher assigned'
                  ) : (
                    <span className="row-inline">
                      <span>{klass.teachers.slice(0, 2).map((teacher) => teacher.name).join(', ')}</span>
                      {klass.teachers.length > 2 && (
                        <span className="badge badge--neutral">+{klass.teachers.length - 2}</span>
                      )}
                    </span>
                  )}
                </td>
                <td>
                  <div className="cell-strong">{klass.studentCount}</div>
                </td>
                <td>{row.sessionCount}</td>
                <td>
                  <MiniAttendanceRing rate={row.attendance.rate} />
                </td>
                <td>
                  {row.nextOrLatestSession ? (
                    <>
                      <div className="cell-strong">{row.nextOrLatestSession.dateLabel}</div>
                      <div className="cell-sub">
                        {row.nextOrLatestSession.time}
                        {row.nextOrLatestSession.campusName ? ` · ${row.nextOrLatestSession.campusName}` : ''}
                      </div>
                    </>
                  ) : (
                    <span className="cell-sub">—</span>
                  )}
                </td>
              </tr>
            ))}
            {loading && classes.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <output className="empty empty--inline">Loading classes…</output>
                </td>
              </tr>
            )}
          </tbody>
        </table>}

        {!loading && filteredClasses.length === 0 && !listError && (
          <DirectoryState
            icon={classes.length === 0 ? <IconGraduationCap /> : <IconSearch />}
            title={classes.length === 0 ? 'No assigned classes' : 'No matching classes'}
            description={
              classes.length === 0
                ? 'Classes assigned to your account will appear here.'
                : 'Try a different course, teacher or term.'
            }
            action={classes.length > 0 ? (
              <button type="button" className="btn btn--sm" onClick={() => { setQuery(''); setTerm(ALL_TERMS); }}>
                Clear filters
              </button>
            ) : undefined}
          />
        )}

        {filteredClasses.length > 0 && (
          <Pager
            label={paged.label}
            page={paged.page}
            pageCount={paged.pageCount}
            canPrev={paged.canPrev}
            canNext={paged.canNext}
            onPrev={paged.prev}
            onNext={paged.next}
            onGoToPage={paged.goToPage}
          />
        )}
      </section>
    </div>
  );
}
