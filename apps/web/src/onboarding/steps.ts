/**
 * The first-session tour, as data: four steps, one per card, each one an
 * illustration plus the translation keys of its copy. Keys are spelled out in
 * full so TypeScript checks every one of them against the dictionary — a
 * renamed or missing key is a build error, not a `onboarding.steps.x.title`
 * showing up on screen.
 *
 * The content is the in-app short form of `docs/user-guide.md`; when the guide
 * changes, this is the other place to look.
 */
import type { ParseKeys } from 'i18next';
import type { ComponentType, SVGProps } from 'react';
import {
  BooksIllustration,
  LendingIllustration,
  ShelvesIllustration,
  StatsIllustration,
} from '../components/illustrations';

export interface TourStep {
  /** Stable id: the sheet's `data-step`, and the React key of the card. */
  id: string;
  /** One of the empty-state line drawings, reused so the tour adds no assets. */
  Illustration: ComponentType<SVGProps<SVGSVGElement>>;
  title: ParseKeys;
  body: ParseKeys;
  /** One line each, in order. */
  items: readonly ParseKeys[];
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'welcome',
    Illustration: ShelvesIllustration,
    title: 'onboarding.steps.welcome.title',
    body: 'onboarding.steps.welcome.body',
    items: [
      'onboarding.steps.welcome.items.hierarchy',
      'onboarding.steps.welcome.items.ready',
      'onboarding.steps.welcome.items.rename',
    ],
  },
  {
    id: 'adding',
    Illustration: BooksIllustration,
    title: 'onboarding.steps.adding.title',
    body: 'onboarding.steps.adding.body',
    items: [
      'onboarding.steps.adding.items.manual',
      'onboarding.steps.adding.items.scan',
      'onboarding.steps.adding.items.ocr',
      'onboarding.steps.adding.items.search',
      'onboarding.steps.adding.items.camera',
    ],
  },
  {
    id: 'lending',
    Illustration: LendingIllustration,
    title: 'onboarding.steps.lending.title',
    body: 'onboarding.steps.lending.body',
    items: [
      'onboarding.steps.lending.items.lend',
      'onboarding.steps.lending.items.one',
      'onboarding.steps.lending.items.due',
      'onboarding.steps.lending.items.overdue',
    ],
  },
  {
    id: 'done',
    Illustration: StatsIllustration,
    title: 'onboarding.steps.done.title',
    body: 'onboarding.steps.done.body',
    items: ['onboarding.steps.done.items.install', 'onboarding.steps.done.items.theme'],
  },
];
