import type { SVGProps } from 'react';

/** The app icon (public/icons/icon.svg) as an inline mark for splash and login. */
export function AppMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 512 512" className="app-mark" aria-hidden="true" {...props}>
      <rect width="512" height="512" rx="112" fill="var(--accent)" />
      <g fill="var(--accent-contrast)">
        <rect x="112" y="128" width="72" height="256" rx="10" />
        <rect x="208" y="128" width="72" height="256" rx="10" />
        <rect x="292" y="140" width="72" height="256" rx="10" transform="rotate(-14 328 268)" />
      </g>
    </svg>
  );
}
