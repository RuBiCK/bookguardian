# Bookguardian visual language

How the app looks, moves and responds to a thumb. Read this before touching
`apps/web/src/theme/`, adding a screen, or introducing a new control — the
point is that the next feature looks like it was always there.

The source of truth for every value below is `apps/web/src/theme/tokens.css`;
this page explains the intent behind them.

## Principles

1. **One thumb, 390 px.** Everything must work held in one hand on an iPhone
   14 (390×844) and a 360×800 Android phone. Primary actions live at the
   bottom (tab bar, FAB, sheet footers); the top of the screen is for reading,
   not tapping.
2. **Fewest taps.** Defaults do the work (new books land on the last-used
   shelf). Anything a person does often gets a gesture: long-press a cover,
   swipe a row, pull to refresh.
3. **Paper, not glass.** Warm off-white surfaces, one terracotta accent, soft
   shadows. Covers are the colour; the chrome stays quiet.
4. **Optimistic and honest.** Every edit shows at once and rolls back with a
   toast when the server refuses. Offline, the saved library is readable and
   writes fail fast with an explanation — never queued silently.
5. **Motion is information.** Things move to show where they came from or
   went (a cover morphs into its page, a returned book slides out of the
   list). Nothing animates for decoration, and every animation is off under
   `prefers-reduced-motion`.

## Colour

| Token                                  | Light     | Dark      | Use                                                                       |
| -------------------------------------- | --------- | --------- | ------------------------------------------------------------------------- |
| `--bg`                                 | `#f7f4ee` | `#15130f` | Page background                                                           |
| `--bg-elevated`                        | `#fffdf8` | `#211e18` | Cards, sheets, tab bar, inputs on sunken surfaces                         |
| `--bg-sunken`                          | `#ede8df` | `#0f0d0a` | Segmented tracks, cover placeholders, pressed cards                       |
| `--border` / `--border-strong`         |           |           | Hairlines / grips and dividers that must be seen                          |
| `--fg` / `--fg-muted` / `--fg-subtle`  |           |           | Text: body / secondary / hints. All ≥ 4.5:1 on `--bg` and `--bg-elevated` |
| `--accent` / `--accent-strong`         | `#b5542d` | `#e07a4f` | The one brand colour: primary buttons, active tab, links, FAB             |
| `--accent-soft` / `--accent-muted`     |           |           | Tinted chips, icon wells, banners                                         |
| `--success` / `--warning` / `--danger` |           |           | Read badge / reading badge & stars / destructive, overdue                 |
| `--chart-1`, `--chart-ord-1..3`        |           |           | Stats: one hue for single-series bars, an ordinal ramp for read status    |

Rules:

- Never introduce a second hue. Semantic colours (success/warning/danger)
  are for meaning, not decoration.
- Dark mode is a separate palette, not an inversion: surfaces get _lighter_
  as they rise (`--bg` → `--bg-elevated`), shadows get darker, the accent is
  lifted so it keeps contrast on near-black.
- Cover placeholders take their colour from the title (`lib/cover-placeholder.ts`)
  and carry their own text colour, so they read the same in both themes.
- The theme follows the OS unless the person picks one in Settings
  (`data-theme` on `<html>`, persisted).

## Type

System rounded sans (`ui-rounded`, SF Pro Rounded, Segoe UI, Roboto…). Sizes
step by 1.25 from 16 px: `--text-xs` 12 · `--text-sm` 14 · `--text-md` 16 ·
`--text-lg` 20 · `--text-xl` 28 · `--text-2xl` 36.

- Screen titles: `--text-xl`, 700, `--leading-tight`, `--tracking-tight`,
  `text-wrap: balance`. Section titles: `--text-md` 700.
- Body `--leading-body` (1.45); metadata and hints `--text-sm` in `--fg-muted`.
- Inputs are 16 px, always — smaller text makes iOS zoom the page on focus.
- Numbers that line up (counts, dates in lists) use `font-variant-numeric: tabular-nums`.
- Uppercase is only for the small `account__title`-style section labels, with
  `--tracking-caps`.

## Space, shape, elevation

