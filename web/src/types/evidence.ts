export interface EvidenceTile {
  tileId: string;
  slideId: string;
  cancerType?: string;
  rank: number;
  score: number | null;
  percentile: number | null;
  imageUrl: string;
  metadata: Record<string, string | number | null>;
}

export interface EvidenceGroup {
  label: string;
  tiles: EvidenceTile[];
}

export type EvidenceMode = 'auto' | 'selected' | 'compare';

export interface EvidenceSelection {
  mode: EvidenceMode;
  groups: EvidenceGroup[];
  featureName?: string;
}
