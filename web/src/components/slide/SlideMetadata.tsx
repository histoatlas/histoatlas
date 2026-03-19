import { useMemo } from 'react';
import type { SlideDetail, SlideCoords, Cluster } from '../../types';
import { CANCER_TYPE_COLORS } from '../../lib/colors';
import { getDatasetAndCohortFromPath } from '../../hooks/useCohort';
import { Skeleton } from '../ui/Skeleton';
import { InfoTooltip } from '../ui/InfoTooltip';

interface SlideMetadataProps {
  slide: SlideDetail | undefined;
  coords: SlideCoords | null;
  isLoading: boolean;
  clusters?: Cluster[];
}

export function SlideMetadata({ slide, coords, isLoading, clusters }: SlideMetadataProps) {
  const { dataset, cohort } = getDatasetAndCohortFromPath();
  const clusterName = useMemo(() => {
    if (!coords?.clusterId || !clusters) return null;
    const cluster = clusters.find((c) => c.id === coords.clusterId);
    return cluster?.name || `Cluster ${coords.clusterId}`;
  }, [coords?.clusterId, clusters]);

  if (isLoading) {
    return (
      <div className="bg-white border border-zinc-200 rounded-lg p-5">
        <Skeleton className="h-5 w-40 mb-4" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
  }

  if (!slide) {
    return null;
  }

  const cancerColor = CANCER_TYPE_COLORS[slide.cancerType] || '#808080';
  const patientId = slide.id.slice(0, 12);

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-5">
      <h2 className="text-lg font-semibold text-zinc-900 mb-4">
        Slide Information
      </h2>
      <dl className="space-y-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-zinc-500">Patient ID</dt>
          <dd className="font-mono text-zinc-900">{patientId}</dd>
        </div>
        <div className="flex justify-between items-center">
          <dt className="text-zinc-500">Cancer Type</dt>
          <dd>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
              style={{ backgroundColor: cancerColor }}
            >
              {slide.cancerType}
            </span>
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-zinc-500 flex items-center gap-1">
            UMAP Cluster
            <InfoTooltip text="Clusters derived from UMAP embedding of histomic features. Slides in the same cluster share similar morphological patterns." />
          </dt>
          <dd>
            {coords?.clusterId ? (
              <a
                href={`/${dataset}/${cohort}/cluster/${coords.clusterId}/`}
                className="text-blue-600 hover:underline font-medium"
              >
                {clusterName}
              </a>
            ) : (
              <span className="text-zinc-400">Unassigned</span>
            )}
          </dd>
        </div>
      </dl>
    </div>
  );
}
