/**
 * The public front door at `/`: what Bookguardian is, every feature it already
 * ships, and one way in.
 *
 * It only ever renders for a visitor without a session (`_app.tsx` keeps the
 * app shell — tab bar, pull-to-refresh — off it) and it calls no API of its
 * own, so there is no owner and no server state on this page. It is loaded
 * lazily so the signed-in bundle never carries it.
 */
import { Link } from '@tanstack/react-router';
import { useEffect, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { AppMark } from '../components/AppMark';
import { GithubIcon } from '../components/icons';
import { LANDING_FEATURES } from './features';
import { LanguageSwitcher } from './LanguageSwitcher';

export const REPO_URL = 'https://github.com/RuBiCK/bookguardian';

export default function Landing() {
  const { t } = useTranslation();

  // Crawlers read the tags in index.html; this only keeps the tab honest once
  // the SPA is running, and follows the footer's language switcher.
  useEffect(() => {
    const previous = document.title;
    document.title = t('landing.meta.title');
    return () => {
      document.title = previous;
    };
  }, [t]);

  return (
    <div className="landing" data-testid="landing">
      <main className="landing__main">
        <section className="landing__hero">
          <p className="landing__brand">
            <AppMark />
            {t('app.name')}
          </p>
          <h1 className="landing__title">{t('landing.hero.title')}</h1>
          <p className="landing__lead">{t('landing.hero.body')}</p>

          <div className="landing__actions">
            <Link
              to="/login"
              search={{ redirect: '/' }}
              className="button button--primary button--block"
              data-testid="landing-login"
            >
              {t('landing.hero.cta')}
            </Link>
            <a className="landing__secondary" href={REPO_URL}>
              <GithubIcon />
              {t('landing.hero.repo')}
            </a>
          </div>

          <div className="landing__shot">
            {(['light', 'dark'] as const).map((scheme) => (
              <img
                key={scheme}
                data-scheme={scheme}
                src={`/landing/app-${scheme}.png`}
                alt={t('landing.hero.shot')}
                width={585}
                height={930}
                decoding="async"
              />
            ))}
          </div>
        </section>

        <section className="landing__features" aria-labelledby="landing-features">
          <h2 className="landing__section-title" id="landing-features">
            {t('landing.features.title')}
          </h2>
          <ul className="landing__cards" data-testid="landing-features">
            {LANDING_FEATURES.map(({ key, Icon }, i) => (
              <li key={key} style={{ '--i': i } as CSSProperties}>
                <article className="feature">
                  <span className="feature__icon" aria-hidden="true">
                    <Icon />
                  </span>
                  <div className="feature__body">
                    <h3 className="feature__title">{t(`landing.features.${key}.title`)}</h3>
                    <p className="feature__text">{t(`landing.features.${key}.body`)}</p>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="landing__footer">
        <p className="landing__footer-links">
          <a href={REPO_URL}>{t('landing.footer.repo')}</a>
          <span>{t('landing.footer.licence')}</span>
        </p>
        <LanguageSwitcher />
      </footer>
    </div>
  );
}
