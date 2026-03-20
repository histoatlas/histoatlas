import { useCallback, useEffect, useMemo } from "react";
import { useQueryParamState } from "../hooks/useQueryParamState";
import { useHistomicsFilters } from "../hooks/useHistomicsData";
import {
  useAssociationSurvival,
  useAssociationCategorical,
  useAssociationCorrelations,
  useMolecularAssociations,
} from "../hooks/useAssociations";
import { Icon } from "../components/ui/Icon";
import { CohortSelector } from "../components/ui/CohortSelector";
import { EmptyState } from "../components/ui/EmptyState";
import { SectionCard } from "../components/ui/SectionCard";
import { TabNav } from "../components/ui/TabNav";
import { ProvenanceBar } from "../components/ui/ProvenanceBar";
import {
  AssociationsToolbar,
  AssociationsRankedTable,
  VolcanoPlot,
} from "../components/associations";
import { ExportActions } from "../components/ui/ExportActions";
import { downloadCSV } from "../lib/export";
import { formatP, formatNum, formatHR } from "../lib/formatters";
import type { AssociationTarget } from "../types";

const VALID_TARGETS = ["survival", "molecular"] as const;
const VALID_MOL_SUBS = [
  "expression",
  "pathway",
  "immune_score",
  "cnv",
  "mutations",
] as const;

interface AssociationsHubProps {
  dataset?: string;
  cohort?: string;
}

