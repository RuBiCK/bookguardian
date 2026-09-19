import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../components/EmptyState';
import { ScanIcon } from '../components/icons';
import { Screen } from '../components/Screen';

export const Route = createFileRoute('/scan')({
  component: ScanScreen,
});

function ScanScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('scan.title')}>
      <EmptyState title={t('scan.title')} body={t('scan.placeholder')} icon={<ScanIcon />} />
    </Screen>
  );
}
