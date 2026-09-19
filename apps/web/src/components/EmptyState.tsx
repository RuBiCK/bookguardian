import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BookIcon } from './icons';

interface EmptyStateProps {
  title: string;
  body?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, body, icon, action }: EmptyStateProps) {
  const { t } = useTranslation();
  return (
    <div className="empty" role="status">
      <span className="empty__icon">{icon ?? <BookIcon />}</span>
      <h2 className="empty__title">{title}</h2>
      {body ? <p>{body}</p> : null}
      {action ?? <span className="pill">{t('common.comingSoon')}</span>}
    </div>
  );
}