export function AssociationsHub({ dataset = "tcga", cohort = "PANCAN" }: AssociationsHubProps) {
  useEffect(() => {
    const el = document.getElementById('ssr-header');
    if (el) el.style.display = 'none';
  }, []);

  const [targetParam, setTargetParam] = useQueryParamState(
    "target",
    "survival",
  );
  const [endpointParam, setEndpointParam] = useQueryParamState(
    "endpoint",
    "os",
  );
  const [modelParam, setModelParam] = useQueryParamState("model", "unadjusted");
  const [molSubParam, setMolSubParam] = useQueryParamState("mol_sub", "");
  const [molFeatureParam, setMolFeatureParam] = useQueryParamState(
    "mol_feature",
    "",
  );
  const [catVarParam, setCatVarParam] = useQueryParamState("cat_var", "");

  // Backward compatibility: redirect legacy targets
  const target: "survival" | "molecular" = (() => {
    if (
      targetParam === "correlations" ||
      targetParam === "categorical" ||
      targetParam === "molecular"
    )
      return "molecular";
    if ((VALID_TARGETS as readonly string[]).includes(targetParam))
      return targetParam as "survival" | "molecular";
    return "survival";
  })();

  // If legacy categorical target, default mol_sub to mutations
  const molSubTab = (() => {
    if (targetParam === "categorical" && !molSubParam) return "mutations";
    if (
      molSubParam &&
      (VALID_MOL_SUBS as readonly string[]).includes(molSubParam)
    )
      return molSubParam;
    return "expression";
  })();

  // Load filter options
  const { data: filters } = useHistomicsFilters(dataset);

  const availableEndpoints = useMemo(
    () => filters?.endpoints ?? ["os", "pfs", "dfs", "dss"],
    [filters],
  );
  const availableSurvivalModels = useMemo(
    () => filters?.models ?? ["unadjusted"],
    [filters],
  );
  const availableMolecularModels = useMemo(
    () => filters?.molecularModels ?? ["unadjusted"],
    [filters],
  );
  const availableCategoricalVars = useMemo(
    () => filters?.categoricalVars ?? [],
    [filters],
  );

  // Default categorical var to first available if empty
  const effectiveCatVar =
    catVarParam ||
    (availableCategoricalVars.length > 0 ? availableCategoricalVars[0] : "");

  // Render target for chart components (they use 'correlations' | 'categorical')
  const renderTarget: AssociationTarget =
    molSubTab === "mutations" ? "categorical" : "correlations";

  // A feature is selected when the user has typed a molecular feature and we're not on mutations
  const hasFeatureSelected = !!molFeatureParam && molSubTab !== "mutations";

  // Fetch data for active target only
  const survivalQuery = useAssociationSurvival(
    dataset,
    target === "survival" ? cohort : null,
    endpointParam,
    modelParam,
  );
  // Per-feature query: used when a specific molecular feature is selected (any non-mutation sub-tab)
  const molecularQuery = useMolecularAssociations(
    dataset,
    target === "molecular" && hasFeatureSelected ? cohort : null,
    molFeatureParam || null,
    molSubTab,
    modelParam,
  );
  // Overview query: show all correlations of that type when no feature is selected.
  // Skip for "expression": too many genes for a useful overview (EmptyState shown instead).
  const correlationsQuery = useAssociationCorrelations(
    dataset,
    target === "molecular" && !hasFeatureSelected && molSubTab !== "mutations" && molSubTab !== "expression" ? cohort : null,
    molSubTab,
    modelParam,
  );
  const categoricalQuery = useAssociationCategorical(
    dataset,
    target === "molecular" && molSubTab === "mutations" ? cohort : null,
    effectiveCatVar || null,
  );

  // Pick the active molecular query: per-feature when selected, overview otherwise
  const activeMolecularQuery = hasFeatureSelected ? molecularQuery : correlationsQuery;

  const isLoading =
    (target === "survival" && survivalQuery.isLoading) ||
    (target === "molecular" &&
      molSubTab !== "mutations" &&
      activeMolecularQuery.isLoading) ||
    (target === "molecular" &&
      molSubTab === "mutations" &&
      categoricalQuery.isLoading);

  const buildHref = useCallback(
    (selected: string) => {
      const params = new URLSearchParams();
      if (target !== "survival") params.set("target", target);
      if (endpointParam !== "os") params.set("endpoint", endpointParam);
      if (modelParam !== "unadjusted") params.set("model", modelParam);
      if (molSubParam) params.set("mol_sub", molSubParam);
      if (molFeatureParam) params.set("mol_feature", molFeatureParam);
      if (effectiveCatVar) params.set("cat_var", effectiveCatVar);
      const qs = params.toString();
      return `/${dataset}/${selected}/associations/${qs ? `?${qs}` : ""}`;
    },
    [dataset, target, endpointParam, modelParam, molSubParam, molFeatureParam, effectiveCatVar],
  );

  const handleTargetChange = useCallback(
    (t: string) => {
      setTargetParam(t === "survival" ? null : t);
      // Reset model to unadjusted when switching tabs.
      setModelParam(null);
    },
    [setTargetParam, setModelParam],
  );

  // Export handlers
  const handleExportCsv = useCallback(() => {
    if (target === "survival" && survivalQuery.data) {
      const headers = [
        "Feature",
        "HR",
        "HR_CI_Lower",
        "HR_CI_Upper",
        "p_adj",
        "N",
        "Events",
        "Evidence",
      ];
      const rows = survivalQuery.data.associations.map((a) => [
        a.feature,
        formatHR(a.hazardRatio),
        formatHR(a.hrCiLower),
        formatHR(a.hrCiUpper),
        formatP(a.pValueAdj),
        String(a.nSamples),
        String(a.nEvents),
        a.evidenceStrengthBadge,
      ]);
      downloadCSV(`associations_survival_${cohort}.csv`, headers, rows);
    } else if (
      target === "molecular" &&
      molSubTab !== "mutations" &&
      activeMolecularQuery.data
    ) {
      const headers = [
        "Feature",
        "Rho",
        "CI_Lower",
        "CI_Upper",
        "p_adj",
        "N",
        "Evidence",
      ];
      const rows = activeMolecularQuery.data.associations.map((a) => [
        a.histomicFeature,
        formatNum(a.spearmanRho, 3),
        formatNum(a.spearmanCiLower, 3),
        formatNum(a.spearmanCiUpper, 3),
        formatP(a.spearmanPAdj),
        String(a.nSamples),
        a.evidenceStrengthBadge,
      ]);
      downloadCSV(
        `associations_molecular_${molSubTab}_${molFeatureParam || "all"}_${cohort}.csv`,
        headers,
        rows,
      );
    } else if (
      target === "molecular" &&
      molSubTab === "mutations" &&
      categoricalQuery.data
    ) {
      const headers = [
        "Feature",
        "Effect_Size",
        "CI_Lower",
        "CI_Upper",
        "p_adj",
        "N",
        "Evidence",
      ];
      const rows = categoricalQuery.data.associations.map((a) => [
        a.histomicFeature,
        formatNum(a.effectSize, 3),
        formatNum(a.effectCiLower, 3),
        formatNum(a.effectCiUpper, 3),
        formatP(a.pValueAdj),
        String(a.nSamples),
        a.evidenceStrengthBadge,
      ]);
      downloadCSV(`associations_mutations_${cohort}.csv`, headers, rows);
    }
  }, [target, molSubTab, survivalQuery.data, activeMolecularQuery.data, categoricalQuery.data, cohort, molFeatureParam]);

  const molecularNeedsSearch =
    target === "molecular" && molSubTab === "expression" && !molFeatureParam;

  const nResults =
    target === "survival"
      ? survivalQuery.data?.associations.length
      : molSubTab === "mutations"
        ? categoricalQuery.data?.associations.length
        : activeMolecularQuery.data?.associations.length;

  const sectionSubtitle = useMemo(() => {
    if (nResults == null) return undefined;
    if (target === "survival") {
      return `Cox PH regression \u00b7 ${nResults} features \u00b7 BH-corrected within (cancer type, endpoint, model) \u00b7 \u03b1 = 0.05`;
    }
    if (molSubTab === "mutations") {
      return `Mann-Whitney U (two-sided) \u00b7 ${nResults} features \u00b7 BH-corrected \u00b7 \u03b1 = 0.05`;
    }
    return `Spearman rank correlation \u00b7 ${nResults} features \u00b7 BH-corrected \u00b7 \u03b1 = 0.05`;
  }, [nResults, target, molSubTab]);

  const MOL_TAB_LABEL: Record<string, string> = {
    expression: "Expression",
    pathway: "Pathway",
    immune_score: "Immune",
    cnv: "CNV",
  };

  const molecularSectionTitle =
    molSubTab === "mutations"
      ? "Mutation Associations"
      : hasFeatureSelected
        ? `Correlations with ${molFeatureParam}`
        : `${MOL_TAB_LABEL[molSubTab] ?? molSubTab} Correlations`;

  const molecularSectionIcon =
    molSubTab === "mutations" ? "flask-conical" : "dna";

  return (
    <>
      {/* White header zone: title + TabNav */}
      <div className="bg-white border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-6 pt-3 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Icon name="bar-chart" size={20} className="text-zinc-400" />
                <h1 className="text-2xl font-semibold text-zinc-900">Associations Hub</h1>
              </div>
              <p className="text-sm text-zinc-500 mt-1">
                Discover the histomics associated with outcomes
              </p>
            </div>
            <div className="hidden md:block pt-1">
              <CohortSelector dataset={dataset} currentCohort={cohort} buildHref={buildHref} />
            </div>
          </div>
        </div>

        <TabNav
          tabs={[
            {
              id: "survival",
              label: "Survival",
              icon: <Icon name="heart-pulse" size={16} />,
            },
            {
              id: "molecular",
              label: "Molecular",
              icon: <Icon name="dna" size={16} />,
            },
          ]}
          activeTab={target}
          onChange={handleTargetChange}
        />
      </div>

      {/* Content zone */}
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Survival: bare controls (no card) */}
        {target === "survival" && (
          <AssociationsToolbar
            target={target}
            endpoint={endpointParam}
            onEndpointChange={(ep) => setEndpointParam(ep === "os" ? null : ep)}
            model={modelParam}
            onModelChange={(m) => setModelParam(m === "unadjusted" ? null : m)}
            molecularSubTab={molSubTab}
            onMolecularSubTabChange={() => {}}
            molecularFeature=""
            onMolecularFeatureChange={() => {}}
            categoricalVar=""
            onCategoricalVarChange={() => {}}
            availableEndpoints={availableEndpoints}
            availableModels={availableSurvivalModels}
            availableCategoricalVars={[]}
            dataset={dataset}
            cohort={cohort}
          />
        )}

        {/* Molecular: bare controls (no card) */}
        {target === "molecular" && (
          <AssociationsToolbar
            target={target}
            endpoint={endpointParam}
            onEndpointChange={(ep) => setEndpointParam(ep === "os" ? null : ep)}
            model={modelParam}
            onModelChange={(m) => setModelParam(m === "unadjusted" ? null : m)}
            molecularSubTab={molSubTab}
            onMolecularSubTabChange={(tab) => {
              setMolSubParam(tab === "expression" ? null : tab);
              setMolFeatureParam(null);
            }}
            molecularFeature={molFeatureParam}
            onMolecularFeatureChange={(f) => setMolFeatureParam(f || null)}
            categoricalVar={effectiveCatVar}
            onCategoricalVarChange={(v) =>
              setCatVarParam(v === availableCategoricalVars[0] ? null : v)
            }
            availableEndpoints={availableEndpoints}
            availableModels={availableMolecularModels}
            availableCategoricalVars={availableCategoricalVars}
            dataset={dataset}
            cohort={cohort}
          />
        )}

        {target === "survival" && (
          <SectionCard
            title="Survival Associations"
            subtitle={sectionSubtitle}
            icon={
              <Icon
                name="heart-pulse"
                size={18}
                className="text-zinc-400"
              />
            }
            actions={<ExportActions onExportCSV={handleExportCsv} />}
          >
            {survivalQuery.data?.associations.length === 0 && modelParam === 'adjusted' ? (
              <EmptyState
                icon={<Icon name="info" size={40} />}
                title="Adjusted model unavailable"
                description="The adjusted model requires age, sex, and pathological stage as covariates, which are unavailable or too sparse for this cohort. Try the unadjusted model instead."
              />
            ) : (
            <div className="space-y-6">
              <div className="max-w-[60%]">
                <VolcanoPlot
                  target="survival"
                  survivalData={survivalQuery.data?.associations}
                  dataset={dataset}
                  cohort={cohort}
                  isLoading={isLoading}
                />
              </div>
              <div className="border-t border-zinc-100" />
              <AssociationsRankedTable
                target="survival"
                survivalData={survivalQuery.data?.associations}
                dataset={dataset}
                cohort={cohort}
                isLoading={isLoading}
              />
            </div>
            )}
          </SectionCard>
        )}

        {target === "molecular" && molecularNeedsSearch && (
          <EmptyState
            icon={<Icon name="search" size={40} />}
            title="Select a molecular feature"
            description="Search for a gene or feature to see its histomic associations."
          />
        )}

        {target === "molecular" && !molecularNeedsSearch && (
          <SectionCard
            title={molecularSectionTitle}
            subtitle={sectionSubtitle}
            icon={
              <Icon
                name={molecularSectionIcon}
                size={18}
                className="text-zinc-400"
              />
            }
            actions={<ExportActions onExportCSV={handleExportCsv} />}
          >
            <div className="space-y-6">
              <div className="max-w-[60%]">
                <VolcanoPlot
                  target={renderTarget}
                  correlationData={
                    molSubTab !== "mutations"
                      ? activeMolecularQuery.data?.associations
                      : undefined
                  }
                  categoricalData={
                    molSubTab === "mutations"
                      ? categoricalQuery.data?.associations
                      : undefined
                  }
                  dataset={dataset}
                  cohort={cohort}
                  isLoading={isLoading}
                />
              </div>
              <div className="border-t border-zinc-100" />
              <AssociationsRankedTable
                target={renderTarget}
                correlationData={
                  molSubTab !== "mutations"
                    ? activeMolecularQuery.data?.associations
                    : undefined
                }
                categoricalData={
                  molSubTab === "mutations"
                    ? categoricalQuery.data?.associations
                    : undefined
                }
                dataset={dataset}
                cohort={cohort}
                isLoading={isLoading}
              />
            </div>
          </SectionCard>
        )}

        <ProvenanceBar />
      </main>
    </>
  );
}
