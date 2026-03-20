import { useMemo } from 'react';
import { useSlideData } from './useSlideData';
import { extractSimilarSlides } from '../api/slide';

/** Derives similar slides from the shared slide query (no extra fetch). */
export function useSimilarSlides(dataset: string, slideId: string | undefined) {
  const { data: slide, isLoading, error } = useSlideData(dataset, slideId);

  const data = useMemo(
    () => (slide ? extractSimilarSlides(slide) : undefined),
    [slide],
  );

  return { data, isLoading, error };
}
