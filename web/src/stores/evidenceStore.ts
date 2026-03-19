import { create } from 'zustand';
import type { EvidenceMode, EvidenceSelection } from '../types/evidence';

type EntityType = 'feature' | 'slide' | 'cluster';

interface EvidenceState {
  selectedEntityId: string | null;
  selectedEntityType: EntityType | null;
  mode: EvidenceMode;
  selection: EvidenceSelection | null;

  selectEntity: (id: string, type: EntityType) => void;
  setMode: (mode: EvidenceMode) => void;
  setSelection: (selection: EvidenceSelection | null) => void;
  clearEntity: () => void;
}

export const useEvidenceStore = create<EvidenceState>((set) => ({
  selectedEntityId: null,
  selectedEntityType: null,
  mode: 'auto',
  selection: null,

  selectEntity: (id, type) =>
    set({ selectedEntityId: id, selectedEntityType: type }),

  setMode: (mode) => set({ mode }),

  setSelection: (selection) => set({ selection }),

  clearEntity: () =>
    set({
      selectedEntityId: null,
      selectedEntityType: null,
      selection: null,
    }),
}));
