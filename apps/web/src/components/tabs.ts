import type { ComponentType, SVGProps } from 'react';
import { LendingIcon, LibraryIcon, ScanIcon, SettingsIcon, StatsIcon } from './icons';

interface Tab {
  to: '/' | '/scan' | '/lending' | '/stats' | '/settings';
  labelKey: 'nav.library' | 'nav.scan' | 'nav.lending' | 'nav.stats' | 'nav.settings';
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export const TABS: readonly Tab[] = [
  { to: '/', labelKey: 'nav.library', Icon: LibraryIcon },
  { to: '/scan', labelKey: 'nav.scan', Icon: ScanIcon },
  { to: '/lending', labelKey: 'nav.lending', Icon: LendingIcon },
  { to: '/stats', labelKey: 'nav.stats', Icon: StatsIcon },
  { to: '/settings', labelKey: 'nav.settings', Icon: SettingsIcon },
];
