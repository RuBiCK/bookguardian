import type { SVGProps } from 'react';

/**
 * Empty-state illustrations: a few strokes in the accent colour on the page
 * background, so they read in light and dark mode without separate assets.
 * They are decorative; the surrounding copy carries the meaning.
 */
type Props = SVGProps<SVGSVGElement>;

const base: Props = {
  viewBox: '0 0 160 120',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  className: 'empty__illustration',
};

/** A shelf with three books, one leaning: "nothing here yet". */
export const BooksIllustration = (props: Props) => (
  <svg {...base} {...props}>
    <path d="M20 96h120" />
    <path d="M28 96V46a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v50" />
    <path d="M52 96V36a3 3 0 0 1 3-3h16a3 3 0 0 1 3 3v60" />
    <path d="M80 96l10.5-53.6a3 3 0 0 1 3.5-2.4l13.7 2.7a3 3 0 0 1 2.4 3.5L100 96" />
    <path d="M34 56h8M58 46h10" opacity="0.5" />
    <path d="M118 62c6-8 16-8 20 0" opacity="0.5" />
    <circle cx="128" cy="40" r="4" opacity="0.5" />
  </svg>
);

/** An empty shelf frame: "no shelves / no libraries". */
export const ShelvesIllustration = (props: Props) => (
  <svg {...base} {...props}>
    <rect x="26" y="20" width="108" height="84" rx="8" />
    <path d="M26 48h108M26 76h108" />
    <path d="M40 48V32M56 48V30M72 48V34" opacity="0.5" />
    <path d="M96 76V62a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v14" opacity="0.5" />
  </svg>
);

/** A book handed over an arrow: "nothing lent out". */
export const LendingIllustration = (props: Props) => (
  <svg {...base} {...props}>
    <rect x="30" y="34" width="44" height="58" rx="5" />
    <path d="M40 48h24M40 58h18" opacity="0.5" />
    <path d="M86 63h40M116 52l12 11-12 11" />
    <path d="M62 100c10 8 26 8 36 0" opacity="0.5" />
  </svg>
);

/** Three empty columns: "nothing to count yet". */
export const StatsIllustration = (props: Props) => (
  <svg {...base} {...props}>
    <path d="M24 98h112" />
    <rect x="40" y="62" width="18" height="36" rx="3" />
    <rect x="71" y="40" width="18" height="58" rx="3" />
    <rect x="102" y="74" width="18" height="24" rx="3" />
    <path d="M44 30c8-10 20-10 28 0" opacity="0.5" />
  </svg>
);

/** A magnifier over a book: "no results". */
export const SearchIllustration = (props: Props) => (
  <svg {...base} {...props}>
    <rect x="28" y="34" width="60" height="64" rx="5" />
    <path d="M40 50h30M40 62h22M40 74h26" opacity="0.5" />
    <circle cx="106" cy="52" r="18" />
    <path d="M119 65l16 16" />
  </svg>
);

/** A cloud with a slash: "can't reach the server". */
export const OfflineIllustration = (props: Props) => (
  <svg {...base} {...props}>
    <path d="M48 90h62a20 20 0 0 0 2-40 28 28 0 0 0-54-6 22 22 0 0 0-10 46z" />
    <path d="M40 30l80 62" />
  </svg>
);
