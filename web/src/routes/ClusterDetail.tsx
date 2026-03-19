import { useMemo, useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useClusterDetail } from '../hooks/useClusterData';
import { useAtlasData } from '../hooks/useAtlasData';
import { useQueryParamState } from '../hooks/useQueryParamState';
import { TabNav } from '../components/ui/TabNav';
import { SectionCard } from '../components/ui/SectionCard';
import { Icon } from '../components/ui/Icon';
import { Skeleton } from '../components/ui/Skeleton';
import { CohortSelector } from '../components/ui/CohortSelector';
import { formatNum } from '../lib/formatters';
import { CANCER_TYPE_COLORS } from '../lib/colors';
import {
  FeatureRadarChart,
  CancerCompositionChart,
  FeatureTiles,
  MolecularTab,
  ImmuneSubtypeChart,
  ClusterSlidesTable,
} from '../components/cluster';
import type { AtlasDataResponse } from '../types';

const ClusterKMPlot = lazy(() =>
  import('../components/cluster/ClusterKMPlot').then((m) => ({ default: m.ClusterKMPlot }))
);

function SurvivalSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white border border-zinc-200 rounded-lg p-5">
          <Skeleton className="h-5 w-40 mb-2" />
          <div className="flex gap-1.5 mb-3">
            <Skeleton className="h-5 w-24 rounded" />
            <Skeleton className="h-5 w-20 rounded" />
            <Skeleton className="h-5 w-16 rounded" />
          </div>
          <Skeleton className="w-full h-52" />
        </div>
      ))}
    </div>
  );
}

interface DistinguishingFeature {
  name: string;
  displayName: string;
  zScore: number;
  clusterMean: number;
  cohortMean: number;
}

