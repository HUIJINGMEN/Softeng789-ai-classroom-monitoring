import { useEffect, useMemo, useState } from 'react';
import ClassDetail from './ClassDetail';
import ClassesListToolbar from '../components/ClassesListToolbar';
import CourseTile from '../components/CourseTile';
import CreateClassModal from '../components/CreateClassModal';
import DirectoryState from '../components/DirectoryState';
import { IconArrowRight, IconGraduationCap, IconPlus, IconSearch } from '../components/icons';
import MiniAttendanceRing from '../components/MiniAttendanceRing';
import Pager from '../components/Pager';
import SortableHeader from '../components/SortableHeader';
import { apiMessage } from '../lib/apiClient';
import { listStaff } from '../lib/adminApi';
import { buildClassRow } from '../lib/classRows';
import { createClass, listClasses, type ClassApiResponse } from '../lib/classAdminApi';
import { classStatusBadge } from '../lib/classStatusBadge';
import { subjectName } from '../lib/subjectNames';
import { compareNullableValues, usePagination, useSort } from '../lib/table';
import type { Console } from '../hooks/useConsole';
import type { StaffMember } from '../types';

const ALL_TERMS = 'All';

const PAGE_SIZE = 10;
type ClassSortKey =
  | 'course'
  | 'term'
  | 'teachers'
  | 'students'
  | 'sessions'
  | 'attendance'
  | 'next'
  | 'status';

export default function AdminClasses({ console: c }: { readonly console: Console }) {
  const [classes, setClasses] = useState<ClassApiResponse[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [creatingClass, setCreatingClass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState(ALL_TERMS);
  const [page, setPage] = useState(0);
  const { sort, toggle } = useSort<ClassSortKey>('course');

  const refresh = () => {
    setLoading(true);
    Promise.all([listClasses(), listStaff()])
      .then(([classResult, staffResult]) => {
        setClasses(classResult);
        setStaff(staffResult);
        setListError('');
      })
      .catch((error) => setListError(apiMessage(error)))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  // A one-shot deep-link from somewhere outside this page (e.g. Campuses' "classes at this
  // room" list) — same consume-then-clear pattern Students.tsx uses for c.profileId. Waits for
  // the class list to actually contain the target before opening it, so a link that arrives
  // before the initial fetch resolves still works instead of silently no-opping.
  useEffect(() => {
    if (!c.classFocusId) return;
    const match = classes.find((klass) => klass.id === c.classFocusId);
    if (match) {
      setSelectedClassId(match.id);
      c.setClassFocusId(null);
    }
  }, [c.classFocusId, classes, c.setClassFocusId]);

  const handleCreateClass = async (payload: {
    courseCode: string;
    academicTerm: string;
    teacherIds: string[];
  }) => {
    setSaving(true);
    try {
      await createClass(payload);
      refresh();
      return true;
    } catch (error) {
      c.showToast(`Class was not created: ${apiMessage(error)}`);
      return false;
    } finally {
      setSaving(false);
    }
  };

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
          if (sort.key === 'next') return entry.row.nextOrLatestSession?.startTime;
          return entry.klass.status;
        };
        return compareNullableValues(valueFor(left), valueFor(right), sort.dir);
      }),
    [classRows, sort]
  );

  const paged = usePagination(sortedRows, page, setPage, PAGE_SIZE);
  const pagedRows = paged.rows;

  const selectedClass = classes.find((klass) => klass.id === selectedClassId);

  // Lifted to Console purely so TeacherApp's page header can show a "Classes / COURSE CODE"
  // breadcrumb — selectedClassId itself stays local, this just mirrors its label up.
  useEffect(() => {
    c.setClassDetailTitle(selectedClass ? selectedClass.courseCode : null);
  }, [selectedClass, c.setClassDetailTitle]);

  if (selectedClass) {
    return (
      <ClassDetail
        klass={selectedClass}
        staff={staff}
        classes={classes}
        console={c}
        onBack={() => setSelectedClassId(null)}
        onChanged={refresh}
      />
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
              <div className="card__sub">{classes.length} class{classes.length === 1 ? '' : 'es'}</div>
            </div>
          </div>
          <div className="card__actions">
            <span className="directory-count" aria-live="polite">
              {filteredClasses.length} of {classes.length} classes
            </span>
            <button type="button" className="btn btn--primary btn--with-icon" onClick={() => setCreatingClass(true)}>
              <IconPlus /> Create class
            </button>
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

        {(loading || pagedRows.length > 0) && <table className="table table--compact">
          <SortableHeader
            columns={[
              { key: 'course', label: 'Course' },
              { key: 'term', label: 'Term', sortable: false },
              { key: 'teachers', label: 'Teachers', sortable: false },
              { key: 'students', label: 'Students' },
              { key: 'sessions', label: 'Sessions' },
              { key: 'attendance', label: 'Attendance', priority: true },
              { key: 'next', label: 'Next / latest session' },
              { key: 'status', label: 'Status', sortable: false }
            ]}
            sort={sort}
            onSort={(key) => {
              toggle(key);
              setPage(0);
            }}
          />
          <tbody>
            {pagedRows.map(({ klass, row }) => (
              <tr
                key={klass.id}
                className="table__row--clickable"
                tabIndex={0}
                onClick={() => setSelectedClassId(klass.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedClassId(klass.id);
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
                <td>
                  <span className={classStatusBadge(klass.status).className}>
                    {classStatusBadge(klass.status).label}
                  </span>
                </td>
                <td className="table__action-cell">
                  <button
                    type="button"
                    className="btn btn--sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedClassId(klass.id);
                    }}
                  >
                    Manage <IconArrowRight />
                  </button>
                </td>
              </tr>
            ))}
            {loading && classes.length === 0 && (
              <tr>
                <td colSpan={9}>
                  <output className="empty empty--inline">Loading classes…</output>
                </td>
              </tr>
            )}
          </tbody>
        </table>}

        {!loading && filteredClasses.length === 0 && !listError && (
          <DirectoryState
            icon={classes.length === 0 ? <IconGraduationCap /> : <IconSearch />}
            title={classes.length === 0 ? 'No classes yet' : 'No matching classes'}
            description={
              classes.length === 0
                ? 'Create the first class to begin scheduling sessions and enrolling students.'
                : 'Try a different course, teacher or term.'
            }
            action={
              classes.length === 0 ? (
                <button type="button" className="btn btn--primary btn--with-icon" onClick={() => setCreatingClass(true)}>
                  <IconPlus /> Create class
                </button>
              ) : (
                <button type="button" className="btn btn--sm" onClick={() => { setQuery(''); setTerm(ALL_TERMS); }}>
                  Clear filters
                </button>
              )
            }
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

      {creatingClass && (
        <CreateClassModal
          staff={staff}
          saving={saving}
          onCreate={handleCreateClass}
          onClose={() => setCreatingClass(false)}
        />
      )}
    </div>
  );
}
