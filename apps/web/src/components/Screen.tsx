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
  /**
   * Replace the title block with a custom hero (a book page's cover + title).
   * The header then only carries the back button and actions; the hero is
   * responsible for rendering the page's `<h1>`.
   */
  hero?: ReactNode;
}

/** Common page frame: large title + content, sized for one-handed phone use. */
export function Screen({ title, children, actions, subtitle, back, hero }: ScreenProps) {
  const { t } = useTranslation();
  const backLink = back ? (
    <Link
      to={back.to}
      params={back.params}
      className="icon-button screen__back"
      aria-label={t('common.back')}
    >
      <ChevronLeftIcon />
    </Link>
  ) : null;

  if (hero) {
    return (
      <section className="screen">
        <header className="screen__header screen__header--bar">
          <div className="screen__heading">{backLink}</div>
          {actions}
        </header>
        {hero}
        {children}
      </section>
    );
  }

  return (
    <section className="screen">
      <header className="screen__header">
        <div className="screen__heading">
          {backLink}
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