- 4 pt scale: `--space-1` (4) … `--space-8` (32), `--space-10` (40). Screens
  pad `--space-4`; cards pad `--space-3`/`--space-4`; lists gap `--space-2`.
- Radii: `--radius-xs` 6 (focus rings, small pills) · `--radius-sm` 8 (inputs,
  covers, icon wells) · `--radius-md` 14 (cards, buttons) · `--radius-lg` 22
  (sheets, empty states, scanner).
- Shadows are rare and tell you something floats: `--shadow-sm` on covers,
  `--shadow-md` on the FAB and the book hero, `--shadow-lg` on sheets. Cards
  use a hairline border instead.
- Content is capped at `--content-max` (640 px) and centred, so a tablet
  gets a phone layout with margins rather than a stretched one.

## Touch targets and safe areas

- **Every interactive element is at least 44×44 CSS px** (`--tap`). Chips,
  segmented options, "small" buttons, icon buttons, list rows, stars, toasts
  — all of them. The only exception is the twelve full-height month columns
  of the read timeline. `e2e/polish.spec.ts` audits every screen at 390 px
  and 360 px and fails on anything smaller.
- Nothing overflows horizontally. Chip rows scroll sideways inside their own
  container with the scrollbar hidden.
- The app runs standalone with `viewport-fit=cover` and a translucent status
  bar. Use the insets: `--safe-top` on the page, `--safe-bottom` on the tab
  bar, FAB, toasts and sheet footers (or the sheet body when there is no
  footer), `--safe-left/right` on the page sides.
- `:focus-visible` shows a 2 px accent ring with a 2 px offset on everything;
  never remove it. Pointer taps do not show it.

## Components

- **Screen** — large title, optional subtitle and back chevron (top-left,
  reachable), optional actions on the right. A book page replaces the title
  block with a hero (cover + title) that owns the `<h1>`.
- **Tab bar** — five tabs, fixed, blurred, 56 px + safe area. Icons 24 px,
  labels `--text-xs` 600. The active tab is the accent.
- **FAB** — one per screen at most, bottom-right above the tab bar, always
  "add a book".
- **Cards** — hairline border, `--bg-elevated`, 64 px minimum, icon well on
  the left, chevron on the right when they navigate.
- **Book tile** (grid) — 2:3 cover, status badge top-left, lent badge
  top-right, rating bottom-right, two-line title, one-line author. Long-press
  (or right-click) opens quick actions.
- **Book row** (list) — 40 px cover, two-line title, author + badges. Swipe
  left for Lend / Mark read / Move; the `⋯` button opens the same as a sheet
  for keyboard and screen-reader users. The grid/list choice is remembered.
- **Chips** — filters and suggestions. Pressed state = accent border on
  `--accent-soft`. A `<select>` dressed as a chip is the sort control.
- **Segmented** — 2–3 mutually exclusive options (view, status, theme).
  Options are 44 px; the selected one is a raised `--bg-elevated` pill.
- **Sheet** — every secondary flow (add/edit, lend, move, confirm). Springs up
  from the bottom, drag the grip down or tap the scrim to dismiss, Escape
  closes, focus is trapped and returned to the opener. The primary action
  sits in a sticky footer above the home indicator. Never stack two sheets;
  swap them.
- **Toast** — one line, pill, above the tab bar, 3 s, tap to dismiss. Errors
  are `--danger`; offline write errors all say the same thing.
- **Empty state** — an illustration (`components/illustrations.tsx`, line
  drawings in the accent), a short title, one line of help, and the one
  action that fills the list. Never "coming soon".
- **Skeleton** — while data loads, draw the shape of what is coming (grid of
  covers, stack of cards, book hero, stat tiles). Skeletons are
  `role="status" aria-busy="true"`; the individual blocks are hidden from
  assistive tech.
- **Banner** — offline notice (warning tint) and the install invitation
  (dismissable, once). At most one banner per screen, above the content.

## Iconography

One stroked set in `components/icons.tsx`: 24-unit grid, 1.9 stroke, round
caps and joins, `currentColor`. Add icons there, in the same style; never mix
in a second set or filled glyphs (the filled star is the one exception, for
ratings). Icons are decorative (`aria-hidden`) — the control carries the label.

