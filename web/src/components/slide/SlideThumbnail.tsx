import { useState, useEffect } from 'react';
import { Icon } from '../ui/Icon';

interface SlideThumbnailProps {
  slideId: string;
}

export function SlideThumbnail({ slideId }: SlideThumbnailProps) {
  const [useFallback, setUseFallback] = useState(false);

  // Reset fallback state when slideId changes
  useEffect(() => {
    setUseFallback(false);
  }, [slideId]);

  const thumbnailUrl = `/bundles/v1/tiles/${slideId}/thumbnail.jpg`;
  const maskUrl = `/bundles/v1/tiles/${slideId}/mask.png`;

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-5">
      <h2 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
        <Icon name="image" size={18} className="text-zinc-400" />
        Slide Preview
      </h2>
      <div className="rounded-md overflow-hidden bg-zinc-100 relative">
        <img
          src={useFallback ? maskUrl : thumbnailUrl}
          alt={`Preview of slide ${slideId.slice(0, 12)}`}
          className="w-full h-auto"
          loading="lazy"
          onError={() => {
            if (!useFallback) {
              setUseFallback(true);
            }
          }}
        />
        {/* Magnification badge */}
        <div className="absolute bottom-2 right-2 bg-zinc-900/70 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
          20×
        </div>
      </div>
    </div>
  );
}
