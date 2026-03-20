// Re-exports from sub-modules
export type { AnalysisContext, EvidenceRef, ProvenanceMeta } from './analysis';
export type { StatSummary, StatWarning } from './stats';
export type {
  GeneFrequency,
  GeneListResponse,
  CancerFrequency,
  MutationSurvivalForestEntry,
  GeneOverviewResponse,
  MutationSurvivalResult,
  MutationMorphologyAssociation,
  MutationCooccurrence,
  MutationIntersectionResponse,
  MutationKmCurve,
  MutationKmResponse,
  MorphologyHeatmapCell,
  MorphologyHeatmapResponse,
} from './mutations';
export { WarningType } from './stats';
export type { WarningSeverity } from './stats';
export { survivalToStatSummary, correlationToStatSummary, categoricalToStatSummary } from './stats';
// Sort state for table
export interface SortState {
  column: string;
  direction: 'asc' | 'desc';
}

// Pagination state for table
export interface PaginationState {
  pageIndex: number;
  pageSize: number;
}

// Atlas filter state
export interface AtlasFilters {
  cancerTypes: string[];
  featureRanges: Record<string, [number, number]>;
  colorBy: string;
  selectedSlideIds: string[];
  // Additional categorical filters
  clusterIds: string[];
  immuneSubtypes: string[];
  stages: string[];
  grades: string[];
  // Global search
  globalSearch: string;
}

// Atlas UI state (non-filter state)
export interface AtlasUIState {
  sort: SortState | null;
  pagination: PaginationState;
  hoveredId: string | null;
}

// Slide data
export interface Slide {
  id: string;
  cancerType: string;
  x: number;
  y: number;
  features: Record<string, number | null>;
  clusterId?: string;
  immuneSubtype?: string;
  stage?: string | null;
  grade?: string | null;
}

// Cluster data
export interface Cluster {
  id: string;
  name: string;
  slideIds: string[];
  centroid: { x: number; y: number };
}

// Feature metadata for UI
export type FeatureCategory =
  | 'composition'
  | 'density'
  | 'morphology'
  | 'spatial'
  | 'heterogeneity';

export interface FeatureMetadata {
  name: string;
  displayName: string;
  category: FeatureCategory;
  unit: string;
  min: number;
  max: number;
  quantiles: {
    p01: number;
    p05: number;
    p50: number;
    p95: number;
    p99: number;
  };
  histogramBins?: number[];
}

// Immune subtype (Thorsson et al.)
export interface ImmuneSubtype {
  id: string;
  name: string;
  description: string;
}

// Tooltip data
export interface TooltipData {
  slide: Slide;
  screenX: number;
  screenY: number;
  color?: [number, number, number, number];
}

// Viewport state
export interface ViewportState {
  zoom: number;
  target: [number, number];
}

// Color mode type
export type ColorMode =
  | 'cancerType'
  | 'clusterId'
  | 'immuneSubtype'
  | { feature: string };

// API response types
export interface AtlasDataResponse {
  slides: Slide[];
  clusters: Cluster[];
  featureNames: string[];
  cancerTypes: string[];
  featureMetadata?: FeatureMetadata[];
  immuneSubtypes?: ImmuneSubtype[];
  dataVersion?: string;
  dataUpdatedAt?: string;
}

// Clinical metadata from GET /api/slide/{id}
export interface ClinicalData {
  age: number | null;
  sex: string | null;
  stage: string | null;
  subtype: string | null;
  immuneSubtype: string | null;
  osStatus: number | null;
  osMonths: number | null;
  mutations: string[];
}

/** Coordinates within a single UMAP embedding (PANCAN or cancer-specific). */
export interface SlideCoords {
  x: number;
  y: number;
  clusterId: string | null;
}

// Slide detail response from GET /api/slide/{id}
export interface SlideDetail {
  id: string;
  cancerType: string;
  pancan: SlideCoords;
  cancerSpecific: SlideCoords;
  features: Record<string, number | null>;
  featurePercentiles: Record<string, number>;
  clinical: ClinicalData | null;
  similar: SimilarSlide[];
  tiles: Record<string, SlideTile[]>;
  maxTileLevel: number | null;
}

// Similar slide from GET /api/slide/{id}/similar
export interface SimilarSlide {
  id: string;
  rank: number;
  distance: number;
  sameCancer: boolean;
  cancerType: string;
  x: number;
  y: number;
}

// Tile from GET /api/slide/{id}/tiles
export interface SlideTile {
  rank: number;
  tileX: number;
  tileY: number;
  tileLevel: number;
  score: number;
  percentile: number;
}

// --- Cluster detail types ---

export interface MutationEnrichment {
  mutation: string;
  oddsRatio: number | null;
  orCiLower: number | null;
  orCiUpper: number | null;
  pValueAdj: number | null;
  nMutatedIn: number;
  nMutatedOut: number;
  riskDifference: number | null;
  isSignificant: boolean;
}

