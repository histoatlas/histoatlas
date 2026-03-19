import type { AssociationTarget } from './index';

export interface AnalysisContext {
  cancerType: string | null;
  target: AssociationTarget;
  model: string;
  endpoint: string;
  correction: string;
  selection: string[];
}

export interface EvidenceRef {
  atlasVersion: string;
  bundleVersion: string;
  extractionVersion: string;
  lastUpdated: string;
  pipelineCommitHash?: string;
  pythonVersion?: string;
}

export interface ProvenanceMeta {
  context: AnalysisContext;
  evidence: EvidenceRef;
  generatedAt: string;
}
