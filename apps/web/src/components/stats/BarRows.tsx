import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { ChartLink } from './links';

export interface BarRow {
  key: string;
  label: string;
  count: number;
  /** Where the row leads; a row without one (the "Other" fold) is plain text. */
  link?: ChartLink;
}

interface BarRowsProps {
  rows: BarRow[];
  /** Overrides the longest bar's reference (defaults to the largest count). */
  max?: number;
}

/**
 * Horizontal bars for one nominal dimension (libraries, categories…): one
 * hue, largest first, label left and the value at the tip. The rows *are*
 * the table view, so nothing depends on colour or hover.
 */
export function BarRows({ rows, max }: BarRowsProps) {
  const { t } = useTranslation();
  const reference = Math.max(1, max ?? Math.max(0, ...rows.map((r) => r.count)));
  return (
    <ul className="bar-rows">
      {rows.map((row) => {
        const body = (
          <>
            <span className="bar-row__label">{row.label}</span>
            <span className="bar-row__track" aria-hidden="true">
              <span
                className="bar-row__fill"
                style={{ width: `${Math.round((row.count / reference) * 1000) / 10}%` }}
              />
            </span>
            <span className="bar-row__value">{row.count.toLocaleString()}</span>
          </>
        );
        const label = t('stats.chart.bar', { label: row.label, count: row.count });
        return (
          <li key={row.key} data-testid="bar-row">
            {row.link ? (
              <Link
                to={row.link.to}
                params={row.link.params}
                search={row.link.search}
                className="bar-row"
                aria-label={label}
                title={label}
              >
                {body}
              </Link>
            ) : (
              <span className="bar-row bar-row--static" title={label}>
                {body}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