export interface PathwayEnrichment {
  pathwayName: string;
  meanScoreIn: number | null;
  meanScoreOut: number | null;
  scoreDifference: number | null;
  cliffsDelta: number | null;
  cliffsDeltaCiLower: number | null;
  cliffsDeltaCiUpper: number | null;
  pValueAdj: number | null;
  isSignificant: boolean;
}

export interface GseaEnrichment {
  pathwayName: string;
  nes: number | null;
  fdrQValue: number | null;
  isSignificant: boolean;
  leadingEdgeGenes: string[];
  leadingEdgeSize: number;
}

export interface ImmuneEnrichment {
  immuneSubtype: string;
  observed: number;
  expected: number | null;
  ratio: number | null;
  oddsRatio: number | null;
  orCiLower: number | null;
  orCiUpper: number | null;
  pValueAdj: number | null;
  isSignificant: boolean;
}

export interface ClusterTile {
  slideId: string;
  tileX: number;
  tileY: number;
  tileLevel: number;
  score: number;
  maxTileLevel: number | null;
}

export interface FeatureTileGroup {
  featureName: string;
  featureDisplayName: string;
  featureZScore: number;
  tiles: ClusterTile[];
}

export interface SurvivalEndpointSummary {
  hazardRatio: number | null;
  hrCiLower: number | null;
  hrCiUpper: number | null;
  coxPAdj: number | null;
  logRankPAdj: number | null;
  nCluster: number;
  nEventsCluster: number;
  medianSurvivalCluster: number | null;
  medianSurvivalRest: number | null;
  coxPhFlag: string;
  coxSignificantAdj: boolean;
}

export interface ClusterEnrichments {
  mutations: MutationEnrichment[];
  pathways: PathwayEnrichment[];
  gsea: GseaEnrichment[];
  immune: ImmuneEnrichment[];
}

export interface ClusterDetail {
  id: string;
  name: string;
  level: string;
  cancerType?: string;
  nSlides: number;
  cancerComposition?: Record<string, number>;
  enrichments: ClusterEnrichments;
  featureTiles: FeatureTileGroup[];
  survivalSummary: Record<string, SurvivalEndpointSummary>;
}

export interface ClusterSlide {
  id: string;
  cancerType: string;
  x: number | null;
  y: number | null;
  immuneSubtype: string | null;
}

/** Static JSON is a plain array; legacy server format wrapped in an object. */
export type ClusterSlidesResponse = ClusterSlide[];

export interface KmCurve {
  group: string;
  timePoints: number[];
  survivalProbs: number[];
  ciLower: number[];
  ciUpper: number[];
  censoringTimes: number[];
  censoringProbs: number[];
  nSamples: number;
  nEvents: number;
}

export interface ClusterSurvivalStats {
  hazardRatio: number | null;
  hrCiLower: number | null;
  hrCiUpper: number | null;
  coxP: number | null;
  coxPAdj: number | null;
  logRankP: number | null;
  logRankPAdj: number | null;
  coxPhFlag: string;
  coxPhTestP: number | null;
  nCluster: number;
  nEventsCluster: number;
  medianSurvivalCluster: number | null;
  medianSurvivalRest: number | null;
}

export interface ClusterSurvivalResponse {
  clusterId: string;
  endpoint: string;
  curves: KmCurve[];
  stats: ClusterSurvivalStats;
}

// --- Association Explorer types ---

export type AssociationTarget = 'survival' | 'correlations' | 'categorical';
export type EvidenceStrengthBadge =
  | 'insufficient'
  | 'suggestive'
  | 'moderate'
  | 'strong';

export interface AssociationFilters {
  cancerTypes: string[];
  survivalEndpoints: string[];
  survivalModels: string[];
  categoricalVars: string[];
  molecularTypes: string[];
  correlationModels: string[];
}

export interface SurvivalAssociation {
  feature: string;
  hazardRatio: number | null;
  hrCiLower: number | null;
  hrCiUpper: number | null;
  pValue: number | null;
  pValueAdj: number | null;
  nSamples: number;
  nEvents: number;
  concordance: number | null;
  phFlag: string;
  significantRaw: boolean;
  significantAdj: boolean;
  evidenceStrengthBadge: EvidenceStrengthBadge;
  ciWidthCategory: string;
  mdesHrHarmful: number | null;
  mdesHrProtective: number | null;
  rmstDifference: number | null;
  rmstCiLower: number | null;
  rmstCiUpper: number | null;
  rmstPAdj: number | null;
  rmstSignificantAdj: boolean | null;
}

export interface SurvivalAssociationsResponse {
  cancerType: string;
  endpoint: string;
  model: string;
  nTests: number;
  correctionMethod: string;
  associations: SurvivalAssociation[];
}

export interface CorrelationAssociation {
  histomicFeature: string;
  molecularFeature: string;
  molecularType: string;
  targetSetId: string;
  spearmanRho: number | null;
  spearmanP?: number | null;
  spearmanCiLower: number | null;
  spearmanCiUpper: number | null;
  spearmanPAdj: number | null;
  nSamples: number;
  isSignificant: boolean;
  evidenceStrengthBadge: EvidenceStrengthBadge;
  ciWidthCategory: string;
}

