import { useQuery } from '@tanstack/react-query';
import { apiPaths } from '../api/paths';

export interface Dataset {
  id: string;
  displayName: string;
  description: string;
  cancerTypes: number;
  slideCount: number;
}

export function useDatasets() {
  return useQuery<Dataset[]>({
    queryKey: ['datasets'],
    queryFn: async () => {
      const res = await fetch(apiPaths.datasets());
      if (!res.ok) throw new Error('Failed to load datasets');
      return res.json();
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
