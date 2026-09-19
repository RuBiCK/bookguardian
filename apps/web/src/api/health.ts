import { healthResponseSchema } from '@bookguardian/shared';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { apiRequest } from './client';

export const healthQueryOptions = queryOptions({
  queryKey: ['health'],
  queryFn: () => apiRequest('/api/health', healthResponseSchema),
  staleTime: 30_000,
  retry: 1,
});

export function useHealth() {
  return useQuery(healthQueryOptions);
}
