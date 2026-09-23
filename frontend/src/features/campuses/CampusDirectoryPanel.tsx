import Pager from '../../components/Pager';
import SearchField from '../../components/SearchField';
import { IconBuilding, IconChevronRight, IconPlus } from '../../components/icons';
import type { CampusManagement } from './useCampusManagement';

interface Props {
  readonly workspace: CampusManagement;
}

function campusCountLabel(filtered: number, total: number, hasQuery: boolean): string {
  if (hasQuery) return `${filtered} of ${total} campuses`;
  return `${total} campus${total === 1 ? '' : 'es'}`;
}

export default function CampusDirectoryPanel({ workspace: w }: Props) {
  return (
    <section className="card campus-directory dashboard-enter stagger-1">
      <div className="card__head campus-directory__head">
        <div className="card__title-row">
          <span className="icon-inline icon-inline--title" aria-hidden="true">
            <IconBuilding />
          </span>
          <div>
            <div className="card__title">Campus directory</div>
            <div className="card__sub">
              {campusCountLabel(
                w.filteredCampuses.length,
                w.campuses.length,
                Boolean(w.campusQuery.trim())
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          className="btn btn--primary btn--with-icon campus-directory__add"
          aria-label="Add campus"
          onClick={() => w.setCreatingCampus(true)}
        >
          <IconPlus /> Add
        </button>
      </div>

      {w.campuses.length > 0 && (
        <div className="campus-directory__search" role="search" aria-label="Filter campuses">
          <SearchField
            label="Search campuses"
            value={w.campusQuery}
            placeholder="Search by campus name"
            onChange={w.setCampusQuery}
          />
        </div>
      )}

      {w.loading && w.campuses.length === 0 && (
        <output className="empty campus-directory__state">Loading campuses…</output>
      )}

      {!w.loading && w.campuses.length === 0 && !w.listError && (
        <div className="empty campus-directory__state">
          <div className="empty__title">No campuses yet</div>
          <div className="empty__hint">
            Add a campus before creating rooms and scheduling sessions.
          </div>
          <button
            type="button"
            className="btn btn--primary btn--with-icon"
            onClick={() => w.setCreatingCampus(true)}
          >
            <IconPlus /> Add campus
          </button>
        </div>
      )}

      {!w.loading && w.campuses.length > 0 && w.filteredCampuses.length === 0 && (
        <div className="empty campus-directory__state">
          <div className="empty__title">No campus matches “{w.campusQuery.trim()}”</div>
          <div className="empty__hint">Try a shorter name or clear the search.</div>
          <button type="button" className="btn btn--sm" onClick={() => w.setCampusQuery('')}>
            Clear search
          </button>
        </div>
      )}

      {w.filteredCampuses.length > 0 && (
        <>
          <ul className="campus-directory__list" aria-label="Campuses">
            {w.pagedCampuses.rows.map((campus) => {
              const selected = campus.id === w.selectedCampus?.id;
              const totalCapacity = w.campusCapacityById.get(campus.id) ?? 0;
              return (
                <li key={campus.id}>
                  <button
                    type="button"
                    className={`campus-directory__item${selected ? ' campus-directory__item--selected' : ''}`}
                    aria-current={selected ? 'true' : undefined}
                    onClick={() => w.selectCampus(campus.id)}
                  >
                    <span className="campus-directory__select">
                      <span className="campus-directory__name">{campus.name}</span>
                      <span className="campus-directory__count">
                        {campus.roomCount} room{campus.roomCount === 1 ? '' : 's'}
                        {campus.roomCount > 0 ? ` · ${totalCapacity} seats` : ''}
                      </span>
                    </span>
                    <span className="campus-directory__arrow" aria-hidden="true">
                      <IconChevronRight />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <Pager
            label={w.pagedCampuses.label}
            page={w.pagedCampuses.page}
            pageCount={w.pagedCampuses.pageCount}
            canPrev={w.pagedCampuses.canPrev}
            canNext={w.pagedCampuses.canNext}
            onPrev={w.pagedCampuses.prev}
            onNext={w.pagedCampuses.next}
            onGoToPage={w.pagedCampuses.goToPage}
          />
        </>
      )}
    </section>
  );
}
