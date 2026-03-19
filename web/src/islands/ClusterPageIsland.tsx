import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../api/client';
import { ClusterDetail } from '../routes/ClusterDetail';

interface ClusterPageIslandProps {
  dataset?: string;
  clusterId?: string;
  cohort?: string;
}

export function ClusterPageIsland({ dataset = 'tcga', clusterId, cohort = 'PANCAN' }: ClusterPageIslandProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ClusterDetail dataset={dataset} clusterId={clusterId} cohort={cohort} />
    </QueryClientProvider>
  );
}