export interface CorrelationAssociationsResponse {
  cancerType: string;
  molecularType: string | null;
  model: string;
  nTests: number;
  correctionMethod: string;
  associations: CorrelationAssociation[];
}

export interface CategoricalAssociation {
  histomicFeature: string;
  testType: string;
  effectSizeName: string;
  effectSize: number | null;
  effectCiLower: number | null;
  effectCiUpper: number | null;
  pValue: number | null;
  pValueAdj: number | null;
  nSamples: number;
  groupSizes: Record<string, number>;
  groupMedians: Record<string, number>;
  isSignificant: boolean;
  evidenceStrengthBadge: EvidenceStrengthBadge;
}

export interface CategoricalAssociationsResponse {
  cancerType: string;
  categoricalVar: string;
  nTests: number;
  correctionMethod: string;
  associations: CategoricalAssociation[];
}

export interface MolecularFeatureListResponse {
  cancerType: string;
  molecularType: string;
  features: string[];
}

export interface AssociationKmCurve {
  group: string;
  timePoints: number[];
  survivalProbs: number[];
  ciLower: number[];
  ciUpper: number[];
  nAtRisk: number[];
  censoringTimes: number[];
  censoringProbs: number[];
  nSamples: number;
  nEvents: number;
  medianSurvival: number | null;
}

export interface AssociationKmResponse {
  cancerType: string;
  feature: string;
  endpoint: string;
  stratification: string;
  curves: AssociationKmCurve[];
}

// --- Histomics Feature Detail types ---

export interface HistomicsFilters {
  features: string[];
  cancerTypes: string[];
  endpoints: string[];
  models: string[];
  molecularModels: string[];
  categoricalVars: string[];
  molecularTypes: string[];
}

export interface HistomicsSurvivalResult {
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
  evidenceStrengthBadge: EvidenceStrengthBadge;
  mdesHrHarmful: number | null;
  mdesHrProtective: number | null;
  rmstDifference: number | null;
  rmstCiLower: number | null;
  rmstCiUpper: number | null;
}

export interface HistomicsSurvivalResponse {
  feature: string;
  cancerType: string;
  results: HistomicsSurvivalResult[];
}

export interface HistomicsCorrelation {
  histomicFeature: string;
  molecularFeature: string;
  molecularType: string;
  spearmanRho: number | null;
  spearmanCiLower: number | null;
  spearmanCiUpper: number | null;
  spearmanPAdj: number | null;
  nSamples: number;
  isSignificant: boolean;
  evidenceStrengthBadge: EvidenceStrengthBadge;
}

export interface HistomicsCorrelationsResponse {
  feature: string;
  cancerType: string;
  molecularType: string | null;
  model: string;
  correlations: HistomicsCorrelation[];
}

export interface HistomicsCategoricalAssociation {
  histomicFeature: string;
  categoricalVar: string;
  testType: string;
  effectSizeName: string;
  effectSize: number | null;
  effectCiLower: number | null;
  effectCiUpper: number | null;
  pValue: number | null;
  pValueAdj: number | null;
  nSamples: number;
  groupSizes: Record<string, number>;
  groupMedians: Record<string, number>;
  isSignificant: boolean;
  evidenceStrengthBadge: EvidenceStrengthBadge;
}

export interface HistomicsCategoricalResponse {
  feature: string;
  cancerType: string;
  model: string;
  associations: HistomicsCategoricalAssociation[];
}

export interface TreatmentAssociation {
  treatmentVar: string;
  testStatistic: number | null;
  pValue: number | null;
  pValueAdj: number | null;
  cliffsDelta: number | null;
  cliffsCiLower: number | null;
  cliffsCiUpper: number | null;
  nTreated: number;
  nUntreated: number;
  medianTreated: number | null;
  medianUntreated: number | null;
  dataCompleteness: number | null;
  isSignificant: boolean;
}

export interface HistomicsTreatmentResponse {
  feature: string;
  cancerType: string;
  associations: TreatmentAssociation[];
}

// --- Cross-cancer survival types ---

export interface CrossCancerSurvivalResult {
  cancerType: string;
  hazardRatio: number | null;
  hrCiLower: number | null;
  hrCiUpper: number | null;
  pValueAdj: number | null;
  nSamples: number;
  nEvents: number;
  concordance: number | null;
  phFlag: string;
  evidenceStrengthBadge: EvidenceStrengthBadge;
}

export interface CrossCancerSurvivalResponse {
  feature: string;
  endpoint: string;
  model: string;
  results: CrossCancerSurvivalResult[];
  pancan: CrossCancerSurvivalResult | null;
}

export interface ScatterPlotResponse {
  histomicFeature: string;
  molecularFeature: string;
  molecularType: string;
  n: number;
  points: { caseIds: string[]; histomicValues: number[]; molecularValues: number[] };
  regression: { slope: number; intercept: number; xRange: [number, number] };
}

export interface ViolinGroup {
  name: string;
  values: number[];
  median: number;
  q1: number;
  q3: number;
  n: number;
}

export interface ViolinPlotResponse {
  histomicFeature: string;
  categoricalVar: string;
  groups: ViolinGroup[];
}
