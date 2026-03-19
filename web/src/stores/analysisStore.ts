import { create } from 'zustand';
import type { AnalysisContext } from '../types/analysis';

interface AnalysisState extends AnalysisContext {
  setContext: (partial: Partial<AnalysisContext>) => void;
  resetContext: () => void;
}

const initialContext: AnalysisContext = {
  cancerType: null,
  target: 'survival',
  model: 'unadjusted',
  endpoint: 'os',
  correction: 'bh',
  selection: [],
};

export const useAnalysisStore = create<AnalysisState>((set) => ({
  ...initialContext,

  setContext: (partial) => set((state) => ({ ...state, ...partial })),

  resetContext: () => set(initialContext),
}));
