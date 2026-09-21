/**
 * Server state for the Stats tab. The payload is one request; every book,
 * shelf and lending mutation invalidates it (see `inventory.ts` / `lending.ts`)
 * so the numbers catch up right after an edit.
 */
import { statsSchema } from '@bookguardian/shared';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { apiRequest } from './client';

export const statsKey = ['stats'] as const;

export const statsQueryOptions = queryOptions({
  queryKey: statsKey,
  queryFn: () => apiRequest('/api/stats', statsSchema),
});

export const useStats = () => useQuery(statsQueryOptions);
