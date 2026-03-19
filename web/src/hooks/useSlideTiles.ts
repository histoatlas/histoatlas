import { useMemo } from 'react';
import { useSlideData } from './useSlideData';
import { extractSlideTiles } from '../api/slide';

/** Derives tiles for a feature from the shared slide query — no extra fetch. */
export function useSlideTiles(
  dataset: string,
  slideId: string | undefined,
  feature: string | undefined,
) {
  const { data: slide, isLoading, error } = useSlideData(dataset, slideId);

  const data = useMemo(
    () => (slide && feature ? extractSlideTiles(slide, feature) : undefined),
    [slide, feature],
  );

  return { data, isLoading, error };
}
