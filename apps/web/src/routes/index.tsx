import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../components/EmptyState';
import { Screen } from '../components/Screen';

export const Route = createFileRoute('/')({
  component: LibraryScreen,
});

export function LibraryScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('library.title')}>
      <EmptyState title={t('library.empty.title')} body={t('library.empty.body')} />
    </Screen>
  );
}