## Motion

Curves and durations live in tokens: `--ease` (standard), `--ease-spring`
(things that arrive), `--ease-out` (things that appear); `--duration-fast`
120 ms (press states), `--duration-base` 220 ms (cross-fades, sheets going
away), `--duration-slow` 360 ms (sheets arriving, list entrances).

What moves, and why:

- **Press states** — buttons, chips, cards, tiles, tab icons scale to
  0.96–0.97 on `:active`. Plus a short vibration on Android (`haptic()`) for
  long-press, swipe commit, rating and status changes.
- **Sheets** — spring up from off-screen, follow a drag on the grip, slide
  down and fade the scrim on close (Web Animations, so the exit is skipped
  where the API is missing).
- **Lists** — items rise in with a 24 ms stagger (`--i` on each `<li>`).
  Same-document changes that remove or reorder rows (returning a book,
  marking one read under a status filter) run inside a View Transition
  (`withViewTransition`), so neighbours slide into the gap instead of jumping.
- **Navigation** — screens cross-fade (`defaultViewTransition` in the
  router); the tab bar and FAB keep their own names so they stay put. The
  last-opened cover carries `view-transition-name: book-cover` in the list
  and the book hero, so it morphs between the two.
- **Pull to refresh** — from the very top, touch only, damped to half the
  finger travel, 64 px arms it; refetches every active query.
- **Loading** — skeleton and cover shimmer, 1.4 s, paused under reduced motion.

Under `prefers-reduced-motion: reduce` every animation and transition is
collapsed to 0.01 ms, view transitions are disabled, haptics are silent, and
pull-to-refresh no longer moves the page (the indicator alone reports state).
`lib/motion.ts` is the single gate: `prefersReducedMotion()`, `canAnimate()`,
`haptic()`, `withViewTransition()`.

## Offline and installation

- The service worker precaches the app shell; the API is never cached by it.
- TanStack Query's cache for libraries, shelves, books, lendings, stats, the
  session and the defaults is persisted to `localStorage`
  (`lib/persist.ts`), restored before the first render and treated as stale,
  so the last copy shows at once and refreshes when a connection exists.
  The snapshot is keyed by app version and cleared on sign-out, on account
  deletion, and when a different account signs in.
- Offline: an amber banner on every screen; reads come from the saved copy;
  writes use `networkMode: 'always'`, fail immediately, roll back, and toast
  "You're offline…". Queries without a saved copy show the retry state, not
  an endless skeleton.
- Install: the Library tab offers a one-time banner (real prompt where the
  browser fires `beforeinstallprompt`, Share → "Add to Home Screen" copy on
  iOS); Settings keeps the option. The manifest is standalone/portrait with
  maskable icons; Android builds its splash from it, iOS shows the in-app
  splash (`components/Splash.tsx`) while the session is checked.

## Accessibility checklist

Before a screen ships:

- Every control has a name (visible label or `aria-label`); icon buttons name
  the object too ("Delete: Top shelf").
- Focus order follows the visual order; sheets trap and return focus; the
  first field of a sheet receives focus so the keyboard opens.
- Text contrast ≥ 4.5:1 in both themes; non-text UI ≥ 3:1. Use the tokens —
  do not tint text with `opacity`.
- Live regions: toasts, skeletons, the offline banner and the refresh
  indicator are `role="status"`; nothing else is, so screen readers are not
  flooded.
- Gestures always have a tap equivalent (swipe → `⋯` button, long-press →
  the book page, pull-to-refresh → data refetches on focus anyway).
- `<html lang>` follows the active locale.

## Reference screenshots

`docs/design/screenshots/` holds the before/after pairs of the polish pass
(BOOK-7) at 390 px in both themes — the visual baseline later work is
compared against. Regenerate the "after" side with the screenshot tour below.

## Checking your work

```sh
pnpm --filter @bookguardian/web exec playwright test polish     # 44px audit, gestures, offline, reduced motion
E2E_SCREENSHOTS=1 pnpm --filter @bookguardian/web exec playwright test screenshots
# → apps/web/playwright-screenshots/{light,dark}/*.png for a visual diff
```
