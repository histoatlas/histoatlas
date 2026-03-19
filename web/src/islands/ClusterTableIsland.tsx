import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../api/client';
import { ClusterTable } from '../components/cluster/ClusterTable';

interface ClusterTableIslandProps {
  dataset?: string;
  cohort?: string;
}

export function ClusterTableIsland({ dataset = 'tcga', cohort = 'PANCAN' }: ClusterTableIslandProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ClusterTable dataset={dataset} cohort={cohort} />
    </QueryClientProvider>
  );
}
