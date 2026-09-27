import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { en } from '@bookguardian/shared/i18n';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TOUR_STEPS } from '../src/onboarding/steps';
import { clearIntents } from '../src/lib/intents';
import { installFakeApi, seedFakeApi, type FakeApi } from './fake-api';
import { renderApp, TEST_USER } from './render';

/** The account of somebody who has just signed in for the first time. */
const NEWCOMER = { ...TEST_USER, onboardingCompletedAt: null };

let api: FakeApi;

beforeEach(() => {
  api = installFakeApi();
  seedFakeApi(api);
});
afterEach(() => {
  api.restore();
  clearIntents();
});

const patchCalls = () =>
  api.calls.filter((call) => call.method === 'PATCH' && call.path === '/api/auth/me');

describe('first-session tour', () => {
  it('opens for an account that has never seen it, whatever tab it lands on', async () => {
    api.user = NEWCOMER;
    await renderApp('/lending', { session: NEWCOMER });

    const tour = await screen.findByTestId('tour');
    expect(screen.getByRole('dialog', { name: en.onboarding.steps.welcome.title })).toBeVisible();
    expect(tour).toHaveTextContent(en.onboarding.steps.welcome.body);
    // The screen underneath is the one that was asked for, not a special one.
    expect(screen.getByRole('heading', { level: 1, name: en.lending.title })).toBeInTheDocument();
  });

  it('stays away from an account that already went through it', async () => {
    await renderApp('/');
    expect(
      await screen.findByRole('heading', { level: 1, name: en.library.title }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('tour')).not.toBeInTheDocument();
    expect(patchCalls()).toHaveLength(0);
  });

  it('renders the four steps from the i18n catalogue, forwards and back', async () => {
    api.user = NEWCOMER;
    const user = userEvent.setup();
    await renderApp('/', { session: NEWCOMER });
    await screen.findByTestId('tour');

    for (const [index, step] of TOUR_STEPS.entries()) {
      const copy = en.onboarding.steps[step.id as keyof typeof en.onboarding.steps];
      expect(screen.getByTestId('tour')).toHaveAttribute('data-step', step.id);
      expect(screen.getByRole('dialog', { name: copy.title })).toBeVisible();
      expect(screen.getByTestId('tour')).toHaveTextContent(copy.body);
      expect(within(screen.getByTestId('tour')).getAllByRole('listitem')).toHaveLength(
        Object.keys(copy.items).length,
      );
      expect(screen.getByTestId('tour-progress')).toHaveTextContent(
        `Step ${index + 1} of ${TOUR_STEPS.length}`,
      );
      // Skip is offered on every step; Back only once there is one.
      expect(screen.getByTestId('tour-skip')).toBeVisible();
      expect(screen.queryByTestId('tour-back') === null).toBe(index === 0);
      if (index < TOUR_STEPS.length - 1) await user.click(screen.getByTestId('tour-next'));
    }

    // The last step leads into the first book and links the full guide.
    expect(screen.getByTestId('tour-cta')).toHaveTextContent(en.onboarding.cta);
    expect(screen.getByRole('link', { name: en.onboarding.guide })).toHaveAttribute(
      'href',
      'https://github.com/RuBiCK/bookguardian/blob/main/docs/user-guide.md',
    );

    await user.click(screen.getByTestId('tour-back'));
    expect(screen.getByTestId('tour')).toHaveAttribute('data-step', 'lending');
    expect(patchCalls()).toHaveLength(0);
  });

  it('skipping remembers it on the account and the tour does not come back', async () => {
    api.user = NEWCOMER;
    const user = userEvent.setup();
    const { queryClient } = await renderApp('/', { session: NEWCOMER });
    await screen.findByTestId('tour');

    await user.click(screen.getByTestId('tour-skip'));
    await waitFor(() => expect(screen.queryByTestId('tour')).not.toBeInTheDocument());
    expect(patchCalls()).toEqual([
      { method: 'PATCH', path: '/api/auth/me', body: { onboardingCompleted: true } },
    ]);
    await waitFor(() => expect(api.user?.onboardingCompletedAt).not.toBeNull());

    // A fresh launch of the same account: nothing cached, and the API now
    // says it is done, so the shell must not open the tour again.
    queryClient.clear();
    api.calls.length = 0;
    cleanup();
    await renderApp('/', { session: 'fetch' });
    expect(
      await screen.findByRole('heading', { level: 1, name: en.library.title }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('tour')).not.toBeInTheDocument();
    expect(patchCalls()).toHaveLength(0);
  });

  it("finishing it lands on the Library tab's add-book sheet", async () => {
    api.user = NEWCOMER;
    const user = userEvent.setup();
    await renderApp('/lending', { session: NEWCOMER });
    await screen.findByTestId('tour');

    for (let i = 0; i < TOUR_STEPS.length - 1; i++) {
      await user.click(screen.getByTestId('tour-next'));
    }
    await user.click(screen.getByTestId('tour-cta'));

    expect(await screen.findByRole('dialog', { name: en.books.add })).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: en.library.title })).toBeInTheDocument();
    expect(patchCalls()).toHaveLength(1);
  });

  it('the Settings entry re-opens it without touching the stored state', async () => {
    const user = userEvent.setup();
    await renderApp('/settings');
    expect(await screen.findByTestId('replay-tour')).toBeVisible();
    expect(screen.queryByTestId('tour')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('replay-tour'));
    expect(await screen.findByTestId('tour')).toHaveAttribute('data-step', 'welcome');

    await user.click(screen.getByTestId('tour-skip'));
    await waitFor(() => expect(screen.queryByTestId('tour')).not.toBeInTheDocument());
    // Nothing was written: it was already remembered.
    expect(patchCalls()).toHaveLength(0);
    expect(api.user?.onboardingCompletedAt).toBe(TEST_USER.onboardingCompletedAt);
  });

  it('an empty shelf offers the tour to somebody who skipped it', async () => {
    const user = userEvent.setup();
    const { shelf } = seedFakeApi(api);
    await renderApp(`/shelves/${shelf.id}`);

    await user.click(await screen.findByTestId('empty-tour'));
    expect(await screen.findByTestId('tour')).toBeVisible();
    expect(patchCalls()).toHaveLength(0);
  });
});
