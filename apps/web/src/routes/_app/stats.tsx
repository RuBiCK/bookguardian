import { READ_STATUSES, STATS_MONTHS, type Stats, type StatsBucket } from '@bookguardian/shared';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useStats } from '../../api/stats';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { StatsSkeleton } from '../../components/Skeleton';
import { BarRows, type BarRow } from '../../components/stats/BarRows';
import { ColumnChart, type Column } from '../../components/stats/ColumnChart';
import { DonutChart } from '../../components/stats/DonutChart';
import type { ChartLink } from '../../components/stats/links';
import { StatsCard } from '../../components/stats/StatsCard';
import { StatTiles } from '../../components/stats/StatTiles';
import { languageName, monthBounds, monthLabel, yearBounds } from '../../lib/stats';

export const Route = createFileRoute('/_app/stats')({
  component: StatsScreen,
});

/** Read status is ordered (to read → reading → read), so it takes the one-hue ramp. */
const STATUS_COLOR: Record<(typeof READ_STATUSES)[number], string> = {
  to_read: '--chart-ord-1',
  reading: '--chart-ord-2',
  read: '--chart-ord-3',
};

/** A drill-down into the filtered book list. */
const browse = (search: Record<string, string | number>): ChartLink => ({ to: '/books', search });

/**
 * Stats tab: how big the library is and what is in it — a hero row, then one
 * compact chart per dimension. Every number is a tap away from the books
 * behind it.
 */
function StatsScreen() {
  const { t } = useTranslation();
  const stats = useStats();

  return (
    <Screen title={t('stats.title')}>
      {stats.isPending ? (
        <StatsSkeleton />
      ) : stats.data === undefined ? (
        <EmptyState
          title={t('errors.generic')}
          body={t('errors.network')}
          illustration="offline"
          action={
            <button type="button" className="button" onClick={() => void stats.refetch()}>
              {t('common.retry')}
            </button>
          }
        />
      ) : stats.data.totals.books === 0 ? (
        <EmptyState
          title={t('stats.empty.title')}
          body={t('stats.empty.body')}
          illustration="stats"
          action={
            <Link to="/" className="button button--primary">
              {t('nav.library')}
            </Link>
          }
        />
      ) : (
        <StatsBody stats={stats.data} />
      )}
    </Screen>
  );
}

