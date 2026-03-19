import { PillToggle } from '../ui/PillToggle';
import { SegmentedControl } from '../ui/SegmentedControl';
import { InfoTooltip } from '../ui/InfoTooltip';
import { Icon } from '../ui/Icon';
import { ToolbarSelect } from '../ui/ToolbarSelect';
import { MolecularFeatureSearch } from './MolecularFeatureSearch';

interface ToolbarProps {
  target: 'survival' | 'molecular';
  // Survival
  endpoint: string;
  onEndpointChange: (endpoint: string) => void;
  availableEndpoints: string[];
  // Shared
  model: string;
  onModelChange: (model: string) => void;
  availableModels: string[];
  // Molecular
  molecularSubTab: string;
  onMolecularSubTabChange: (tab: string) => void;
  molecularFeature: string;
  onMolecularFeatureChange: (f: string) => void;
  categoricalVar: string;
  onCategoricalVarChange: (v: string) => void;
  availableCategoricalVars: string[];
  dataset?: string;
  cohort: string;
}

const ENDPOINT_LABELS: Record<string, string> = {
  os: 'Overall Survival',
  pfs: 'Progression-Free',
  dss: 'Disease-Specific',
  dfs: 'Disease-Free',
};

const MODEL_LABELS: Record<string, string> = {
  unadjusted: 'Unadjusted',
  adjusted: 'Adjusted',
};

const MOLECULAR_SUB_TABS = [
  { id: 'expression', label: 'Expression', icon: 'dna' as const },
  { id: 'pathway', label: 'Pathways', icon: 'workflow' as const },
  { id: 'immune_score', label: 'Immune', icon: 'shield-check' as const },
  { id: 'cnv', label: 'CNV', icon: 'activity' as const },
  { id: 'mutations', label: 'Mutations', icon: 'flask-conical' as const },
];

export function AssociationsToolbar({
  target,
  endpoint,
  onEndpointChange,
  model,
  onModelChange,
  molecularSubTab,
  onMolecularSubTabChange,
  molecularFeature,
  onMolecularFeatureChange,
  categoricalVar,
  onCategoricalVarChange,
  availableEndpoints,
  availableModels,
  availableCategoricalVars,
  dataset = 'tcga',
  cohort,
}: ToolbarProps) {
  return (
    <div className="space-y-3">
      {target === 'survival' && (
        <div className="flex items-center justify-between">
          <PillToggle
            options={availableEndpoints.map((ep) => ({ id: ep, label: ENDPOINT_LABELS[ep] ?? ep.toUpperCase() }))}
            value={endpoint}
            onChange={onEndpointChange}
          />

          <div className="flex items-center gap-1.5">
            <SegmentedControl
              options={availableModels.map((m) => ({ id: m, label: MODEL_LABELS[m] ?? m }))}
              value={model}
              onChange={onModelChange}
            />
            <InfoTooltip text="Unadjusted: Cox PH with the histomic feature only. Adjusted: Cox PH adjusted for age at diagnosis, sex, and pathological stage, stratified by tissue source site (TSS)." />
          </div>
        </div>
      )}

      {target === 'molecular' && (
        <>
          {/* Row 1: sub-tab pills */}
          <PillToggle
            options={MOLECULAR_SUB_TABS.map((st) => ({
              id: st.id,
              label: st.label,
              icon: <Icon name={st.icon} size={16} />,
            }))}
            value={molecularSubTab}
            onChange={onMolecularSubTabChange}
          />

          {/* Row 2: controls for active sub-tab */}
          <div className="flex items-center gap-3">
            {molecularSubTab !== 'mutations' ? (
              <>
                <MolecularFeatureSearch
                  dataset={dataset}
                  cohort={cohort}
                  molecularType={molecularSubTab}
                  value={molecularFeature}
                  onChange={onMolecularFeatureChange}
                />
                <ToolbarSelect
                  label="Model"
                  value={model}
                  onChange={onModelChange}
                  options={availableModels.map((m) => ({ value: m, label: MODEL_LABELS[m] ?? m }))}
                />
                <InfoTooltip text="Unadjusted: Spearman rank correlation with no covariates. Adjusted: partial Spearman correlation, adjusted for age, sex, pathological stage, and TSS (top-5 sites + other)." />
              </>
            ) : (
              <ToolbarSelect
                label="Variable"
                value={categoricalVar}
                onChange={onCategoricalVarChange}
                options={availableCategoricalVars.map((v) => ({
                  value: v,
                  label: v.replace(/^mut_/, '').replace(/_/g, ' '),
                }))}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
