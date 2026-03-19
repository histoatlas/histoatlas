/** Mutation page API response types. */

export interface GeneFrequency {
  gene: string;
  frequency: number | null;
  nMutated: number;
  nTotal: number;
}

export interface GeneListResponse {
  genes: GeneFrequency[];
}

export interface CancerFrequency {
  cancerType: string;
  frequency: number | null;
  nMutated: number;
  nTotal: number;
}

export interface MutationSurvivalForestEntry {
  cancerType: string;
  hazardRatio: number | null;
  hrCiLower: number | null;
  hrCiUpper: number | null;
  pValueAdj: number | null;
  nSamples: number;
  nEvents: number;
  phFlag: string;
}

export interface GeneOverviewResponse {
  gene: string;
  pancanFrequency: CancerFrequency | null;
  frequencies: CancerFrequency[];
  survivalForest: MutationSurvivalForestEntry[];
  pancanSurvival: MutationSurvivalForestEntry | null;
}

export interface MutationSurvivalResult {
  endpoint: string;
  model: string;
  hazardRatio: number | null;
  hrCiLower: number | null;
  hrCiUpper: number | null;
  pValue: number | null;
  pValueAdj: number | null;
  nSamples: number;
  nEvents: number;
  concordance: number | null;
  phFlag: string;
}

export interface MutationMorphologyAssociation {
  histomicFeature: string;
  effectSize: number | null;
  effectCiLower: number | null;
  effectCiUpper: number | null;
  pValueAdj: number | null;
  isSignificant: boolean;
}

export interface MutationCooccurrence {
  partnerGene: string;
  nBoth: number;
  nAOnly: number;
  nBOnly: number;
  nNeither: number;
  oddsRatio: number | null;
  pValueAdj: number | null;
}

export interface MutationIntersectionResponse {
  gene: string;
  cancerType: string;
  cancerSlug: string;
  frequency: {
    frequency: number | null;
    nMutated: number;
    nTotal: number;
  };
  survival: MutationSurvivalResult[];
  morphology: MutationMorphologyAssociation[];
  cooccurrence: MutationCooccurrence[];
}

export interface MutationKmCurve {
  group: string;
  timePoints: number[];
  survivalProbs: number[];
  ciLower: number[];
  ciUpper: number[];
  censoringTimes: number[];
  censoringProbs: number[];
  nSamples: number;
  nEvents: number;
  medianSurvival: number | null;
}

export interface MutationKmResponse {
  gene: string;
  cancerType: string;
  cancerSlug: string;
  endpoint: string;
  curves: MutationKmCurve[];
}

export interface MorphologyHeatmapCell {
  feature: string;
  cancerType: string;
  effectSize: number | null;
  isSignificant: boolean;
  nSamples: number;
}

export interface MorphologyHeatmapResponse {
  gene: string;
  features: string[];
  featureLabels: string[];
  cancerTypes: string[];
  cells: MorphologyHeatmapCell[];
}