function StatsBody({ stats }: { stats: Stats }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { totals } = stats;

  /** Top-N buckets as bar rows, the folded tail as a last, unlinked "Other". */
  const bucketRows = (
    { top, other }: { top: StatsBucket[]; other: number },
    link: (bucket: StatsBucket) => ChartLink,
    label: (bucket: StatsBucket) => string = (b) => b.key,
  ): BarRow[] => [
    ...top.map((bucket) => ({
      key: bucket.key,
      label: label(bucket),
      count: bucket.count,
      link: link(bucket),
    })),
    ...(other > 0 ? [{ key: '__other', label: t('stats.other'), count: other }] : []),
  ];

  const months: Column[] = stats.readByMonth.map((m, i) => ({
    key: m.month,
    count: m.count,
    label: t('stats.chart.month', { month: monthLabel(m.month, locale, 'long'), count: m.count }),
    // Four ticks across two years: every sixth month, counted from the newest.
    tick:
      (stats.readByMonth.length - 1 - i) % 6 === 0
        ? new Intl.DateTimeFormat(locale, { month: 'short', year: '2-digit' }).format(
            new Date(Number(m.month.slice(0, 4)), Number(m.month.slice(5, 7)) - 1, 1),
          )
        : undefined,
    link: browse(monthBounds(m.month)),
  }));
  const readInWindow = stats.readByMonth.some((m) => m.count > 0);

  const ratings: Column[] = stats.byRating.map((r) => ({
    key: String(r.rating),
    count: r.count,
    label: t('stats.chart.bar', { label: t('reading.stars', { count: r.rating }), count: r.count }),
    tick: t('filters.exactStars', { count: r.rating }),
    link: browse({ rating: r.rating }),
  }));
  const unrated = totals.books - totals.rated;

  return (
    <div className="stats">
      <StatTiles
        tiles={[
          { key: 'books', label: t('stats.hero.books'), value: totals.books, link: browse({}) },
          {
            key: 'read',
            label: t('stats.hero.read'),
            value: totals.read,
            link: browse({ readStatus: 'read' }),
          },
          {
            key: 'toRead',
            label: t('stats.hero.toRead'),
            value: totals.toRead,
            link: browse({ readStatus: 'to_read' }),
          },
          {
            key: 'lent',
            label: t('stats.hero.lent'),
            value: totals.lent,
            link: { to: '/lending' },
          },
        ]}
      />
      {totals.pages > 0 ? (
        <p className="muted stats__pages">{t('stats.pages', { count: totals.pages })}</p>
      ) : null}

      <StatsCard id="status" title={t('stats.section.readStatus')}>
        <DonutChart
          total={totals.books}
          totalLabel={t('stats.hero.books')}
          segments={READ_STATUSES.map((status) => ({
            key: status,
            label: t(`readStatus.${status}`),
            count: stats.byReadStatus[status],
            color: STATUS_COLOR[status],
            link: browse({ readStatus: status }),
          }))}
        />
      </StatsCard>

      <StatsCard
        id="timeline"
        title={t('stats.section.timeline')}
        meta={t('stats.lastMonths', { count: STATS_MONTHS })}
      >
        {readInWindow ? (
          <ColumnChart columns={months} label={t('stats.section.timeline')} />
        ) : (
          <p className="muted">{t('stats.noneRead')}</p>
        )}
      </StatsCard>

      {stats.readByYear.length > 0 ? (
        <StatsCard id="years" title={t('stats.section.years')}>
          <BarRows
            rows={stats.readByYear.map((y) => ({
              key: y.year,
              label: y.year,
              count: y.count,
              link: browse(yearBounds(y.year)),
            }))}
          />
        </StatsCard>
      ) : null}

      <StatsCard
        id="ratings"
        title={t('stats.section.ratings')}
        meta={unrated > 0 ? t('stats.unrated', { count: unrated }) : undefined}
      >
        {totals.rated > 0 ? (
          <ColumnChart columns={ratings} label={t('stats.section.ratings')} />
        ) : (
          <p className="muted">{t('stats.noneYet')}</p>
        )}
      </StatsCard>

      {stats.byLibrary.length > 1 ? (
        <StatsCard id="libraries" title={t('stats.section.libraries')}>
          <BarRows
            rows={stats.byLibrary.map((l) => ({
              key: l.id,
              label: l.name,
              count: l.count,
              link: { to: '/libraries/$libraryId', params: { libraryId: l.id } },
            }))}
          />
        </StatsCard>
      ) : null}

      {stats.byShelf.length > 1 ? (
        <StatsCard id="shelves" title={t('stats.section.shelves')}>
          <BarRows
            rows={stats.byShelf.map((s) => ({
              key: s.id,
              label: stats.byLibrary.length > 1 ? `${s.name} · ${s.libraryName}` : s.name,
              count: s.count,
              link: { to: '/shelves/$shelfId', params: { shelfId: s.id } },
            }))}
          />
        </StatsCard>
      ) : null}

      {stats.byCategory.top.length > 0 ? (
        <StatsCard id="categories" title={t('stats.section.categories')}>
          <BarRows rows={bucketRows(stats.byCategory, (b) => browse({ category: b.key }))} />
        </StatsCard>
      ) : null}

      {stats.byLanguage.top.length > 0 ? (
        <StatsCard id="languages" title={t('stats.section.languages')}>
          <BarRows
            rows={bucketRows(
              stats.byLanguage,
              (b) => browse({ language: b.key }),
              (b) => languageName(b.key, locale),
            )}
          />
        </StatsCard>
      ) : null}

      {stats.topAuthors.top.length > 0 ? (
        <StatsCard id="authors" title={t('stats.section.authors')}>
          <BarRows rows={bucketRows(stats.topAuthors, (b) => browse({ author: b.key }))} />
        </StatsCard>
      ) : null}

      {stats.topPublishers.top.length > 0 ? (
        <StatsCard id="publishers" title={t('stats.section.publishers')}>
          <BarRows rows={bucketRows(stats.topPublishers, (b) => browse({ publisher: b.key }))} />
        </StatsCard>
      ) : null}
    </div>
  );
}
