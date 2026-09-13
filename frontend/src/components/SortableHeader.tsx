import type { SortState } from '../types';
import { IconSort } from './icons';

interface Props<K extends string> {
  columns: {
    key: K;
    label: string;
    width?: string;
    sortable?: boolean;
    priority?: boolean;
  }[];
  sort: SortState<K>;
  onSort: (key: K) => void;
  trailing?: boolean;
  trailingLabel?: string;
}

export default function SortableHeader<K extends string>({
  columns,
  sort,
  onSort,
  trailing = true,
  trailingLabel = 'Actions'
}: Props<K>) {
  return (
    <thead>
      <tr>
        {columns.map((column) => {
          const isSortable = column.sortable !== false;
          const isActive = isSortable && sort.key === column.key;
          const direction = isActive ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none';

          return (
            <th
              key={column.key}
              className={isSortable ? 'is-sortable' : undefined}
              style={column.width ? { width: column.width } : undefined}
              aria-sort={isActive ? direction : undefined}
            >
              {isSortable ? (
                <button
                  type="button"
                  className={`table__sort${isActive ? ' table__sort--active' : ''}${
                    column.priority ? ' table__sort--priority' : ''
                  }`}
                  onClick={() => onSort(column.key)}
                  aria-label={
                    isActive
                      ? `Sort by ${column.label}, currently ${direction}; activate for ${
                          sort.dir > 0 ? 'descending' : 'ascending'
                        }`
                      : `Sort by ${column.label}, ascending`
                  }
                >
                  <span>{column.label}</span>
                  <span className="table__sort-icon" aria-hidden="true">
                    <IconSort direction={direction} />
                  </span>
                </button>
              ) : (
                <span className="table__heading-label">{column.label}</span>
              )}
            </th>
          );
        })}
        {trailing && <th>{trailingLabel}</th>}
      </tr>
    </thead>
  );
}
