import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../api/client';
import { fetchSlideDetail } from '../api/slide';

export function useSlideData(dataset: string, slideId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.slide(dataset, slideId ?? ''),
    queryFn: () => fetchSlideDetail(dataset, slideId!),
    enabled: !!slideId,
  });
}
