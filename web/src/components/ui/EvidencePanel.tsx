import type { EvidenceSelection, EvidenceTile } from '../../types/evidence';
import { getDatasetAndCohortFromPath } from '../../hooks/useCohort';
import { SectionCard } from './SectionCard';
import { Skeleton } from './Skeleton';

interface EvidencePanelProps {
  selection: EvidenceSelection | null;
  isLoading?: boolean;
  error?: string;
  onModeChange?: (mode: EvidenceSelection['mode']) => void;
}

export function EvidencePanel({ selection, isLoading, error }: EvidencePanelProps) {
  if (isLoading) {
    return (
      <SectionCard title="Evidence Tiles">
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-md" />
          ))}
        </div>
      </SectionCard>
    );
  }

  if (error) {
    return (
      <SectionCard title="Evidence Tiles">
        <p className="text-sm text-red-600 py-4 text-center">{error}</p>
      </SectionCard>
    );
  }

  if (!selection || selection.groups.length === 0) {
    return (
      <SectionCard title="Evidence Tiles">
        <p className="text-sm text-zinc-500 py-6 text-center">
          Select a feature to view evidence tiles
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Evidence Tiles"
      subtitle={selection.featureName}
    >
      <div className="space-y-4">
        {selection.groups.map((group) => (
          <div key={group.label}>
            <h4 className="text-xs font-medium text-zinc-600 mb-2">
              {group.label}
              <span className="ml-1.5 text-zinc-400">({group.tiles.length})</span>
            </h4>
            <div className="grid grid-cols-4 gap-1.5">
              {group.tiles.map((tile) => (
                <TileCard key={tile.tileId} tile={tile} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function TileCard({ tile }: { tile: EvidenceTile }) {
  const { dataset, cohort } = getDatasetAndCohortFromPath();
  const slideHref = `/${dataset}/${tile.cancerType || cohort}/slide/${tile.slideId}/`;

  return (
    <div className="group relative aspect-square rounded-md overflow-hidden bg-zinc-100">
      <img
        src={tile.imageUrl}
        alt={`Tile ${tile.tileId}`}
        className="w-full h-full object-cover"
        loading="lazy"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-0.5 px-1 text-center">
        {tile.score != null && (
          <span className="text-white text-[10px] font-mono">
            {tile.score.toFixed(3)}
          </span>
        )}
        <span className="text-white/70 text-[9px] font-mono truncate max-w-full">
          {tile.slideId.length > 12
            ? tile.slideId.slice(0, 12) + '\u2026'
            : tile.slideId}
        </span>
        <a
          href={slideHref}
          className="text-blue-300 text-[9px] hover:text-blue-200 mt-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          Open slide
        </a>
      </div>
    </div>
  );
}
