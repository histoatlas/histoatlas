import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../api/client';
import { AssociationsHub } from '../routes/AssociationsHub';

interface AssociationsPageIslandProps {
  dataset?: string;
  cohort?: string;
}

export function AssociationsPageIsland({ dataset = 'tcga', cohort = 'PANCAN' }: AssociationsPageIslandProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AssociationsHub dataset={dataset} cohort={cohort} />
    </QueryClientProvider>
  );
}
