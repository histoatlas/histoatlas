import type { SlideDetail, SimilarSlide, SlideTile } from '../types';
import { apiPaths } from './paths';

/**
 * Fetch consolidated slide data. The static JSON includes detail, similar
 * slides, and tiles, all in one file.
 */
export async function fetchSlideDetail(
  dataset: string,
  slideId: string,
): Promise<SlideDetail> {
  const response = await fetch(apiPaths.slide(dataset, slideId));
  if (!response.ok) {
    if (response.status === 404) throw new Error('Slide not found');
    throw new Error(`Failed to fetch slide: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Extract similar slides from the consolidated slide data.
 * Uses the same query key as fetchSlideDetail so TanStack Query
 * can share the cached response.
 */
export function extractSimilarSlides(slide: SlideDetail): SimilarSlide[] {
  return slide.similar ?? [];
}

/**
 * Extract tiles for a specific feature from the consolidated slide data.
 */
export function extractSlideTiles(slide: SlideDetail, feature: string): SlideTile[] {
  return slide.tiles?.[feature] ?? [];
}
