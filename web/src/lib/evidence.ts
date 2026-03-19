import type { SlideTile, ClusterTile } from '../types';
import type { EvidenceTile } from '../types/evidence';

export function slideTileToEvidence(
  tile: SlideTile,
  slideId: string,
): EvidenceTile {
  const tileId = `${tile.tileLevel}__${tile.tileX}__${tile.tileY}__224__224`;
  return {
    tileId,
    slideId,
    rank: tile.rank,
    score: tile.score,
    percentile: tile.percentile,
    imageUrl: `/bundles/v1/tiles/${slideId}/${tileId}.jpg`,
    metadata: {},
  };
}

export function clusterTileToEvidence(
  tile: ClusterTile,
): EvidenceTile {
  const tileId = `${tile.tileLevel}__${tile.tileX}__${tile.tileY}__224__224`;
  return {
    tileId,
    slideId: tile.slideId,
    rank: 0,
    score: tile.score,
    percentile: null,
    imageUrl: `/bundles/v1/tiles/${tile.slideId}/${tileId}.jpg`,
    metadata: {},
  };
}
