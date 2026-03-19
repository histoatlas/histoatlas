import type { Slide } from '../types';
import type { RGBAColor } from '../lib/colors';
import {
  createCancerTypeScale,
  createClusterScale,
  createImmuneSubtypeScale,
  createContinuousScale,
  CANCER_TYPE_COLORS,
  CLUSTER_COLORS,
  IMMUNE_SUBTYPE_COLORS,
} from '../lib/colors';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Returns a color function based on the colorBy setting.
 * Handles categorical (cancerType, clusterId, immuneSubtype) and continuous (features).
 */
export function useColorScale(
  colorBy: string,
  slides: Slide[] | undefined
): (slide: Slide) => RGBAColor {
  // Categorical scales
  if (colorBy === 'cancerType') {
    const scale = createCancerTypeScale();
    return (slide: Slide) => scale(slide.cancerType);
  }

  if (colorBy === 'clusterId') {
    const scale = createClusterScale();
    return (slide: Slide) => scale(slide.clusterId || 'unknown');
  }

  if (colorBy === 'immuneSubtype') {
    const scale = createImmuneSubtypeScale();
    return (slide: Slide) => scale(slide.immuneSubtype || 'unknown');
  }

  // Continuous scale for features
  if (!slides || slides.length === 0) {
    return () => [128, 128, 128, 255] as RGBAColor;
  }

  // Compute min/max for the feature
  let min = Infinity;
  let max = -Infinity;
  for (const slide of slides) {
    const value = slide.features[colorBy];
    if (isFiniteNumber(value)) {
      if (value < min) min = value;
      if (value > max) max = value;
    }
  }

  // Fallback if no valid values
  if (!isFinite(min) || !isFinite(max)) {
    return () => [128, 128, 128, 255] as RGBAColor;
  }

  const scale = createContinuousScale(min, max);
  return (slide: Slide) => {
    const value = slide.features[colorBy];
    if (!isFiniteNumber(value)) {
      return [128, 128, 128, 255] as RGBAColor;
    }
    return scale(value);
  };
}

/**
 * Get legend info for the current color mode.
 */
export interface LegendInfo {
  type: 'categorical' | 'continuous';
  title: string;
  entries?: Array<{ key: string; color: string }>;
  min?: number;
  max?: number;
  unit?: string;
}

export function useColorLegendInfo(
  colorBy: string,
  slides: Slide[] | undefined,
  cancerTypes: string[],
  clusters?: Array<{ id: string; name: string }>,
  featureMetadata?: Array<{ name: string; displayName: string; unit: string }>,
): LegendInfo {
  if (colorBy === 'cancerType') {
    return {
      type: 'categorical' as const,
      title: 'Cancer Type',
      entries: cancerTypes.map((t) => ({
        key: t,
        color: CANCER_TYPE_COLORS[t] || '#808080',
      })),
    };
  }

  if (colorBy === 'clusterId') {
    const clusterIds = new Set<string>();
    slides?.forEach((s) => {
      if (s.clusterId) clusterIds.add(s.clusterId);
    });
    const sortedIds = Array.from(clusterIds).sort(
      (a, b) => parseInt(a, 10) - parseInt(b, 10)
    );

    // Build lookup from cluster id to name
    const clusterNameById: Record<string, string> = {};
    clusters?.forEach((c) => {
      clusterNameById[c.id] = c.name;
    });

    return {
      type: 'categorical' as const,
      title: 'Cluster',
      entries: sortedIds.map((id, i) => ({
        key: clusterNameById[id] || `Cluster ${id}`,
        color: CLUSTER_COLORS[i % CLUSTER_COLORS.length],
      })),
    };
  }

  if (colorBy === 'immuneSubtype') {
    return {
      type: 'categorical' as const,
      title: 'Immune Subtype',
      entries: Object.entries(IMMUNE_SUBTYPE_COLORS).map(([key, color]) => ({
        key,
        color: color as string,
      })),
    };
  }

  // Continuous feature
  const meta = featureMetadata?.find((f) => f.name === colorBy);
  const featureTitle = meta?.displayName ?? colorBy;
  const featureUnit = meta?.unit;

  if (!slides || slides.length === 0) {
    return {
      type: 'continuous' as const,
      title: featureTitle,
      min: 0,
      max: 1,
      unit: featureUnit,
    };
  }

  let min = Infinity;
  let max = -Infinity;
  for (const slide of slides) {
    const value = slide.features[colorBy];
    if (isFiniteNumber(value)) {
      if (value < min) min = value;
      if (value > max) max = value;
    }
  }

  return {
    type: 'continuous' as const,
    title: featureTitle,
    min: isFinite(min) ? min : 0,
    max: isFinite(max) ? max : 1,
    unit: featureUnit,
  };
}
