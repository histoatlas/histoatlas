import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../api/client';
import { HistomicsDetail } from '../routes/HistomicsDetail';

interface HistomicsPageIslandProps {
  dataset?: string;
  feature?: string;
  cohort?: string;
}

export function HistomicsPageIsland({ dataset = 'tcga', feature, cohort = 'PANCAN' }: HistomicsPageIslandProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <HistomicsDetail dataset={dataset} feature={feature} cohort={cohort} />
    </QueryClientProvider>
  );
}
