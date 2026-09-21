import { Link, useNavigate } from '@tanstack/react-router';
import type { ChartLink } from './links';

export interface DonutSegment {
  key: string;
  label: string;
  count: number;
  /** CSS custom property carrying the segment's colour (`--chart-ord-1`). */
  color: string;
  link: ChartLink;
}

interface DonutChartProps {
  segments: DonutSegment[];
  /** The number in the middle (the total) and what it counts. */
  total: number;
  totalLabel: string;
}

const RADIUS = 46;
const STROKE = 14;
const GAP = 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Part-to-whole donut (≤ 6 segments) with the total as the centre figure and
 * a legend that doubles as the tap targets. Segments are separated by a 2px
 * surface gap rather than a stroke.
 */
export function DonutChart({ segments, total, totalLabel }: DonutChartProps) {
  const navigate = useNavigate();
  const shown = segments.filter((s) => s.count > 0);
  const gap = shown.length > 1 ? GAP : 0;
  let offset = 0;
  const arcs = shown.map((segment) => {
    const length = (segment.count / total) * CIRCUMFERENCE;
    const arc = { segment, length: Math.max(0, length - gap), start: offset + gap / 2 };
    offset += length;
    return arc;
  });

  return (
    <div className="donut" data-testid="donut">
      <svg
        className="donut__svg"
        viewBox="0 0 120 120"
        role="img"
        aria-label={`${totalLabel}: ${total.toLocaleString()}`}
      >
        <circle className="donut__track" cx="60" cy="60" r={RADIUS} strokeWidth={STROKE} />
        {arcs.map(({ segment, length, start }) => (
          <circle
            key={segment.key}
            className="donut__segment"
            cx="60"
            cy="60"
            r={RADIUS}
            strokeWidth={STROKE}
            style={{ stroke: `var(${segment.color})` }}
            strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
            strokeDashoffset={-start}
            transform="rotate(-90 60 60)"
            onClick={() => void navigate(segment.link)}
            data-testid={`donut-segment-${segment.key}`}
          >
            <title>{`${segment.label}: ${segment.count.toLocaleString()}`}</title>
          </circle>
        ))}
        <text className="donut__total" x="60" y="60" textAnchor="middle" dominantBaseline="central">
          {total.toLocaleString()}
        </text>
      </svg>
      <ul className="donut__legend">
        {segments.map((segment) => (
          <li key={segment.key}>
            <Link
              to={segment.link.to}
              params={segment.link.params}
              search={segment.link.search}
              className="legend-row"
              data-testid={`legend-${segment.key}`}
            >
              <span
                className="legend-row__swatch"
                style={{ background: `var(${segment.color})` }}
              />
              <span className="legend-row__label">{segment.label}</span>
              <span className="legend-row__value">{segment.count.toLocaleString()}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
