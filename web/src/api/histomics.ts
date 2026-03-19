import type {
  HistomicsFilters,
  HistomicsSurvivalResponse,
  AssociationKmResponse,
  HistomicsCorrelationsResponse,
  HistomicsCategoricalResponse,
  ScatterPlotResponse,
  ViolinPlotResponse,
  HistomicsTreatmentResponse,
  CrossCancerSurvivalResponse,
} from '../types';
import { apiPaths } from './paths';

// ---------------------------------------------------------------------------
// Consolidated feature file shape
// ---------------------------------------------------------------------------

/** The consolidated histomics/{cancer}/{feature}.json file. */
interface ConsolidatedFeatureFile {
  feature: string;
  cancerType: string;
  survival?: HistomicsSurvivalResponse;
  km?: Record<string, Record<string, AssociationKmResponse>>;
  correlations?: Record<string, HistomicsCorrelationsResponse>;
  categorical?: Record<string, HistomicsCategoricalResponse>;
  treatment?: HistomicsTreatmentResponse;
}

/** Fetch the consolidated feature file (cached by TanStack Query). */
async function fetchFeatureFile(
  dataset: string,
  cancerType: string,
  feature: string,
): Promise<ConsolidatedFeatureFile> {
  const res = await fetch(apiPaths.histomicsFeature(dataset, cancerType, feature));
  if (res.status === 404) {
    // Return empty shell so callers see "no data" instead of an error
    return { feature, cancerType };
  }
  if (!res.ok) throw new Error(`Failed to fetch histomics data for ${feature}/${cancerType}: ${res.statusText}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Public API (same signatures as before)
// ---------------------------------------------------------------------------

export async function fetchHistomicsFilters(dataset: string): Promise<HistomicsFilters> {
  const res = await fetch(apiPaths.histomicsFilters(dataset));
  if (res.status === 404) {
    return { features: [], cancerTypes: [], endpoints: ['os'], models: ['unadjusted'], molecularModels: ['unadjusted'], categoricalVars: [], molecularTypes: [] };
  }
  if (!res.ok) throw new Error(`Failed to fetch histomics filters: ${res.statusText}`);
  return res.json();
}

export async function fetchHistomicsSurvival(
  dataset: string,
  feature: string,
  cancerType: string,
): Promise<HistomicsSurvivalResponse> {
  const file = await fetchFeatureFile(dataset, cancerType, feature);
  if (!file.survival) return { feature, cancerType, results: [] };
  return file.survival;
}

/**
 * KM data: extract the requested endpoint from the consolidated file.
 */
export async function fetchHistomicsKm(
  dataset: string,
  feature: string,
  cancerType: string,
  endpoint: string,
  stratification = 'median',
): Promise<AssociationKmResponse> {
  const file = await fetchFeatureFile(dataset, cancerType, feature);
  const empty: AssociationKmResponse = { feature, cancerType, endpoint, stratification, curves: [] };
  if (!file.km) return empty;
  const endpointData = file.km[endpoint];
  if (!endpointData) return empty;
  const data = endpointData[stratification];
  if (!data) return empty;
  return data;
}

/**
 * Correlations: extract the requested model from the consolidated file.
 */
export async function fetchHistomicsCorrelations(
  dataset: string,
  feature: string,
  cancerType: string,
  molecularType: string | null,
  model = 'unadjusted',
): Promise<HistomicsCorrelationsResponse> {
  const file = await fetchFeatureFile(dataset, cancerType, feature);
  if (!file.correlations) return { feature, cancerType, molecularType: null, model, correlations: [] };
  const data = file.correlations[model];
  if (!data) return { feature, cancerType, molecularType: null, model, correlations: [] };

  // Client-side filter by molecular type if requested
  if (molecularType && data.correlations) {
    return {
      ...data,
      correlations: data.correlations.filter(
        (c: { molecularType?: string }) => c.molecularType === molecularType,
      ),
    };
  }
  return data;
}

/**
 * Categorical: extract the requested model from the consolidated file.
 */
export async function fetchHistomicsCategorical(
  dataset: string,
  feature: string,
  cancerType: string,
  model = 'unadjusted',
): Promise<HistomicsCategoricalResponse> {
  const file = await fetchFeatureFile(dataset, cancerType, feature);
  if (!file.categorical) return { feature, cancerType, model, associations: [] };
  const data = file.categorical[model];
  if (!data) return { feature, cancerType, model, associations: [] };
  return data;
}

/**
 * Scatter plot: loads sample-data and computes the scatter client-side.
 */
export async function fetchHistomicsScatter(
  dataset: string,
  feature: string,
  cancerType: string,
  molecularFeature: string,
  molecularType: string,
): Promise<ScatterPlotResponse> {
  const res = await fetch(apiPaths.sampleData(dataset, cancerType));
  if (!res.ok) throw new Error(`Failed to fetch sample data: ${res.statusText}`);
  const samples: SampleRecord[] = await res.json();

  const caseIds: string[] = [];
  const histomicValues: number[] = [];
  const molecularValues: number[] = [];

  const molKey = `${molecularType}__${molecularFeature}`;

  for (const s of samples) {
    const hVal = s[feature];
    const mVal = s[molKey];
    if (hVal != null && mVal != null && isFinite(hVal as number) && isFinite(mVal as number)) {
      caseIds.push(s.caseId);
      histomicValues.push(hVal as number);
      molecularValues.push(mVal as number);
    }
  }

  if (histomicValues.length < 2) {
    throw new Error(`Not enough overlapping samples for ${feature} vs ${molecularFeature}`);
  }

  // Simple linear regression
  const n = histomicValues.length;
  const sumX = histomicValues.reduce((a, b) => a + b, 0);
  const sumY = molecularValues.reduce((a, b) => a + b, 0);
  const sumXY = histomicValues.reduce((a, x, i) => a + x * molecularValues[i], 0);
  const sumX2 = histomicValues.reduce((a, x) => a + x * x, 0);
  const denom = n * sumX2 - sumX * sumX;
  const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const intercept = (sumY - slope * sumX) / n;
  const xMin = Math.min(...histomicValues);
  const xMax = Math.max(...histomicValues);

  return {
    histomicFeature: feature,
    molecularFeature,
    molecularType,
    n,
    points: { caseIds, histomicValues, molecularValues },
    regression: { slope, intercept, xRange: [xMin, xMax] },
  };
}

/**
 * Violin plot: loads sample-data and groups values client-side.
 */
export async function fetchHistomicsViolin(
  dataset: string,
  feature: string,
  cancerType: string,
  categoricalVar: string,
): Promise<ViolinPlotResponse> {
  const res = await fetch(apiPaths.sampleData(dataset, cancerType));
  if (!res.ok) throw new Error(`Failed to fetch sample data: ${res.statusText}`);
  const samples: SampleRecord[] = await res.json();

  const grouped = new Map<string, number[]>();

  const isMutation = categoricalVar.startsWith('mut_');

  for (const s of samples) {
    const hVal = s[feature];
    const catVal = s[categoricalVar];
    if (hVal == null || catVal == null || !isFinite(hVal as number)) continue;
    // Map mutation 0/1 to readable labels
    const groupName = isMutation
      ? (Number(catVal) === 1 ? 'Mutated' : 'Wild-type')
      : String(catVal);
    if (!grouped.has(groupName)) grouped.set(groupName, []);
    grouped.get(groupName)!.push(hVal as number);
  }

  const groups = Array.from(grouped.entries()).map(([name, values]) => {
    values.sort((a, b) => a - b);
    const n = values.length;
    const median = quantile(values, 0.5);
    const q1 = quantile(values, 0.25);
    const q3 = quantile(values, 0.75);
    return { name, values, median, q1, q3, n };
  });

  return {
    histomicFeature: feature,
    categoricalVar,
    groups,
  };
}

export async function fetchHistomicsCrossCancer(
  dataset: string,
  feature: string,
  endpoint: string,
  model: string,
): Promise<CrossCancerSurvivalResponse> {
  const res = await fetch(apiPaths.histomicsCrossCancer(dataset, feature, endpoint, model));
  if (res.status === 404) {
    return { feature, endpoint, model, results: [], pancan: null };
  }
  if (!res.ok) throw new Error(`Failed to fetch cross-cancer data: ${res.statusText}`);
  return res.json();
}

export async function fetchHistomicsTreatment(
  dataset: string,
  feature: string,
  cancerType: string,
): Promise<HistomicsTreatmentResponse> {
  const file = await fetchFeatureFile(dataset, cancerType, feature);
  if (!file.treatment) return { feature, cancerType, associations: [] };
  return file.treatment;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generic sample record from sample-data JSON files. */
interface SampleRecord {
  caseId: string;
  cancerType: string;
  [key: string]: unknown;
}

/** Quantile from sorted array (linear interpolation). */
function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}
