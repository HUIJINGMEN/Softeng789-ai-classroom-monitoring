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

type SortDirection = 'none' | 'ascending' | 'descending';

function activeDirection(isActive: boolean, direction: 1 | -1): SortDirection {
  if (!isActive) return 'none';
  return direction > 0 ? 'ascending' : 'descending';
}

function sortButtonLabel(label: string, direction: SortDirection, currentDirection: 1 | -1): string {
  if (direction === 'none') return `Sort by ${label}, ascending`;
  const nextDirection = currentDirection > 0 ? 'descending' : 'ascending';
  return `Sort by ${label}, currently ${direction}; activate for ${nextDirection}`;
}

function sortButtonClass(isActive: boolean, isPriority: boolean): string {
  return [
    'table__sort',
    isActive ? 'table__sort--active' : '',
    isPriority ? 'table__sort--priority' : ''
  ].filter(Boolean).join(' ');
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
          const direction = activeDirection(isActive, sort.dir);

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
                  className={sortButtonClass(isActive, Boolean(column.priority))}
                  onClick={() => onSort(column.key)}
                  aria-label={sortButtonLabel(column.label, direction, sort.dir)}
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
        {trailing && <th className="table__action-cell">{trailingLabel}</th>}
      </tr>
    </thead>
  );
}
