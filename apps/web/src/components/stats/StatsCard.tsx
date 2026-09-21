import type { ReactNode } from 'react';

interface StatsCardProps {
  id: string;
  title: string;
  /** Secondary line under the title ("Last 24 months", "3 books not rated"). */
  meta?: string;
  children: ReactNode;
}

/** One chart on the Stats tab: a titled card sized for a 390px column. */
export function StatsCard({ id, title, meta, children }: StatsCardProps) {
  return (
    <section className="stats-card" aria-labelledby={`stats-${id}`} data-testid={`stats-${id}`}>
      <header className="stats-card__header">
        <h2 id={`stats-${id}`} className="stats-card__title">
          {title}
        </h2>
        {meta ? <p className="stats-card__meta">{meta}</p> : null}
      </header>
      {children}
    </section>
  );
}
