import type { LinkProps } from '@tanstack/react-router';

/** Where a chart segment leads when tapped: a route with its params / search. */
export interface ChartLink {
  to: LinkProps['to'];
  params?: LinkProps['params'];
  search?: LinkProps['search'];
}
