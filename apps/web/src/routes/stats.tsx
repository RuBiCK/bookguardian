import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../components/EmptyState';
import { StatsIcon } from '../components/icons';
import { Screen } from '../components/Screen';

export const Route = createFileRoute('/stats')({
  component: StatsScreen,
});

export function StatsScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('stats.title')}>
      <EmptyState title={t('stats.title')} body={t('stats.placeholder')} icon={<StatsIcon />} />
    </Screen>
  );
}
