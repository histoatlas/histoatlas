import { useState } from 'react';
import type { SimilarSlide } from '../../types';
import { CANCER_TYPE_COLORS } from '../../lib/colors';
import { getDatasetAndCohortFromPath } from '../../hooks/useCohort';
import { InfoTooltip } from '../ui/InfoTooltip';
import { Icon } from '../ui/Icon';
import { Skeleton } from '../ui/Skeleton';

interface SimilarSlidesProps {
  slides: SimilarSlide[] | undefined;
  isLoading: boolean;
  currentSlideId?: string;
}

export function SimilarSlides({ slides, isLoading, currentSlideId }: SimilarSlidesProps) {
  const { dataset, cohort } = getDatasetAndCohortFromPath();

  const handleViewInAtlas = () => {
    if (!slides) return;
    const ids = currentSlideId
      ? [currentSlideId, ...slides.map((s) => s.id)]
      : slides.map((s) => s.id);
    const params = new URLSearchParams();
    params.set('sel', ids.join(','));
    window.location.href = `/${dataset}/${cohort}/atlas/?${params.toString()}`;
  };

  if (isLoading) {
    return (
      <div className="bg-white border border-zinc-200 rounded-lg p-5">
        <Skeleton className="h-5 w-32 mb-4" />
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  if (!slides || slides.length === 0) {
    return (
      <div className="bg-white border border-zinc-200 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
          <Icon name="layers" size={18} className="text-zinc-400" />
          Similar Slides
          <InfoTooltip text="Slides ranked by Euclidean distance in histomic feature space. Lower distance means more similar morphological patterns." />
        </h2>
        <p className="text-sm text-zinc-500">No similar slides found.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-5">
      <h2 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
        <Icon name="layers" size={18} className="text-zinc-400" />
        Similar Slides
        <InfoTooltip text="Slides ranked by Euclidean distance in histomic feature space. Lower distance means more similar morphological patterns." />
      </h2>
      <div className="grid grid-cols-3 gap-2">
        {slides.slice(0, 9).map((slide) => (
          <SimilarSlideCard key={slide.id} slide={slide} dataset={dataset} />
        ))}
      </div>
      <button
        onClick={handleViewInAtlas}
        className="mt-4 w-full px-3 py-2 text-sm font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        <Icon name="map" size={16} />
        View in Atlas
      </button>
    </div>
  );
}

interface SimilarSlideCardProps {
  slide: SimilarSlide;
  dataset: string;
}

function SimilarSlideCard({ slide, dataset }: SimilarSlideCardProps) {
  const cancerColor = CANCER_TYPE_COLORS[slide.cancerType] || '#808080';
  const [imgSrc, setImgSrc] = useState(
    `/bundles/v1/tiles/${slide.id}/thumbnail.jpg`,
  );
  const [failed, setFailed] = useState(false);

  const handleError = () => {
    if (imgSrc.includes('thumbnail.jpg')) {
      setImgSrc(`/bundles/v1/tiles/${slide.id}/0__0.0__0.0__224__224.jpg`);
    } else {
      setFailed(true);
    }
  };

  return (
    <a
      href={`/${dataset}/${slide.cancerType}/slide/${slide.id}/`}
      className="group relative aspect-square rounded-md overflow-hidden bg-zinc-100 hover:ring-2 hover:ring-blue-500 transition-all"
    >
      {/* Thumbnail image with fallback chain */}
      {failed ? (
        <div className="w-full h-full flex items-center justify-center bg-zinc-100 text-zinc-300">
          <Icon name="image" size={24} />
        </div>
      ) : (
        <img
          src={imgSrc}
          alt={`Slide ${slide.id.slice(0, 12)}`}
          className="w-full h-full object-cover"
          width={224}
          height={224}
          loading="lazy"
          onError={handleError}
        />
      )}

      {/* Cancer type badge (top-right corner) */}
      <span
        className="absolute top-1 right-1 px-1 py-0.5 text-[10px] font-medium text-white rounded"
        style={{ backgroundColor: cancerColor }}
      >
        {slide.cancerType}
      </span>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-xs">
        <span className="font-medium">Rank #{slide.rank}</span>
        <span className="text-white/80">d = {slide.distance.toFixed(3)}</span>
        {slide.sameCancer && (
          <span className="mt-1 text-green-400">Same cancer</span>
        )}
      </div>

    </a>
  );
}
