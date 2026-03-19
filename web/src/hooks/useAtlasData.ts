import { useQuery } from '@tanstack/react-query';
import { fetchAtlasData, queryKeys } from '../api/client';

export function useAtlasData(dataset = 'tcga', cohort = 'PANCAN', enabled = true) {
  return useQuery({
    queryKey: queryKeys.atlas(dataset, cohort),
    queryFn: () => fetchAtlasData(dataset, cohort),
    enabled,
  });
}
