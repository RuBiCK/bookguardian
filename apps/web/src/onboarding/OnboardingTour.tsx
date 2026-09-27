import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet } from '../components/Sheet';
import { requestAddBook } from '../lib/intents';
import { USER_GUIDE_URL } from '../lib/links';
import { TOUR_STEPS } from './steps';

interface OnboardingTourProps {
  open: boolean;
  /**
   * Finishing, skipping, Escape, the backdrop and a swipe down all land here:
   * the four are the same decision — "I have seen this". The shell decides
   * whether that also has to be remembered on the account.
   */
  onClose: () => void;
}

/**
 * First-session tour: one bottom sheet, four cards, a step per screen of the
 * app (libraries and shelves, the four ways to add a book, lending, and where
 * to go next). Deliberately not coach marks — nothing is anchored to a widget,
 * so it opens over whichever tab the person happens to be on and survives
 * every later redesign of those screens.
 *
 * It is the app's own bottom sheet, so focus is trapped, Escape closes it and
 * the grip can be swiped down, all for free. **Skip** is on every step; the
 * last one leads into adding the first book, with the full user guide a
 * discreet link away.
 *
 * Its own chunk (lazily imported by the app shell): somebody who has already
 * been through it never downloads this file.
 */
export default function OnboardingTour({ open, onClose }: OnboardingTourProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const step = TOUR_STEPS[index]!;
  const last = index === TOUR_STEPS.length - 1;
  const { Illustration } = step;

  /** The closing CTA: remember the tour is done, then land on the add form. */
  const addFirstBook = () => {
    onClose();
    void navigate({ to: '/' }).then(requestAddBook, requestAddBook);
  };

  return (
    <Sheet
      open={open}
      title={t(step.title)}
      onClose={onClose}
      footer={
        <>
          <div className="button-row">
            {index > 0 ? (
              <button
                type="button"
                className="button button--block"
                onClick={() => setIndex(index - 1)}
                data-testid="tour-back"
              >
                {t('common.back')}
              </button>
            ) : null}
            <button
              type="button"
              className="button button--primary button--block"
              onClick={last ? addFirstBook : () => setIndex(index + 1)}
              data-testid={last ? 'tour-cta' : 'tour-next'}
            >
              {last ? t('onboarding.cta') : t('onboarding.next')}
            </button>
          </div>
          <button
            type="button"
            className="button button--ghost button--small button--block tour__skip"
            onClick={onClose}
            data-testid="tour-skip"
          >
            {t('onboarding.skip')}
          </button>
        </>
      }
    >
      {/* Keyed on the step so the card cross-fades in; reduced motion skips it. */}
      <div className="tour" key={step.id} data-testid="tour" data-step={step.id}>
        <Illustration className="tour__illustration" />
        <p className="tour__body">{t(step.body)}</p>
        <ul className="tour__points">
          {step.items.map((item) => (
            <li key={item}>{t(item)}</li>
          ))}
        </ul>
        {last ? (
          <p className="tour__guide">
            <a href={USER_GUIDE_URL} target="_blank" rel="noreferrer">
              {t('onboarding.guide')}
            </a>
          </p>
        ) : null}
        <p className="tour__progress" role="status" data-testid="tour-progress">
          <span aria-hidden="true" className="tour__dots">
            {TOUR_STEPS.map((other, i) => (
              <span key={other.id} className="tour__dot" data-current={i === index || undefined} />
            ))}
          </span>
          {t('onboarding.progress', { current: index + 1, total: TOUR_STEPS.length })}
        </p>
      </div>
    </Sheet>
  );
}
