import { useEffect, useMemo, useState } from 'react';
import ClassDetail from './ClassDetail';
import CreateClassModal from '../components/CreateClassModal';
import { IconGraduationCap } from '../components/icons';
import Pager from '../components/Pager';
import { apiMessage } from '../lib/apiClient';
import { listStaff } from '../lib/adminApi';
import { createClass, listClasses, type ClassApiResponse } from '../lib/classAdminApi';
import { classStatusBadge } from '../lib/classStatusBadge';
import { usePagination } from '../lib/table';
import type { Console } from '../hooks/useConsole';
import type { StaffMember } from '../types';

const PAGE_SIZE = 10;

export default function AdminClasses({ console: c }: { readonly console: Console }) {
  const [classes, setClasses] = useState<ClassApiResponse[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [creatingClass, setCreatingClass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

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

  const filteredClasses = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return classes;
    return classes.filter(
      (klass) =>
        klass.courseCode.toLowerCase().includes(trimmed) ||
        klass.academicTerm.toLowerCase().includes(trimmed) ||
        klass.teachers.some((teacher) => teacher.name.toLowerCase().includes(trimmed))
    );
  }, [classes, query]);

  const paged = usePagination(filteredClasses, page, setPage, PAGE_SIZE);

  const selectedClass = classes.find((klass) => klass.id === selectedClassId);

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
            <button type="button" className="btn btn--primary" onClick={() => setCreatingClass(true)}>
              + Create class
            </button>
          </div>
        </div>

        <label className="field">
          Search
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder="Course code, term or teacher"
          />
        </label>

        {listError && (
          <div className="notice notice--warn">
            <span className="notice__mark" aria-hidden="true" />
            <span>{listError}</span>
          </div>
        )}

        <table className="table table--compact">
          <thead>
            <tr>
              <th>Course</th>
              <th>Term</th>
              <th>Teachers</th>
              <th>Students</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {paged.rows.map((klass) => (
              <tr key={klass.id}>
                <td className="cell-strong">{klass.courseCode}</td>
                <td>{klass.academicTerm}</td>
                <td>{klass.teachers.map((teacher) => teacher.name).join(', ') || 'No teacher assigned'}</td>
                <td>{klass.studentCount}</td>
                <td>
                  <span className={classStatusBadge(klass.status).className}>
                    {classStatusBadge(klass.status).label}
                  </span>
                </td>
                <td className="table__action-cell">
                  <button
                    type="button"
                    className="btn btn--quiet btn--sm"
                    onClick={() => setSelectedClassId(klass.id)}
                  >
                    Manage →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && filteredClasses.length === 0 && !listError && (
          <div className="empty">{classes.length === 0 ? 'No classes yet.' : 'No classes match your search.'}</div>
        )}

        <Pager
          label={paged.label}
          pageLabel={paged.pageLabel}
          canPrev={paged.canPrev}
          canNext={paged.canNext}
          onPrev={paged.prev}
          onNext={paged.next}
        />
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
