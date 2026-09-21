import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

interface SkeletonProps {
  /** Shape of the placeholder. */
  variant?: 'text' | 'title' | 'block' | 'round' | 'cover';
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  className?: string;
}

/** One shimmering placeholder block; compose them into the shape of the page. */
export function Skeleton({ variant = 'block', width, height, className }: SkeletonProps) {
  const classes = ['skeleton', `skeleton--${variant}`, className].filter(Boolean).join(' ');
  return <span className={classes} style={{ width, height }} aria-hidden="true" />;
}

interface LoadingProps {
  /** How many placeholder items to draw. */
  count?: number;
}

/** Wraps a skeleton layout in the live region screen readers expect. */
function Loading({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-busy="true" aria-label={t('common.loading')} data-testid="skeleton">
      {children}
    </div>
  );
}

/** Cover grid while a shelf loads: same columns as the real grid. */
export function BookGridSkeleton({ count = 6 }: LoadingProps) {
  return (
    <Loading>
      <ul className="book-grid">
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className="skeleton-tile" style={{ '--i': i } as CSSProperties}>
            <Skeleton variant="cover" />
            <Skeleton variant="text" width="80%" />
            <Skeleton variant="text" width="55%" />
          </li>
        ))}
      </ul>
    </Loading>
  );
}

/** Card stack (libraries, shelves, lending rows). */
export function CardListSkeleton({ count = 3 }: LoadingProps) {
  return (
    <Loading>
      <div className="skeleton-stack">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="skeleton-card">
            <Skeleton variant="block" width={40} height={40} />
            <div className="skeleton-card__body">
              <Skeleton variant="title" width="55%" />
              <Skeleton variant="text" width="35%" />
            </div>
          </div>
        ))}
      </div>
    </Loading>
  );
}

/** The book page: cover hero, title lines and the reading card. */
export function BookPageSkeleton() {
  return (
    <Loading>
      <div className="skeleton-hero">
        <Skeleton variant="cover" />
        <Skeleton variant="title" width="70%" />
        <Skeleton variant="text" width="40%" />
      </div>
      <div className="skeleton-block skeleton-stack">
        <Skeleton variant="title" width="40%" />
        <Skeleton variant="block" height={44} />
        <Skeleton variant="block" height={44} />
      </div>
    </Loading>
  );
}

/** Stats: the hero tiles and two chart cards. */
export function StatsSkeleton() {
  return (
    <Loading>
      <div className="stats">
        <ul className="stat-tiles">
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="skeleton-block skeleton-stack">
              <Skeleton variant="title" width="50%" />
              <Skeleton variant="text" width="70%" />
            </li>
          ))}
        </ul>
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="skeleton-block skeleton-stack">
            <Skeleton variant="title" width="40%" />
            <Skeleton variant="block" height={100} />
          </div>
        ))}
      </div>
    </Loading>
  );
}