function DistinguishingFeatures({
  dataset,
  clusterId,
  cohort,
  atlasData,
  isLoading,
}: {
  dataset: string;
  clusterId: string;
  cohort: string;
  atlasData?: AtlasDataResponse;
  isLoading: boolean;
}) {
  const features = useMemo((): DistinguishingFeature[] => {
    if (!atlasData?.slides || !atlasData.featureMetadata) return [];

    const allSlides = atlasData.slides;
    const clusterSlides = allSlides.filter((s) => s.clusterId === clusterId);
    if (clusterSlides.length === 0) return [];

    const results: DistinguishingFeature[] = [];

    for (const meta of atlasData.featureMetadata) {
      // Compute cohort stats
      let cohortSum = 0;
      let cohortN = 0;
      for (const s of allSlides) {
        const v = s.features[meta.name];
        if (v != null) { cohortSum += v; cohortN++; }
      }
      if (cohortN < 2) continue;
      const cohortMean = cohortSum / cohortN;

      // Compute cohort std
      let sqSum = 0;
      for (const s of allSlides) {
        const v = s.features[meta.name];
        if (v != null) { sqSum += (v - cohortMean) ** 2; }
      }
      const std = Math.sqrt(sqSum / (cohortN - 1));
      if (std === 0) continue;

      // Compute cluster mean
      let clusterSum = 0;
      let clusterN = 0;
      for (const s of clusterSlides) {
        const v = s.features[meta.name];
        if (v != null) { clusterSum += v; clusterN++; }
      }
      if (clusterN === 0) continue;
      const clusterMean = clusterSum / clusterN;

      const zScore = (clusterMean - cohortMean) / std;
      results.push({
        name: meta.name,
        displayName: meta.displayName,
        zScore,
        clusterMean,
        cohortMean,
      });
    }

    return results
      .sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore))
      .slice(0, 5);
  }, [atlasData, clusterId]);

  if (isLoading) {
    return (
      <div className="bg-white border border-zinc-200 rounded-lg p-5">
        <Skeleton className="h-5 w-48 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (features.length === 0) return null;

  return (
    <SectionCard
      title="Distinguishing Features"
      subtitle="Features where this cluster deviates most from the cohort mean"
      icon={<Icon name="trending-up" size={18} className="text-zinc-400" />}
    >
      <div className="space-y-2">
        {features.map((f) => {
          const isUp = f.zScore > 0;
          return (
            <div
              key={f.name}
              className="flex items-center gap-3 text-sm py-1.5"
            >
              <Icon
                name={isUp ? 'arrow-up' : 'arrow-down'}
                size={14}
                className={isUp ? 'text-emerald-500' : 'text-red-500'}
              />
              <a
                href={`/${dataset}/${cohort}/histomics/${encodeURIComponent(f.name)}/`}
                className="text-blue-600 hover:underline font-medium flex-1 truncate"
                title={f.name}
              >
                {f.displayName}
              </a>
              <span className={`font-mono text-xs font-medium ${isUp ? 'text-emerald-700' : 'text-red-700'}`}>
                {isUp ? '+' : ''}{formatNum(f.zScore)}σ
              </span>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

const TAB_IDS = ['overview', 'molecular', 'survival', 'slides'] as const;
type TabId = (typeof TAB_IDS)[number];

interface ClusterDetailProps {
  dataset?: string;
  clusterId?: string;
  cohort?: string;
}

export function ClusterDetail({ dataset = 'tcga', clusterId, cohort = 'PANCAN' }: ClusterDetailProps) {
  const [activeTab, setActiveTab] = useQueryParamState('tab', 'overview');

  // Portal slots for SSR header
  const [cohortSlot, setCohortSlot] = useState<HTMLElement | null>(null);
  const [badgesSlot, setBadgesSlot] = useState<HTMLElement | null>(null);
  const [tabNavSlot, setTabNavSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setCohortSlot(document.getElementById('cohort-selector-slot'));
    setBadgesSlot(document.getElementById('cluster-badges-slot'));
    setTabNavSlot(document.getElementById('tab-nav-slot'));
  }, []);

  const buildHref = useCallback(
    (c: string) => `/${dataset}/${c}/cluster/${encodeURIComponent(clusterId ?? '')}/`,
    [dataset, clusterId],
  );

  const {
    data: cluster,
    isLoading: clusterLoading,
    error: clusterError,
  } = useClusterDetail(dataset, clusterId, cohort);

  const { data: atlasData } = useAtlasData(dataset, cohort);

  const validTab: TabId = (TAB_IDS as readonly string[]).includes(activeTab)
    ? (activeTab as TabId)
    : 'overview';

  const molecularBadgeCount = useMemo(() => {
    if (!cluster?.enrichments) return 0;
    return (
      cluster.enrichments.mutations.filter((e) => e.isSignificant).length +
      cluster.enrichments.gsea.filter((e) => e.isSignificant).length
    );
  }, [cluster?.enrichments]);

  // Cancer type composition badges
  const cancerBadges = useMemo(() => {
    if (!cluster?.cancerComposition) return null;
    const sorted = Object.entries(cluster.cancerComposition).sort(([, a], [, b]) => b - a);
    const top5 = sorted.slice(0, 5);
    const remaining = sorted.length - 5;
    if (top5.length === 0) return null;
    return (
      <div className="flex flex-wrap items-center gap-2 mt-3">
        {top5.map(([cancerType, proportion]) => (
          <span
            key={cancerType}
            className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: CANCER_TYPE_COLORS[cancerType] || '#808080' }}
            title={`${(proportion * 100).toFixed(1)}%`}
          >
            {cancerType}{' '}
            <span className="opacity-80">{(proportion * 100).toFixed(0)}%</span>
          </span>
        ))}
        {remaining > 0 && (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium text-zinc-600 bg-zinc-100">
            +{remaining} more
          </span>
        )}
      </div>
    );
  }, [cluster?.cancerComposition]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab === 'overview' ? null : tab);
  };

  if (!clusterId) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-zinc-500 text-sm">Missing cluster ID.</div>
      </div>
    );
  }

  // 404 state
  if (clusterError) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-zinc-900 mb-2">404</h1>
          <p className="text-zinc-600 mb-4">Cluster not found</p>
          <p className="text-sm text-zinc-500 mb-6 font-mono">{clusterId}</p>
          <a
            href={`/${dataset}/${cohort}/atlas/`}
            className="inline-flex items-center px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            Back to Atlas
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Portal: CohortSelector into SSR header */}
      {cohortSlot && createPortal(
        <CohortSelector dataset={dataset} currentCohort={cohort} buildHref={buildHref} />,
        cohortSlot,
      )}

      {/* Portal: Cancer type badges into SSR header */}
      {badgesSlot && cancerBadges && createPortal(cancerBadges, badgesSlot)}

      {/* Portal: TabNav into SSR header */}
      {tabNavSlot && createPortal(
        <TabNav
          tabs={[
            { id: 'overview', label: 'Overview', icon: <Icon name="layout-grid" size={16} /> },
            { id: 'molecular', label: 'Molecular', icon: <Icon name="dna" size={16} />, badge: !clusterLoading && molecularBadgeCount > 0 ? molecularBadgeCount : null },
            { id: 'survival', label: 'Survival', icon: <Icon name="heart-pulse" size={16} /> },
            { id: 'slides', label: 'Slides', icon: <Icon name="layers" size={16} />, badge: !clusterLoading && cluster?.nSlides != null ? cluster.nSlides : null },
          ]}
          activeTab={validTab}
          onChange={handleTabChange}
        />,
        tabNavSlot,
      )}

      {/* Tab content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {validTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <FeatureRadarChart
                clusterId={clusterId}
                atlasData={atlasData}
                isLoading={clusterLoading}
              />
              <CancerCompositionChart
                composition={cluster?.cancerComposition}
                nSlides={cluster?.nSlides}
                isLoading={clusterLoading}
              />
              <ImmuneSubtypeChart
                enrichments={cluster?.enrichments?.immune}
                isLoading={clusterLoading}
              />
            </div>
            <DistinguishingFeatures
              dataset={dataset}
              clusterId={clusterId}
              cohort={cohort}
              atlasData={atlasData}
              isLoading={clusterLoading}
            />
            <FeatureTiles
              dataset={dataset}
              featureTiles={cluster?.featureTiles}
              slides={atlasData?.slides}
              cohort={cohort}
              isLoading={clusterLoading}
            />
          </div>
        )}

        {validTab === 'molecular' && (
          <MolecularTab
            clusterId={clusterId}
            atlasData={atlasData}
            enrichments={cluster?.enrichments}
            nSlides={cluster?.nSlides}
            isLoading={clusterLoading}
          />
        )}

        {validTab === 'survival' && (
          <Suspense fallback={<SurvivalSkeleton />}>
            <ClusterKMPlot
              dataset={dataset}
              clusterId={clusterId}
              cohort={cohort}
              survivalSummary={cluster?.survivalSummary}
              isLoading={clusterLoading}
            />
          </Suspense>
        )}

        {validTab === 'slides' && <ClusterSlidesTable dataset={dataset} clusterId={clusterId} cohort={cohort} />}
      </main>
    </>
  );
}
