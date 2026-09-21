import { Link } from '@tanstack/react-router';
import type { ChartLink } from './links';

export interface StatTile {
  key: string;
  label: string;
  value: number;
  link: ChartLink;
}

/** The hero row: four headline numbers, each a tap away from its list. */
export function StatTiles({ tiles }: { tiles: StatTile[] }) {
  return (
    <ul className="stat-tiles" data-testid="stat-tiles">
      {tiles.map((tile) => (
        <li key={tile.key}>
          <Link
            to={tile.link.to}
            params={tile.link.params}
            search={tile.link.search}
            className="stat-tile"
            data-testid={`stat-tile-${tile.key}`}
          >
            <span className="stat-tile__value">{tile.value.toLocaleString()}</span>
            <span className="stat-tile__label">{tile.label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
