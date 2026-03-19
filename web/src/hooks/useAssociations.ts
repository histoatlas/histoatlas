import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../api/client';
import {
  fetchAssociationSurvival,
  fetchAssociationCorrelations,
  fetchAssociationCategorical,
  fetchMolecularAssociations,
  fetchMolecularFeatureList,
} from '../api/associations';

export function useAssociationSurvival(
  dataset: string,
  cancerType: string | null,
  endpoint: string,
  model: string,
) {
  return useQuery({
    queryKey: queryKeys.survivalAssociations(dataset, cancerType ?? '', endpoint, model),
    queryFn: () => fetchAssociationSurvival(dataset, cancerType!, endpoint, model),
    enabled: !!cancerType,
  });
}

export function useAssociationCorrelations(
  dataset: string,
  cancerType: string | null,
  molecularType: string | null,
  model: string,
) {
  return useQuery({
    queryKey: queryKeys.correlationAssociations(dataset, cancerType ?? '', molecularType, model),
    queryFn: () => fetchAssociationCorrelations(dataset, cancerType!, molecularType, model),
    enabled: !!cancerType,
  });
}

export function useAssociationCategorical(
  dataset: string,
  cancerType: string | null,
  categoricalVar: string | null,
) {
  return useQuery({
    queryKey: queryKeys.categoricalAssociations(dataset, cancerType ?? '', categoricalVar ?? ''),
    queryFn: () => fetchAssociationCategorical(dataset, cancerType!, categoricalVar!),
    enabled: !!cancerType && !!categoricalVar,
  });
}

export function useMolecularAssociations(
  dataset: string,
  cancerType: string | null,
  molecularFeature: string | null,
  molecularType: string,
  model: string,
) {
  return useQuery({
    queryKey: queryKeys.molecularAssociations(dataset, cancerType ?? '', molecularFeature ?? '', molecularType, model),
    queryFn: () => fetchMolecularAssociations(dataset, cancerType!, molecularFeature!, molecularType, model),
    enabled: !!cancerType && !!molecularFeature,
  });
}

export function useMolecularFeatureList(
  dataset: string,
  cancerType: string | null,
  molecularType: string | null,
) {
  return useQuery({
    queryKey: queryKeys.molecularFeatureList(dataset, cancerType ?? '', molecularType ?? ''),
    queryFn: () => fetchMolecularFeatureList(dataset, cancerType!, molecularType!),
    enabled: !!cancerType && !!molecularType,
  });
}
