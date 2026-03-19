import { useState, useMemo, useCallback } from 'react';
import type { FeatureTileGroup, ClusterTile, Slide } from '../../types';
import { CANCER_TYPE_COLORS } from '../../lib/colors';
import { Skeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { InfoTooltip } from '../ui/InfoTooltip';
import { SectionCard } from '../ui/SectionCard';
import { Icon } from '../ui/Icon';
import { formatNum } from '../../lib/formatters';

const TILE_SIZE = 224;

const CELL_TYPE_COLORS = [
  { label: 'Cancer cell', color: 'rgb(230, 0, 0)' },
  { label: 'Lymphocyte', color: 'rgb(0, 150, 0)' },
  { label: 'Fibroblast', color: 'rgb(0, 0, 230)' },
  { label: 'Macrophage', color: 'rgb(153, 51, 255)' },
  { label: 'Neutrophil', color: 'rgb(255, 153, 51)' },
  { label: 'Eosinophil', color: 'rgb(255, 102, 178)' },
  { label: 'Plasmocyte', color: 'rgb(255, 255, 0)' },
  { label: 'Endothelial', color: 'rgb(51, 204, 204)' },
  { label: 'Epithelial (non-cancer)', color: 'rgb(0, 102, 0)' },
  { label: 'Mitotic figure', color: 'rgb(102, 255, 102)' },
  { label: 'Apoptotic body', color: 'rgb(102, 204, 255)' },
  { label: 'Red blood cell', color: 'rgb(128, 0, 0)' },
  { label: 'Necrotic cell', color: 'rgb(255, 204, 153)' },
  { label: 'Smooth muscle', color: 'rgb(102, 51, 0)' },
] as const;

function CellTypeLegend() {
  return (
    <div className="mt-3 pt-3 border-t border-zinc-100">
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5">
        {CELL_TYPE_COLORS.map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full border border-zinc-200"
              style={{ backgroundColor: color }}
            />
            <span className="text-[11px] text-zinc-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatPosition(px: number): string {
  return px.toLocaleString();
}

interface FeatureTilesProps {
  dataset?: string;
  featureTiles?: FeatureTileGroup[];
  slides?: Slide[];
  cohort: string;
  isLoading: boolean;
}

export function FeatureTiles({ dataset = 'tcga', featureTiles, slides, cohort, isLoading }: FeatureTilesProps) {
  const [showOverlay, setShowOverlay] = useState(false);

  const cancerTypeBySlide = useMemo(() => {
    if (!slides) return new Map<string, string>();
    return new Map(slides.map((s) => [s.id, s.cancerType]));
  }, [slides]);

  if (isLoading) {
    return (
      <SectionCard title="Representative Tiles" icon={<Icon name="image" size={18} className="text-zinc-400" />}>
        <div className="space-y-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-4 w-48 mb-2" />
              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Skeleton key={j} className="aspect-square rounded" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    );
  }

  if (!featureTiles || featureTiles.length === 0) {
    return (
      <SectionCard
        title="Representative Tiles"
        icon={<Icon name="image" size={18} className="text-zinc-400" />}
        actions={
          <InfoTooltip text="Top-scoring tiles from slides nearest to the cluster centroid, grouped by the cluster's most distinguishing histomic features." />
        }
      >
        <EmptyState
          title="No tiles"
          description="This cluster doesn't have representative tiles available."
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Representative Tiles"
      icon={<Icon name="image" size={18} className="text-zinc-400" />}
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowOverlay((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
              showOverlay
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-white text-zinc-500 border-zinc-200 hover:text-zinc-700'
            }`}
          >
            <Icon name="layers" size={13} />
            Inspect predictions
          </button>
          <InfoTooltip text="Top-scoring tiles from slides nearest to the cluster centroid, grouped by the cluster's most distinguishing histomic features." />
        </div>
      }
    >
      <div className="space-y-5">
        {featureTiles.map((group) => (
          <FeatureRow
            key={group.featureName}
            dataset={dataset}
            group={group}
            cohort={cohort}
            showOverlay={showOverlay}
            cancerTypeBySlide={cancerTypeBySlide}
          />
        ))}
      </div>

      {showOverlay && <CellTypeLegend />}
    </SectionCard>
  );
}

interface FeatureRowProps {
  dataset: string;
  group: FeatureTileGroup;
  cohort: string;
  showOverlay: boolean;
  cancerTypeBySlide: Map<string, string>;
}

function FeatureRow({ dataset, group, cohort, showOverlay, cancerTypeBySlide }: FeatureRowProps) {
  // Track which tiles failed to load so we can hide them
  const [failedKeys, setFailedKeys] = useState<Set<string>>(new Set());
  const onTileFailed = useCallback((key: string) => {
    setFailedKeys((prev) => new Set(prev).add(key));
  }, []);

  const visibleTiles = group.tiles.filter(
    (t) => !failedKeys.has(`${t.slideId}-${t.tileX}-${t.tileY}`),
  );

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <a
          href={`/${dataset}/${cohort}/histomics/${encodeURIComponent(group.featureName)}/`}
          className="text-blue-600 hover:underline font-medium text-sm truncate"
          title={group.featureName}
        >
          {group.featureDisplayName}
        </a>
        <span className="text-emerald-700 font-mono text-xs font-medium whitespace-nowrap">
          +{formatNum(group.featureZScore)}σ
        </span>
      </div>
      {visibleTiles.length > 0 ? (
        <div className="grid grid-cols-5 gap-2">
          {visibleTiles.map((tile) => (
            <TileCard
              key={`${tile.slideId}-${tile.tileX}-${tile.tileY}`}
              dataset={dataset}
              tile={tile}
              cohort={cohort}
              showOverlay={showOverlay}
              featureDisplayName={group.featureDisplayName}
              cancerType={cancerTypeBySlide.get(tile.slideId)}
              onFailed={onTileFailed}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-400 italic">No tile images available.</p>
      )}
    </div>
  );
}

interface TileCardProps {
  dataset: string;
  tile: ClusterTile;
  cohort: string;
  showOverlay: boolean;
  featureDisplayName: string;
  cancerType?: string;
  onFailed: (key: string) => void;
}

function TileCard({ dataset, tile, cohort, showOverlay, featureDisplayName, cancerType, onFailed }: TileCardProps) {
  const basePath = `/bundles/v1/tiles/${tile.slideId}/${tile.tileLevel}__${tile.tileX}__${tile.tileY}__224__224`;
  const tileUrl = showOverlay ? `${basePath}_overlay.jpg` : `${basePath}.jpg`;
  const maxLevel = tile.maxTileLevel ?? tile.tileLevel;
  const scale = 2 ** (maxLevel - tile.tileLevel);
  const posX = tile.tileX * TILE_SIZE * scale;
  const posY = tile.tileY * TILE_SIZE * scale;
  const cancerColor = cancerType ? CANCER_TYPE_COLORS[cancerType] || '#808080' : undefined;
  const tileKey = `${tile.slideId}-${tile.tileX}-${tile.tileY}`;

  return (
    <a
      href={`/${dataset}/${cancerType || cohort}/slide/${tile.slideId}/`}
      className="group relative aspect-square rounded overflow-hidden bg-zinc-100"
    >
      <img
        src={tileUrl}
        alt={`${cancerType ?? ''} histopathology tile for ${featureDisplayName}`}
        className="w-full h-full object-cover"
        width={224}
        height={224}
        loading="lazy"
        onError={() => onFailed(tileKey)}
      />

      {/* Score + position overlay on hover */}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
        <span className="text-white text-xs font-medium">
          {tile.score.toFixed(3)}
        </span>
        <span className="text-white/70 text-[10px]">
          ({formatPosition(posX)}, {formatPosition(posY)}) px
        </span>
        {cancerType && cancerColor && (
          <span
            className="inline-flex items-center px-1.5 py-px rounded text-[9px] font-medium text-white mt-0.5"
            style={{ backgroundColor: cancerColor }}
          >
            {cancerType}
          </span>
        )}
      </div>

      {/* Scale bar: 224 px at 0.5 µm/px; 10 µm = 20 px = 8.93% of tile width */}
      <div className="absolute bottom-2 right-2 left-2 flex flex-col items-end pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="h-[2px] bg-white/90" style={{ width: '8.93%' }} />
        <span className="text-white/90 text-[10px] mt-px">10 µm</span>
      </div>
    </a>
  );
}
