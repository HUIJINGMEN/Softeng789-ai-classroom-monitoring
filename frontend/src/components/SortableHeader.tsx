import type { SortState } from '../types';

interface Props<K extends string> {
  columns: { key: K; label: string }[];
  sort: SortState<K>;
  onSort: (key: K) => void;
  trailing?: boolean;
}

export default function SortableHeader<K extends string>({
  columns,
  sort,
  onSort,
  trailing = true
}: Props<K>) {
  return (
    <thead>
      <tr>
        {columns.map((column) => (
          <th
            key={column.key}
            className="is-sortable"
            aria-sort={
              sort.key === column.key ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'
            }
          >
            <button
              type="button"
              className={`table__sort${sort.key === column.key ? ' table__sort--active' : ''}`}
              onClick={() => onSort(column.key)}
              aria-label={`Sort by ${column.label}${
                sort.key === column.key
                  ? sort.dir > 0
                    ? ', currently ascending'
                    : ', currently descending'
                  : ''
              }`}
            >
              {column.label}
              {sort.key === column.key ? (
                <span className="table__sort-dir">{sort.dir > 0 ? 'Asc' : 'Desc'}</span>
              ) : null}
            </button>
          </th>
        ))}
        {trailing && <th />}
      </tr>
    </thead>
  );
}
