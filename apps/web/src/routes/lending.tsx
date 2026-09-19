import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../components/EmptyState';
import { LendingIcon } from '../components/icons';
import { Screen } from '../components/Screen';

export const Route = createFileRoute('/lending')({
  component: LendingScreen,
});

export function LendingScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('lending.title')}>
      <EmptyState
        title={t('lending.empty.title')}
        body={t('lending.empty.body')}
        icon={<LendingIcon />}
      />
    </Screen>
  );
}
