import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../api/client';
import { Footer } from '../components/layout/Footer';

export function FooterIsland() {
  return (
    <QueryClientProvider client={queryClient}>
      <Footer />
    </QueryClientProvider>
  );
}
