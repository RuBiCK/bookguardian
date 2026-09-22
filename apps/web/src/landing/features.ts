import type { ComponentType, SVGProps } from 'react';
import {
  ImageIcon,
  LendingIcon,
  PhoneIcon,
  ScanIcon,
  SearchIcon,
  ServerIcon,
  ShelfIcon,
  ShieldIcon,
  StarIcon,
  StatsIcon,
} from '../components/icons';

/**
 * What the landing page lists, in order: one shipped capability per card.
 * `key` is the i18n key under `landing.features` (`.title` + `.body`), so a
 * card can never exist without copy in every locale.
 */
export const LANDING_FEATURES = [
  { key: 'shelves', Icon: ShelfIcon },
  { key: 'scan', Icon: ScanIcon },
  { key: 'search', Icon: SearchIcon },
  { key: 'covers', Icon: ImageIcon },
  { key: 'reading', Icon: StarIcon },
  { key: 'lending', Icon: LendingIcon },
  { key: 'stats', Icon: StatsIcon },
  { key: 'mobile', Icon: PhoneIcon },
  { key: 'ownership', Icon: ShieldIcon },
  { key: 'selfhost', Icon: ServerIcon },
] as const satisfies readonly { key: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[];
