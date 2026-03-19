import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../api/client';
import { MutationHub } from '../routes/MutationHub';

interface MutationHubIslandProps {
  gene: string;
}

export function MutationHubIsland({ gene }: MutationHubIslandProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <MutationHub gene={gene} />
    </QueryClientProvider>
  );
}
