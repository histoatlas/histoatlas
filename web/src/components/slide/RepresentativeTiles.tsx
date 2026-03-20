import { useState, useMemo, useEffect } from 'react';
import type { SlideTile, FeatureMetadata } from '../../types';
import { useSlideData } from '../../hooks/useSlideData';
import { useSlideTiles } from '../../hooks/useSlideTiles';
import { Skeleton } from '../ui/Skeleton';
import { InfoTooltip } from '../ui/InfoTooltip';
import { SectionCard } from '../ui/SectionCard';
import { Icon } from '../ui/Icon';

interface RepresentativeTilesProps {
  dataset?: string;
  slideId: string | undefined;
  featureMetadata: FeatureMetadata[] | undefined;
}

export function RepresentativeTiles({
  dataset = 'tcga',
  slideId,
  featureMetadata,
}: RepresentativeTilesProps) {
  const [selectedFeature, setSelectedFeature] = useState<string | undefined>();
  const [showOverlay, setShowOverlay] = useState(false);
  const { data: slide } = useSlideData(dataset, slideId);

  // Filter to only features that have tiles for this slide
  const availableFeatures = useMemo(() => {
    if (!featureMetadata || !slide?.tiles) return [];
    const tileKeys = new Set(Object.keys(slide.tiles));
    return featureMetadata.filter((m) => tileKeys.has(m.name));
  }, [featureMetadata, slide?.tiles]);

  // Set initial feature or reset if current selection is not available
  useEffect(() => {
    if (availableFeatures.length === 0) return;
    if (!selectedFeature || !availableFeatures.some((f) => f.name === selectedFeature)) {
      setSelectedFeature(availableFeatures[0].name);
    }
  }, [availableFeatures, selectedFeature]);

  const { data: tiles, isLoading: tilesLoading } = useSlideTiles(
    dataset,
    slideId,
    selectedFeature
  );

  const selectedDisplayName = availableFeatures.find((f) => f.name === selectedFeature)?.displayName ?? '';

  if (availableFeatures.length === 0) {
    return null;
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
          <InfoTooltip text="Top-ranked tiles from this slide for the selected feature, scored by histotyper using density, morphology, and spatial strategies." />
        </div>
      }
    >
      {/* Feature selector */}
      <div className="mb-4">
        <select
          value={selectedFeature || ''}
          onChange={(e) => setSelectedFeature(e.target.value)}
          aria-label="Select feature"
          className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
        >
          {availableFeatures.map((meta) => (
            <option key={meta.name} value={meta.name}>
              {meta.displayName}
            </option>
          ))}
        </select>
      </div>

      {/* Ranked tile gallery */}
      {tilesLoading ? (
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded" />
          ))}
        </div>
      ) : tiles && tiles.length > 0 ? (
        <div className="grid grid-cols-5 gap-2">
          {tiles.map((tile) => (
            <RankedTileCard
              key={`${tile.tileX}-${tile.tileY}-${tile.tileLevel}`}
              tile={tile}
              slideId={slideId!}
              maxLevel={slide?.maxTileLevel ?? 0}
              showOverlay={showOverlay}
              featureDisplayName={selectedDisplayName}
              cancerType={slide?.cancerType ?? ''}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">
          No tiles available for this feature.
        </p>
      )}

      {/* Cell type legend (only visible when overlay is active) */}
      {showOverlay && <CellTypeLegend />}
    </SectionCard>
  );
}

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

const TILE_SIZE = 224;

function formatPosition(px: number): string {
  return px.toLocaleString();
}

interface RankedTileCardProps {
  tile: SlideTile;
  slideId: string;
  maxLevel: number;
  showOverlay: boolean;
  featureDisplayName: string;
  cancerType: string;
}

function RankedTileCard({ tile, slideId, maxLevel, showOverlay, featureDisplayName, cancerType }: RankedTileCardProps) {
  const basePath = `/bundles/v1/tiles/${slideId}/${tile.tileLevel}__${tile.tileX}__${tile.tileY}__224__224`;
  const tileUrl = showOverlay ? `${basePath}_overlay.jpg` : `${basePath}.jpg`;
  const scale = 2 ** (maxLevel - tile.tileLevel);
  const posX = tile.tileX * TILE_SIZE * scale;
  const posY = tile.tileY * TILE_SIZE * scale;

  return (
    <div className="group relative aspect-square rounded overflow-hidden bg-zinc-100">
      <img
        src={tileUrl}
        alt={`${cancerType} histopathology tile ranked #${tile.rank} for ${featureDisplayName}, H&E stain at 0.5 µm/px`}
        className="w-full h-full object-cover"
        width={224}
        height={224}
        loading="lazy"
        onLoad={(e) => {
          e.currentTarget.style.display = '';
        }}
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />

      {/* Score + position overlay on hover */}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
        <span className="text-white text-xs font-medium">
          {tile.score.toFixed(3)}
        </span>
        <span className="text-white/70 text-[10px]">
          ({formatPosition(posX)}, {formatPosition(posY)}) px
        </span>
      </div>

      {/* Scale bar: 224 px at 0.5 µm/px; 10 µm = 20 px = 8.93% of tile width */}
      <div className="absolute bottom-2 right-2 left-2 flex flex-col items-end pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="h-[2px] bg-white/90" style={{ width: '8.93%' }} />
        <span className="text-white/90 text-[10px] mt-px">10 µm</span>
      </div>
    </div>
  );
}
