import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../api/client';
import { SlideDetail } from '../routes/SlideDetail';

interface SlidePageIslandProps {
  dataset?: string;
  slideId?: string;
  cohort?: string;
}

export function SlidePageIsland({ dataset = 'tcga', slideId, cohort = 'PANCAN' }: SlidePageIslandProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <SlideDetail dataset={dataset} slideId={slideId} cohort={cohort} />
    </QueryClientProvider>
  );
}
