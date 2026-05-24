import { useState, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAtlasStore } from '../stores/atlasStore';
import { useAtlasData } from '../hooks/useAtlasData';
import { useFilteredSlides } from '../hooks/useFilteredSlides';
import { useColorScale, useColorLegendInfo } from '../hooks/useColorScale';
import { useAtlasURLSync } from '../hooks/useAtlasURLSync';
import { CohortSelector } from '../components/ui/CohortSelector';
import {
  EmbeddingPlot,
  EmbeddingTooltip,
  ColorLegend,
  BottomControls,
  AtlasFilterBar,
  CATEGORICAL_OPTIONS,
} from '../components/atlas';
import { DataTable } from '../components/table';
import { DownloadDialog } from '../components/table/DownloadDialog';
import { CancerCompositionChart } from '../components/cluster/CancerCompositionChart';
import { Icon } from '../components/ui/Icon';
import { TabNav } from '../components/ui/TabNav';
import { Skeleton } from '../components/ui/Skeleton';
import type { TooltipData } from '../types';

/**
 * Format a date as relative time (e.g., "2 days ago", "last week")
 */
function formatRelativeTime(isoDate: string): string | null {
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return null;

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return null;
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return 'last week';
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 60) return 'last month';
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  if (diffDays < 730) return 'last year';
  return `${Math.floor(diffDays / 365)} years ago`;
}

const DATASET_INFO: Record<string, { description: string; url: string; label: string }> = {
  tcga: {
    description:
      'The Cancer Genome Atlas, a landmark cancer genomics program that molecularly characterized over 20,000 primary cancers spanning 33 cancer types.',
    url: 'https://portal.gdc.cancer.gov/',
    label: 'portal.gdc.cancer.gov',
  },
  cptac: {
    description:
      'The Clinical Proteomic Tumor Analysis Consortium, a national effort to accelerate the understanding of the molecular basis of cancer through the application of large-scale proteome and genome analysis.',
    url: 'https://gdc.cancer.gov/about-gdc/contributed-genomic-data-cancer-research/clinical-proteomic-tumor-analysis-consortium-cptac',
    label: 'gdc.cancer.gov (CPTAC)',
  },
};

interface AtlasViewProps {
  dataset?: string;
  cohort?: string;
}

