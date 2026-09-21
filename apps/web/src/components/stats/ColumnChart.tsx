import { Link } from '@tanstack/react-router';
import type { ChartLink } from './links';

export interface Column {
  key: string;
  count: number;
  /** Full name for the tooltip / accessible label ("March 2026: 2 books"). */
  label: string;
  /** Axis text under the column, when this one gets a tick. */
  tick?: string;
  link?: ChartLink;
}

interface ColumnChartProps {
  columns: Column[];
  /** Accessible name of the whole chart. */
  label: string;
}

/**
 * Columns over an ordered axis (months, star ratings), one hue. Every column
 * is its own tap target the full height of the plot; only the tallest column
 * carries its value, the rest live in the tooltip and the accessible label.
 */
export function ColumnChart({ columns, label }: ColumnChartProps) {
  const max = Math.max(0, ...columns.map((c) => c.count));
  const labelled = max > 0 ? columns.findIndex((c) => c.count === max) : -1;
  return (
    <div className="columns" role="group" aria-label={label}>
      <div className="columns__plot">
        {columns.map((column, i) => {
          const height = max === 0 ? 0 : (column.count / max) * 100;
          const body = (
            <>
              {i === labelled ? (
                <span className="column__value">{column.count.toLocaleString()}</span>
              ) : null}
              <span
                className={`column__bar${column.count === 0 ? ' column__bar--empty' : ''}`}
                style={{ height: `${height}%` }}
                aria-hidden="true"
              />
            </>
          );
          return column.link ? (
            <Link
              key={column.key}
              to={column.link.to}
              params={column.link.params}
              search={column.link.search}
              className="column"
              aria-label={column.label}
              title={column.label}
              data-testid="column"
            >
              {body}
            </Link>
          ) : (
            <span
              key={column.key}
              className="column column--static"
              aria-label={column.label}
              title={column.label}
              data-testid="column"
            >
              {body}
            </span>
          );
        })}
      </div>
      <div className="columns__axis" aria-hidden="true">
        {columns.map((column) => (
          <span key={column.key} className="columns__tick">
            {column.tick ?? ''}
          </span>
        ))}
      </div>
    </div>
  );
}
