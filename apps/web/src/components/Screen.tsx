import { Link, type LinkProps } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeftIcon } from './icons';

interface ScreenProps {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  /** Secondary line under the title (e.g. a library's location). */
  subtitle?: string;
  /** Renders a back chevron to this route (thumb-reachable, top-left). */
  back?: { to: LinkProps['to']; params?: LinkProps['params'] };
}

/** Common page frame: large title + content, sized for one-handed phone use. */
export function Screen({ title, children, actions, subtitle, back }: ScreenProps) {
  const { t } = useTranslation();
  return (
    <section className="screen">
      <header className="screen__header">
        <div className="screen__heading">
          {back ? (
            <Link
              to={back.to}
              params={back.params}
              className="icon-button screen__back"
              aria-label={t('common.back')}
            >
              <ChevronLeftIcon />
            </Link>
          ) : null}
          <div>
            <h1 className="screen__title">{title}</h1>
            {subtitle ? <p className="screen__subtitle">{subtitle}</p> : null}
          </div>
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}