function AtlasViewContent({ dataset = 'tcga', cohort = 'PANCAN' }: AtlasViewProps) {
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);

  // Sync URL with store
  useAtlasURLSync();

  // Portal slots for SSR header
  const [cohortSlot, setCohortSlot] = useState<HTMLElement | null>(null);
  const [downloadSlot, setDownloadSlot] = useState<HTMLElement | null>(null);
  const [tabNavSlot, setTabNavSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setCohortSlot(document.getElementById('cohort-selector-slot'));
    setDownloadSlot(document.getElementById('download-button-slot'));
    setTabNavSlot(document.getElementById('tab-nav-slot'));
  }, []);

  // Store state
  const {
    colorBy,
    hoveredId,
    selectedSlideIds,
    globalSearch,
    setColorBy,
    setHoveredId,
  } = useAtlasStore();

  // Data fetching
  const { data, isLoading, error } = useAtlasData(dataset, cohort);

  // Memoized filtering
  const { filteredIds, sortedSlides, paginatedSlides, totalPages } =
    useFilteredSlides(data?.slides);

  // Color scale based on colorBy setting
  const colorScale = useColorScale(colorBy, data?.slides);

  // Legend info for UMAP card
  const legendInfo = useColorLegendInfo(
    colorBy,
    data?.slides,
    data?.cancerTypes || [],
    data?.clusters,
    data?.featureMetadata,
  );

  // Feature names for table columns (limit to first 20 for performance)
  const visibleFeatureNames = useMemo(() => {
    const names = data?.featureNames || [];
    return names.slice(0, 20);
  }, [data?.featureNames]);

  // Handlers
  // Build a lookup from slide ID → cancerType for correct slide URLs
  const cancerTypeById = useMemo(() => {
    if (!data?.slides) return new Map<string, string>();
    return new Map(data.slides.map((s) => [s.id, s.cancerType]));
  }, [data?.slides]);

  const handleSlideClick = useCallback(
    (slideId: string) => {
      const slideCancerType = cancerTypeById.get(slideId) ?? cohort;
      window.posthog?.capture('slide_clicked', {
        slide_id: slideId,
        cancer_type: slideCancerType,
        dataset,
        cohort,
      });
      window.location.href = `/${dataset}/${slideCancerType}/slide/${slideId}/`;
    },
    [dataset, cohort, cancerTypeById]
  );

  const relativeTime = useMemo(
    () => (data?.dataUpdatedAt ? formatRelativeTime(data.dataUpdatedAt) : null),
    [data?.dataUpdatedAt]
  );

  const datasetInfo = DATASET_INFO[dataset] ?? DATASET_INFO.tcga;

  // Filter color-by options: hide "Cancer Type" for single-cancer-type cohorts
  const isMultiCancerType = (data?.cancerTypes?.length ?? 0) > 1;
  const colorByOptions = useMemo(
    () =>
      isMultiCancerType
        ? CATEGORICAL_OPTIONS
        : CATEGORICAL_OPTIONS.filter((o) => o.value !== 'cancerType'),
    [isMultiCancerType]
  );

  // Reset colorBy if current value is hidden for this cohort
  useEffect(() => {
    if (!isMultiCancerType && colorBy === 'cancerType') {
      setColorBy('clusterId');
    }
  }, [isMultiCancerType, colorBy, setColorBy]);

  // Cancer composition as proportions for CancerCompositionChart
  const cancerComposition = useMemo(() => {
    if (!data?.slides) return undefined;
    const total = data.slides.length;
    const counts: Record<string, number> = {};
    for (const slide of data.slides) {
      counts[slide.cancerType] = (counts[slide.cancerType] || 0) + 1;
    }
    return Object.fromEntries(
      Object.entries(counts).map(([type, count]) => [type, count / total])
    );
  }, [data?.slides]);

  // Loading state with skeleton
  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50">
        {/* Content skeleton: two-column layout */}
        <div className="max-w-7xl mx-auto px-6 pt-5 pb-16">
          <div className="flex gap-8">
            {/* Main column */}
            <div className="flex-1 min-w-0 space-y-5">
              {/* Filter bar skeleton */}
              <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-32 rounded-lg" />
                <Skeleton className="h-9 w-28 rounded-lg" />
                <Skeleton className="h-9 w-36 rounded-lg" />
                <div className="ml-auto">
                  <Skeleton className="h-9 w-64 rounded-lg" />
                </div>
              </div>

              {/* UMAP card skeleton */}
              <div className="bg-white border border-zinc-200 rounded-lg h-[60vh] min-h-[420px] max-h-[720px] flex flex-col">
                <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-32" />
                </div>
                <div className="flex-1 flex items-center justify-center bg-zinc-900 rounded-b-lg">
                  <div className="text-center">
                    <div className="w-8 h-8 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin mx-auto mb-3" />
                    <span className="text-sm text-zinc-400">Loading atlas...</span>
                  </div>
                </div>
              </div>

              {/* Table skeleton */}
              <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
                <div className="flex items-center gap-4 px-4 py-2.5 border-b border-zinc-200 bg-zinc-50">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className={`h-3.5 ${i === 0 ? 'w-28' : 'w-16'}`} />
                  ))}
                </div>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-2.5 border-b border-zinc-100">
                    <Skeleton className="h-4 w-28" />
                    {Array.from({ length: 4 }).map((_, j) => (
                      <Skeleton key={j} className="h-4 w-16" />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Right sidebar skeleton */}
            <aside className="w-72 flex-shrink-0 hidden lg:block space-y-4">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-40 mt-2" />

              <div className="space-y-2.5 pt-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>

              <div className="border-t border-zinc-200 my-5" />

              <Skeleton className="h-6 w-28" />
              <div className="space-y-2 pt-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-50">
        <div className="text-center">
          <div className="text-red-600 text-lg font-medium mb-2">
            Failed to load atlas data
          </div>
          <div className="text-zinc-500 text-sm mb-4">{error.message}</div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // No data state
  if (!data || !data.slides || data.slides.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-50">
        <div className="text-zinc-500">No slide data available</div>
      </div>
    );
  }

  const cancerTypeCount = data.cancerTypes?.length ?? 0;
  const featureCount = data.featureNames?.length ?? 0;

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Portal: CohortSelector into SSR header */}
      {cohortSlot && createPortal(
        <CohortSelector dataset={dataset} currentCohort={cohort} buildHref={(c) => `/${dataset}/${c}/atlas/`} />,
        cohortSlot,
      )}

      {/* Portal: Download button into SSR header */}
      {downloadSlot && createPortal(
        <button
          onClick={() => setIsDownloadOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-600 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors cursor-pointer"
        >
          <Icon name="download" size={16} />
          Download
        </button>,
        downloadSlot,
      )}

      {/* Portal: TabNav into SSR header */}
      {tabNavSlot && createPortal(
        <TabNav
          tabs={[
            { id: 'slides', label: 'Slides', icon: <Icon name="layers" size={16} />, badge: data.slides.length, href: `/${dataset}/${cohort}/atlas/` },
            { id: 'histomics', label: 'Histomics', icon: <Icon name="fingerprint" size={16} />, badge: featureCount, href: `/${dataset}/${cohort}/histomics/` },
            { id: 'clusters', label: 'Clusters', icon: <Icon name="waypoints" size={16} />, badge: data.clusters?.length ?? 0, href: `/${dataset}/${cohort}/cluster/` },
          ]}
          activeTab="slides"
          onChange={() => {}}
        />,
        tabNavSlot,
      )}

      {/* Content zone: two-column layout */}
      <div className="max-w-7xl mx-auto px-6 pt-5 pb-16">
        <div className="flex gap-8">
          {/* Main column */}
          <div className="flex-1 min-w-0 space-y-5">
            {/* Filter Bar */}
            <AtlasFilterBar
              slides={data.slides}
              clusters={data.clusters || []}
              cancerTypes={data.cancerTypes || []}
              immuneSubtypes={data.immuneSubtypes || []}
              featureMetadata={data.featureMetadata || []}
              filteredCount={sortedSlides.length}
              totalCount={data.slides.length}
              isMultiCancerType={isMultiCancerType}
            />

            {/* UMAP Card */}
            <div className="bg-white border border-zinc-200 rounded-lg h-[60vh] min-h-[420px] max-h-[720px] flex flex-col overflow-hidden">
              {/* UMAP Header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100">
                <span className="text-xs text-zinc-400 font-mono">
                  {data.dataVersion}{relativeTime && ` · ${relativeTime}`}
                </span>
                <BottomControls
                  colorBy={colorBy}
                  onColorByChange={(value) => {
                    window.posthog?.capture('color_by_changed', { color_by: value, dataset, cohort });
                    setColorBy(value);
                  }}
                  options={colorByOptions}
                />
              </div>

              {/* UMAP Plot */}
              <div className="flex-1 relative bg-zinc-900">
                <EmbeddingPlot
                  slides={data.slides}
                  filteredIds={filteredIds}
                  colorScale={colorScale}
                  hoveredId={hoveredId}
                  selectedSlideIds={selectedSlideIds}
                  onHover={setTooltipData}
                  onHoverId={setHoveredId}
                  onClick={handleSlideClick}
                />
                <EmbeddingTooltip data={tooltipData} colorBy={colorBy} clusters={data.clusters} featureMetadata={data.featureMetadata} />
                <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg border border-zinc-200 p-3 max-w-64">
                  <ColorLegend legend={legendInfo} />
                </div>
              </div>
            </div>

            {/* Data Table */}
            <DataTable
              allSlides={data.slides}
              sortedSlides={sortedSlides}
              paginatedSlides={paginatedSlides}
              totalPages={totalPages}
              featureMetadata={data.featureMetadata || []}
              featureNames={visibleFeatureNames}
              onSlideClick={handleSlideClick}
              searchQuery={globalSearch}
            />
          </div>

          {/* Right sidebar */}
          <aside className="w-72 flex-shrink-0 hidden lg:block">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 mb-3">About</h2>
              <p className="text-base text-zinc-900 leading-relaxed">
                {datasetInfo.description}
              </p>

              <a
                href={datasetInfo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 mt-3 text-sm text-blue-600 hover:text-blue-700 transition-colors"
              >
                <Icon name="external-link" size={14} />
                <span>{datasetInfo.label}</span>
              </a>

              <div className="mt-4 space-y-2.5">
                <div className="flex items-center gap-2 text-[15px] text-zinc-900">
                  <Icon name="layers" size={15} className="text-zinc-400" />
                  <span className="font-medium">{data.slides.length.toLocaleString()}</span>
                  <span className="text-zinc-600">slides</span>
                </div>
                <div className="flex items-center gap-2 text-[15px] text-zinc-900">
                  <Icon name="pie-chart" size={15} className="text-zinc-400" />
                  <span className="font-medium">{cancerTypeCount}</span>
                  <span className="text-zinc-600">cancer types</span>
                </div>
                <a href={`/${dataset}/${cohort}/histomics/`} className="flex items-center gap-2 text-[15px] text-zinc-900 transition-colors">
                  <Icon name="fingerprint" size={15} className="text-zinc-400" />
                  <span className="font-medium">{featureCount}</span>
                  <span className="text-zinc-600">histomics</span>
                </a>
              </div>

              <div className="border-t border-zinc-200 my-5" />

              <h2 className="text-lg font-semibold text-zinc-900 mb-3">Cancer types</h2>
              <CancerCompositionChart
                composition={cancerComposition}
                nSlides={data.slides.length}
                isLoading={false}
                maxTypes={Infinity}
                hideTitle
                hideCard
              />
            </div>
          </aside>
        </div>
      </div>

      {/* Download dialog */}
      <DownloadDialog
        isOpen={isDownloadOpen}
        onClose={() => setIsDownloadOpen(false)}
        filteredSlides={sortedSlides}
        selectedSlideIds={selectedSlideIds}
        featureNames={visibleFeatureNames}
      />
    </div>
  );
}

export function AtlasView({ dataset = 'tcga', cohort = 'PANCAN' }: AtlasViewProps) {
  return <AtlasViewContent dataset={dataset} cohort={cohort} />;
}
