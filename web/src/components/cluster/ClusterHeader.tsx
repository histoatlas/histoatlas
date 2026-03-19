import { useCallback } from 'react';
import { CLUSTER_COLORS, CANCER_TYPE_COLORS } from '../../lib/colors';
import { Skeleton } from '../ui/Skeleton';
import { CohortSelector } from '../ui/CohortSelector';
import type { ClusterDetail } from '../../types';

interface ClusterHeaderProps {
  cluster?: ClusterDetail;
  clusterId: string;
  dataset?: string;
  cohort: string;
  isLoading: boolean;
}

export function ClusterHeader({ cluster, clusterId, dataset = 'tcga', cohort, isLoading }: ClusterHeaderProps) {
  const buildHref = useCallback(
    (c: string) => `/${dataset}/${c}/cluster/${encodeURIComponent(clusterId)}/`,
    [dataset, clusterId],
  );

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-6 pt-3">
        <div className="flex items-center gap-3 mb-1">
          <Skeleton className="w-4 h-4 rounded-full" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-5 w-40 mb-3" />
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-14 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!cluster) return null;

  const clusterIndex = Number(cluster.id);
  const clusterColor = !isNaN(clusterIndex)
    ? CLUSTER_COLORS[clusterIndex % CLUSTER_COLORS.length]
    : '#808080';

  // Sort cancer composition descending by proportion
  const sorted = cluster.cancerComposition
    ? Object.entries(cluster.cancerComposition).sort(([, a], [, b]) => b - a)
    : [];
  const top5 = sorted.slice(0, 5);
  const remaining = sorted.length - 5;

  return (
    <div className="max-w-7xl mx-auto px-6 pt-3">
      {/* Title row with cohort selector */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-4 h-4 rounded-full shrink-0"
              style={{ backgroundColor: clusterColor }}
            />
            <h1 className="text-2xl font-semibold text-zinc-900">{cluster.name}</h1>
          </div>
          <p className="text-sm text-zinc-500">
            {cluster.nSlides.toLocaleString()} slides
            {cluster.cancerType && cluster.cancerType !== 'PAN' && (
              <span
                className="ml-2 inline-flex px-2 py-0.5 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: CANCER_TYPE_COLORS[cluster.cancerType] || '#808080' }}
              >
                {cluster.cancerType}
              </span>
            )}
          </p>
        </div>
        <div className="pt-1">
          <CohortSelector dataset={dataset} currentCohort={cohort} buildHref={buildHref} />
        </div>
      </div>

      {/* Cancer type composition badges */}
      {top5.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {top5.map(([cancerType, proportion]) => (
            <span
              key={cancerType}
              className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
              style={{
                backgroundColor:
                  CANCER_TYPE_COLORS[cancerType] || '#808080',
              }}
              title={`${(proportion * 100).toFixed(1)}%`}
            >
              {cancerType}{' '}
              <span className="opacity-80">
                {(proportion * 100).toFixed(0)}%
              </span>
            </span>
          ))}
          {remaining > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium text-zinc-600 bg-zinc-100">
              +{remaining} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}
