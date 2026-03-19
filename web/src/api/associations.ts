import type {
  SurvivalAssociationsResponse,
  CorrelationAssociationsResponse,
  CategoricalAssociationsResponse,
  MolecularFeatureListResponse,
} from '../types';
import { apiPaths } from './paths';

export async function fetchAssociationSurvival(
  dataset: string,
  cancerType: string,
  endpoint: string,
  model: string,
): Promise<SurvivalAssociationsResponse> {
  const res = await fetch(apiPaths.associationSurvival(dataset, cancerType, endpoint, model));
  if (res.status === 404) {
    return { cancerType, endpoint, model, nTests: 0, correctionMethod: 'BH', associations: [] };
  }
  if (!res.ok) throw new Error(`Failed to fetch survival associations: ${res.statusText}`);
  return res.json();
}

export async function fetchAssociationCorrelations(
  dataset: string,
  cancerType: string,
  molecularType: string | null,
  model: string,
): Promise<CorrelationAssociationsResponse> {
  const res = await fetch(apiPaths.associationCorrelations(dataset, cancerType, model));
  if (res.status === 404) {
    return { cancerType, molecularType: null, model, nTests: 0, correctionMethod: 'BH', associations: [] };
  }
  if (!res.ok) throw new Error(`Failed to fetch correlation associations: ${res.statusText}`);
  const data: CorrelationAssociationsResponse = await res.json();

  // Client-side filter by molecular type if requested
  if (molecularType && data.associations) {
    return {
      ...data,
      associations: data.associations.filter(
        (a: { molecularType?: string }) => a.molecularType === molecularType,
      ),
    };
  }
  return data;
}

/**
 * Categorical associations: the static file packs all categorical vars
 * into one JSON per (cancer, model). We extract the requested catVar.
 */
export async function fetchAssociationCategorical(
  dataset: string,
  cancerType: string,
  categoricalVar: string,
): Promise<CategoricalAssociationsResponse> {
  // The server default model is "unadjusted"
  const model = 'unadjusted';
  const res = await fetch(apiPaths.associationCategorical(dataset, cancerType, model));
  if (res.status === 404) {
    return { cancerType, categoricalVar, nTests: 0, correctionMethod: 'BH', associations: [] };
  }
  if (!res.ok) throw new Error(`Failed to fetch categorical associations: ${res.statusText}`);

  const data: {
    cancerType: string;
    model: string;
    correctionMethod: string;
    categoricalVars: Record<string, CategoricalAssociationsResponse['associations']>;
  } = await res.json();

  const associations = data.categoricalVars[categoricalVar];
  if (!associations) {
    return { cancerType, categoricalVar, nTests: 0, correctionMethod: data.correctionMethod, associations: [] };
  }

  return {
    cancerType: data.cancerType,
    categoricalVar,
    nTests: associations.length,
    correctionMethod: data.correctionMethod,
    associations,
  };
}

export async function fetchMolecularAssociations(
  dataset: string,
  cancerType: string,
  molecularFeature: string,
  molecularType: string,
  model: string,
): Promise<CorrelationAssociationsResponse> {
  const res = await fetch(
    apiPaths.associationCorrelationsByType(dataset, cancerType, model, molecularType),
  );
  if (res.status === 404) {
    return { cancerType, molecularType, model, nTests: 0, correctionMethod: 'BH', associations: [] };
  }
  if (!res.ok) throw new Error(`Failed to fetch molecular associations: ${res.statusText}`);
  const data: CorrelationAssociationsResponse = await res.json();

  return {
    ...data,
    associations: data.associations.filter(
      (a: { molecularFeature?: string }) => a.molecularFeature === molecularFeature,
    ),
  };
}

export async function fetchMolecularFeatureList(
  dataset: string,
  cancerType: string,
  molecularType: string,
): Promise<MolecularFeatureListResponse> {
  const res = await fetch(apiPaths.molecularFeatures(dataset, cancerType, molecularType));
  if (res.status === 404) return { cancerType, molecularType, features: [] };
  if (!res.ok) throw new Error(`Failed to fetch molecular feature list: ${res.statusText}`);
  return res.json();
}
