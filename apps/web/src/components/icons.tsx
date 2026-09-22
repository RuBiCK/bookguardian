import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const base: IconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

export const LibraryIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M4 4h4v16H4zM10 4h4v16h-4zM16.5 5.2l3.8-1 3.7 14.6-3.8 1z" />
  </svg>
);

export const ScanIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" />
    <path d="M7 8v8M10.5 8v8M13.5 8v8M17 8v8" />
  </svg>
);

export const LendingIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M4 12h12M12 8l4 4-4 4" />
    <path d="M20 4v16" />
  </svg>
);

export const StatsIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>
);

export const SettingsIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);

export const BookIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

export const PlusIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const ChevronRightIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

export const ChevronLeftIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
);

export const ArrowUpIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);

export const ArrowDownIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M12 5v14M5 12l7 7 7-7" />
  </svg>
);

export const SearchIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);

export const CloseIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const ShelfIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M3 5h18M3 12h18M3 19h18" />
    <path d="M6 5v7M10 5v7M15 12v7M19 12v7" />
  </svg>
);

export const TrashIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
);

export const PencilIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z" />
    <path d="M13.5 6.5l3 3" />
  </svg>
);

export const StarIcon = ({ filled = false, ...props }: IconProps & { filled?: boolean }) => (
  <svg {...base} {...props} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8z" />
  </svg>
);

export const CameraIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);

export const ImageIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="M21 16l-5-5-7 7M13 14l-2-2-5 5" />
  </svg>
);

export const GridIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

export const ListIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M8 6h13M8 12h13M8 18h13" />
    <path d="M3 6h.01M3 12h.01M3 18h.01" strokeWidth={3} />
  </svg>
);

export const MoreIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <circle cx="5" cy="12" r="1.2" fill="currentColor" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    <circle cx="19" cy="12" r="1.2" fill="currentColor" />
  </svg>
);

export const CheckIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

export const UndoIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </svg>
);

export const MoveIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M9 13h6M13 11l2 2-2 2" />
  </svg>
);

export const RefreshIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M20 12a8 8 0 1 1-2.3-5.7" />
    <path d="M20 4v5h-5" />
  </svg>
);

export const WifiOffIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M2 2l20 20" />
    <path d="M5 12.5a10 10 0 0 1 3.4-2.4M8.5 16a5 5 0 0 1 3.5-1.5M2 9a15 15 0 0 1 5-3" />
    <path d="M12.5 5.1A15 15 0 0 1 22 9M15.6 10.4A10 10 0 0 1 19 12.5" />
    <path d="M12 19.5h.01" strokeWidth={3} />
  </svg>
);

export const DownloadIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M12 4v11M7 10l5 5 5-5" />
    <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
  </svg>
);

export const ShareIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M12 3v12M8 7l4-4 4 4" />
    <path d="M5 11v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8" />
  </svg>
);

export const PhoneIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
    <path d="M10.5 18.5h3" />
  </svg>
);

export const ShieldIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M12 3l7 2.6v5.2c0 4.3-2.8 8.1-7 10.2-4.2-2.1-7-5.9-7-10.2V5.6z" />
    <path d="M9 12l2.2 2.2L15.5 10" />
  </svg>
);

export const ServerIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <rect x="3.5" y="4" width="17" height="6.5" rx="1.8" />
    <rect x="3.5" y="13.5" width="17" height="6.5" rx="1.8" />
    <path d="M7 7.25h.01M7 16.75h.01" strokeWidth={2.6} />
  </svg>
);

/** GitHub's Octocat mark: a filled brand glyph, so it ignores the stroke base. */
export const GithubIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.55v-1.94c-3.2.7-3.88-1.54-3.88-1.54-.52-1.34-1.28-1.7-1.28-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.7 1.26 3.36.97.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.71 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.05 0 0 .97-.31 3.18 1.18a10.9 10.9 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.76.12 3.05.74.81 1.18 1.84 1.18 3.1 0 4.44-2.69 5.41-5.25 5.7.41.36.78 1.06.78 2.14v3.17c0 .3.2.66.79.55A11.5 11.5 0 0 0 23.5 12A11.5 11.5 0 0 0 12 .5z" />
  </svg>
);
