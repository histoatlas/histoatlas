import type { Slide, SortState } from '../types';

interface FilterCriteria {
  cancerTypes: string[];
  clusterIds: string[];
  immuneSubtypes: string[];
  stages: string[];
  grades: string[];
  featureRanges: Record<string, [number, number]>;
  globalSearch: string;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Filter slides based on cancer type, cluster, immune subtype, feature range filters, and global search.
 * Empty arrays mean all values pass for that filter.
 */
export function filterSlides(
  slides: Slide[],
  filters: Partial<FilterCriteria>
): Slide[] {
  const {
    cancerTypes = [],
    clusterIds = [],
    immuneSubtypes = [],
    stages = [],
    grades = [],
    featureRanges = {},
    globalSearch = ''
  } = filters;

  const hasTypeFilter = cancerTypes.length > 0;
  const hasClusterFilter = clusterIds.length > 0;
  const hasImmuneFilter = immuneSubtypes.length > 0;
  const hasStageFilter = stages.length > 0;
  const hasGradeFilter = grades.length > 0;
  const hasSearchFilter = globalSearch.trim().length > 0;

  const typeSet = new Set(cancerTypes);
  const clusterSet = new Set(clusterIds);
  const immuneSet = new Set(immuneSubtypes);
  const stageSet = new Set(stages);
  const gradeSet = new Set(grades);
  const searchTerm = globalSearch.trim().toLowerCase();
  const rangeEntries = Object.entries(featureRanges);

  return slides.filter((slide) => {
    // Check cancer type filter
    if (hasTypeFilter && !typeSet.has(slide.cancerType)) {
      return false;
    }

    // Check cluster filter
    if (hasClusterFilter && (!slide.clusterId || !clusterSet.has(slide.clusterId))) {
      return false;
    }

    // Check immune subtype filter
    if (hasImmuneFilter && (!slide.immuneSubtype || !immuneSet.has(slide.immuneSubtype))) {
      return false;
    }

    // Check stage filter
    if (hasStageFilter && (!slide.stage || !stageSet.has(slide.stage))) {
      return false;
    }

    // Check grade filter
    if (hasGradeFilter && (!slide.grade || !gradeSet.has(slide.grade))) {
      return false;
    }

    // Check global search (matches slide ID or cancer type)
    if (hasSearchFilter) {
      const matchesId = slide.id.toLowerCase().includes(searchTerm);
      const matchesType = slide.cancerType.toLowerCase().includes(searchTerm);
      const matchesCluster = slide.clusterId?.toLowerCase().includes(searchTerm) ?? false;
      if (!matchesId && !matchesType && !matchesCluster) {
        return false;
      }
    }

    // Check feature range filters
    for (const [feature, [min, max]] of rangeEntries) {
      const value = slide.features[feature];
      if (!isFiniteNumber(value) || value < min || value > max) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Sort slides by a column. Supports slide properties and feature values.
 */
export function sortSlides(
  slides: Slide[],
  sort: SortState | null
): Slide[] {
  if (!sort) return slides;

  const { column, direction } = sort;
  const multiplier = direction === 'asc' ? 1 : -1;

  return [...slides].sort((a, b) => {
    let aVal: string | number | undefined;
    let bVal: string | number | undefined;

    // Check if sorting by a slide property
    if (column === 'id') {
      aVal = a.id;
      bVal = b.id;
    } else if (column === 'cancerType') {
      aVal = a.cancerType;
      bVal = b.cancerType;
    } else if (column === 'clusterId') {
      aVal = a.clusterId ?? '';
      bVal = b.clusterId ?? '';
    } else if (column === 'immuneSubtype') {
      aVal = a.immuneSubtype ?? '';
      bVal = b.immuneSubtype ?? '';
    } else {
      // Assume it's a feature column
      const aFeatureVal = a.features[column];
      const bFeatureVal = b.features[column];
      const aIsNum = isFiniteNumber(aFeatureVal);
      const bIsNum = isFiniteNumber(bFeatureVal);

      if (aIsNum && bIsNum) {
        aVal = aFeatureVal;
        bVal = bFeatureVal;
      } else if (aIsNum) {
        return -1;
      } else if (bIsNum) {
        return 1;
      } else {
        aVal = '';
        bVal = '';
      }
    }

    // Compare values
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return aVal.localeCompare(bVal) * multiplier;
    }
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return (aVal - bVal) * multiplier;
    }
    return 0;
  });
}

/**
 * Paginate slides array.
 */
export function paginateSlides(
  slides: Slide[],
  pageIndex: number,
  pageSize: number
): Slide[] {
  const start = pageIndex * pageSize;
  return slides.slice(start, start + pageSize);
}

/**
 * Get unique cancer types from slides with counts
 */
export function getCancerTypeCounts(
  slides: Slide[]
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const slide of slides) {
    counts.set(slide.cancerType, (counts.get(slide.cancerType) || 0) + 1);
  }
  return counts;
}

/**
 * Get feature value range from slides
 */
export function getFeatureRange(
  slides: Slide[],
  featureName: string
): [number, number] | null {
  let min = Infinity;
  let max = -Infinity;
  let hasValue = false;

  for (const slide of slides) {
    const value = slide.features[featureName];
    if (isFiniteNumber(value)) {
      hasValue = true;
      if (value < min) min = value;
      if (value > max) max = value;
    }
  }

  return hasValue ? [min, max] : null;
}
