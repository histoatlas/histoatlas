import { useMemo, useCallback } from 'react';
import { useSlideData } from '../hooks/useSlideData';
import { useSimilarSlides } from '../hooks/useSimilarSlides';
import { useAtlasData } from '../hooks/useAtlasData';
import { useQueryParamState } from '../hooks/useQueryParamState';
import { TabNav } from '../components/ui/TabNav';
import { Icon } from '../components/ui/Icon';
import {
  HistomicFingerprint,
  FeatureTable,
  SimilarSlides,
  SlideThumbnail,
  RepresentativeTiles,
  ClinicalContext,
  TissueMask,
} from '../components/slide';
import { Skeleton } from '../components/ui/Skeleton';

const TAB_IDS = ['overview', 'histomics'] as const;
type TabId = (typeof TAB_IDS)[number];

interface SlideDetailProps {
  dataset?: string;
  slideId?: string;
  cohort?: string;
}

export function SlideDetail({ dataset = 'tcga', slideId, cohort = 'PANCAN' }: SlideDetailProps) {
  const [activeTab, setActiveTab] = useQueryParamState('tab', '');

  const validTab: TabId = (TAB_IDS as readonly string[]).includes(activeTab)
    ? (activeTab as TabId)
    : 'overview';

  const handleTabChange = useCallback(
    (tab: string) => {
      setActiveTab(tab === 'overview' ? null : tab);
    },
    [setActiveTab],
  );

  // All hooks must be called unconditionally (Rules of Hooks)
  const {
    data: slide,
    isLoading: slideLoading,
    error: slideError,
  } = useSlideData(dataset, slideId);

  const { data: similarSlides, isLoading: similarLoading } =
    useSimilarSlides(dataset, slideId);

  const { data: atlasData } = useAtlasData(dataset, cohort);

  // Pick the right coordinate set based on cohort
  const coords = useMemo(() => {
    if (!slide) return null;
    return cohort === 'PANCAN' ? slide.pancan : slide.cancerSpecific;
  }, [slide, cohort]);

  const clusterName = useMemo(() => {
    if (!coords?.clusterId || !atlasData?.clusters) return null;
    const cluster = atlasData.clusters.find((c) => c.id === coords.clusterId);
    return cluster?.name || `Cluster ${coords.clusterId}`;
  }, [coords?.clusterId, atlasData?.clusters]);

  // Early returns after all hooks
  if (!slideId) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-zinc-500 text-sm">Missing slide ID.</div>
      </div>
    );
  }

  // 404 state
  if (slideError) {
    // Extract TCGA case ID (e.g., "TCGA-3C-AALI" from "TCGA-3C-AALI-01Z-00-DX1...")
    const caseIdMatch = slideId?.match(/^(TCGA-[A-Z0-9]{2}-[A-Z0-9]{4})/);
    const caseId = caseIdMatch?.[1];

    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-zinc-900 mb-2">404</h1>
          <p className="text-zinc-600 mb-4">Slide not found</p>
          <p className="text-sm text-zinc-500 mb-6 font-mono">{slideId}</p>
          <div className="flex flex-col items-center gap-3">
            <a
              href={`/${dataset}/${cohort}/atlas/`}
              className="inline-flex items-center px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors"
            >
              Back to Atlas
            </a>
            {caseId && (
              <p className="text-sm text-zinc-500">
                Looking for case <span className="font-mono font-medium text-zinc-700">{caseId}</span>?{' '}
                Try searching with <kbd className="px-1.5 py-0.5 bg-zinc-100 border border-zinc-200 rounded text-xs font-mono">⌘K</kbd>
              </p>
            )}
            {!caseId && (
              <p className="text-sm text-zinc-500">
                Try searching for this slide with <kbd className="px-1.5 py-0.5 bg-zinc-100 border border-zinc-200 rounded text-xs font-mono">⌘K</kbd>
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Metadata line + tabs (continues the white zone from Astro) */}
      <div className="bg-white border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-6 pb-4">
          {slideLoading ? (
            <Skeleton className="h-4 w-32" />
          ) : (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              {slide && (
                <span className="text-zinc-700 font-medium">
                  {slide.cancerType}
                </span>
              )}
              {coords?.clusterId && (
                <>
                  <span className="text-zinc-300">/</span>
                  <a
                    href={`/${dataset}/${cohort}/cluster/${coords.clusterId}/`}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {clusterName}
                  </a>
                </>
              )}
              {slide && !coords?.clusterId && (
                <span className="text-zinc-400">Unassigned</span>
              )}
            </div>
          )}
        </div>
        <TabNav
          tabs={[
            { id: 'overview', label: 'Overview', icon: <Icon name="layout-grid" size={16} /> },
            { id: 'histomics', label: 'Histomics', icon: <Icon name="bar-chart" size={16} />, badge: atlasData?.featureMetadata?.length ?? null },
          ]}
          activeTab={validTab}
          onChange={handleTabChange}
        />
      </div>

      {/* Tab content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {validTab === 'overview' && (
          <div className="space-y-6">
            {/* Main + Sidebar */}
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Main column */}
              <div className="flex-1 min-w-0 space-y-6 order-2 lg:order-1">
                <HistomicFingerprint
                  features={slide?.features}
                  percentiles={slide?.featurePercentiles}
                  featureMetadata={atlasData?.featureMetadata}
                  isLoading={slideLoading}
                />
                <TissueMask slideId={slideId} features={slide?.features} />
                <RepresentativeTiles
                  dataset={dataset}
                  slideId={slideId}
                  featureMetadata={atlasData?.featureMetadata}
                />
              </div>

              {/* Sidebar */}
              <aside className="w-full lg:w-80 flex-shrink-0 space-y-6 order-1 lg:order-2">
                <SlideThumbnail slideId={slideId} />
                <ClinicalContext
                  clinical={slide?.clinical}
                  isLoading={slideLoading}
                />
                <SimilarSlides
                  slides={similarSlides}
                  isLoading={similarLoading}
                  currentSlideId={slideId}
                />
              </aside>
            </div>
          </div>
        )}

        {validTab === 'histomics' && (
          <FeatureTable
            features={slide?.features}
            percentiles={slide?.featurePercentiles}
            featureMetadata={atlasData?.featureMetadata}
            isLoading={slideLoading}
            cancerType={slide?.cancerType}
          />
        )}
      </main>
    </>
  );
}
