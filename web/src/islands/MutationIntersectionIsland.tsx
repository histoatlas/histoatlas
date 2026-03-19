import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../api/client';
import { MutationIntersection } from '../routes/MutationIntersection';

interface MutationIntersectionIslandProps {
  gene: string;
  cancerSlug: string;
}

export function MutationIntersectionIsland({ gene, cancerSlug }: MutationIntersectionIslandProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <MutationIntersection gene={gene} cancerSlug={cancerSlug} />
    </QueryClientProvider>
  );
}
