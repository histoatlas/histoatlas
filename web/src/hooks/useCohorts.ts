import { useQuery } from '@tanstack/react-query';
import { apiPaths } from '../api/paths';

export interface Cohort {
  id: string;
  name: string;
  slideCount: number;
}

export function useCohorts(dataset = 'tcga') {
  return useQuery<Cohort[]>({
    queryKey: ['cohorts', dataset],
    queryFn: async () => {
      const res = await fetch(apiPaths.cohorts(dataset));
      if (!res.ok) throw new Error('Failed to load cohorts');
      return res.json();
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
