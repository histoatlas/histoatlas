import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../api/client';
import { CohortListing } from '../routes/CohortListing';

export function CohortListingIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <CohortListing />
    </QueryClientProvider>
  );
}
