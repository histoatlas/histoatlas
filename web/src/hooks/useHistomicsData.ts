import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../api/client';
import {
  fetchHistomicsFilters,
  fetchHistomicsSurvival,
  fetchHistomicsKm,
  fetchHistomicsCorrelations,
  fetchHistomicsCategorical,
  fetchHistomicsScatter,
  fetchHistomicsViolin,
  fetchHistomicsTreatment,
  fetchHistomicsCrossCancer,
} from '../api/histomics';

export function useHistomicsFilters(dataset: string) {
  return useQuery({
    queryKey: queryKeys.histomicsFilters(dataset),
    queryFn: () => fetchHistomicsFilters(dataset),
  });
}

export function useHistomicsSurvival(dataset: string, feature: string | null, cancerType: string | null) {
  return useQuery({
    queryKey: queryKeys.histomicsSurvival(dataset, feature ?? '', cancerType ?? ''),
    queryFn: () => fetchHistomicsSurvival(dataset, feature!, cancerType!),
    enabled: !!feature && !!cancerType,
  });
}

export function useHistomicsKm(
  dataset: string,
  feature: string | null,
  cancerType: string | null,
  endpoint: string,
  stratification = 'median',
) {
  return useQuery({
    queryKey: queryKeys.histomicsKm(dataset, feature ?? '', cancerType ?? '', endpoint, stratification),
    queryFn: () => fetchHistomicsKm(dataset, feature!, cancerType!, endpoint, stratification),
    enabled: !!feature && !!cancerType,
  });
}

export function useHistomicsCorrelations(
  dataset: string,
  feature: string | null,
  cancerType: string | null,
  molecularType: string | null,
  model = 'unadjusted',
) {
  return useQuery({
    queryKey: queryKeys.histomicsCorrelations(
      dataset,
      feature ?? '',
      cancerType ?? '',
      molecularType,
      model
    ),
    queryFn: () => fetchHistomicsCorrelations(dataset, feature!, cancerType!, molecularType, model),
    enabled: !!feature && !!cancerType,
  });
}

export function useHistomicsCategorical(
  dataset: string,
  feature: string | null,
  cancerType: string | null,
  model = 'unadjusted'
) {
  return useQuery({
    queryKey: queryKeys.histomicsCategorical(dataset, feature ?? '', cancerType ?? '', model),
    queryFn: () => fetchHistomicsCategorical(dataset, feature!, cancerType!, model),
    enabled: !!feature && !!cancerType,
  });
}

export function useHistomicsScatter(
  dataset: string,
  feature: string | null,
  cancerType: string | null,
  molecularFeature: string | null,
  molecularType: string | null,
) {
  return useQuery({
    queryKey: queryKeys.histomicsScatter(
      dataset,
      feature ?? '',
      cancerType ?? '',
      molecularFeature ?? '',
      molecularType ?? '',
    ),
    queryFn: () => fetchHistomicsScatter(dataset, feature!, cancerType!, molecularFeature!, molecularType!),
    enabled: !!feature && !!cancerType && !!molecularFeature && !!molecularType,
  });
}

export function useHistomicsViolin(
  dataset: string,
  feature: string | null,
  cancerType: string | null,
  categoricalVar: string | null,
) {
  return useQuery({
    queryKey: queryKeys.histomicsViolin(dataset, feature ?? '', cancerType ?? '', categoricalVar ?? ''),
    queryFn: () => fetchHistomicsViolin(dataset, feature!, cancerType!, categoricalVar!),
    enabled: !!feature && !!cancerType && !!categoricalVar,
  });
}

export function useHistomicsTreatment(dataset: string, feature: string | null, cancerType: string | null) {
  return useQuery({
    queryKey: queryKeys.histomicsTreatment(dataset, feature ?? '', cancerType ?? ''),
    queryFn: () => fetchHistomicsTreatment(dataset, feature!, cancerType!),
    enabled: !!feature && !!cancerType,
  });
}

export function useHistomicsCrossCancer(
  dataset: string,
  feature: string | null,
  endpoint: string,
  model: string,
) {
  return useQuery({
    queryKey: queryKeys.histomicsCrossCancer(dataset, feature ?? '', endpoint, model),
    queryFn: () => fetchHistomicsCrossCancer(dataset, feature!, endpoint, model),
    enabled: !!feature,
  });
}
