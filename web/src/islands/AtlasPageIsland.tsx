import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../api/client';
import { AtlasView } from '../routes/AtlasView';

interface AtlasPageIslandProps {
  dataset?: string;
  cohort?: string;
}

export function AtlasPageIsland({ dataset = 'tcga', cohort = 'PANCAN' }: AtlasPageIslandProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AtlasView dataset={dataset} cohort={cohort} />
    </QueryClientProvider>
  );
}
