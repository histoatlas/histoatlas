import { useQuery } from '@tanstack/react-query';
import { apiPaths } from '../api/paths';

interface ReadyResponse {
  ready: boolean;
  bundle_version: string;
}

export function useBundleVersion() {
  return useQuery<string>({
    queryKey: ['bundle-version'],
    queryFn: async () => {
      const res = await fetch(apiPaths.ready());
      if (!res.ok) return 'unknown';
      const data: ReadyResponse = await res.json();
      return data.bundle_version ?? 'unknown';
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
