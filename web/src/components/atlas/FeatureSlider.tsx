import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { FeatureMetadata } from '../../types';

interface FeatureSliderProps {
  feature: FeatureMetadata;
  value: [number, number] | undefined;
  onChange: (range: [number, number] | undefined) => void;
}

export function FeatureSlider({ feature, value, onChange }: FeatureSliderProps) {
  const { displayName, min, max, histogramBins } = feature;
  const trackRef = useRef<HTMLDivElement>(null);

  // Use quantile-based defaults for better UX
  const defaultMin = feature.quantiles?.p01 ?? min;
  const defaultMax = feature.quantiles?.p99 ?? max;

  // Derive display values from props
  const displayMin = value?.[0] ?? defaultMin;
  const displayMax = value?.[1] ?? defaultMax;

  // Local state for dragging - initialized from props
  const [dragging, setDragging] = useState<{
    type: 'min' | 'max';
    localMin: number;
    localMax: number;
  } | null>(null);

  const range = max - min;

  // Use local values when dragging, prop values otherwise
  const currentMin = dragging ? dragging.localMin : displayMin;
  const currentMax = dragging ? dragging.localMax : displayMax;

  const minPercent = ((currentMin - min) / range) * 100;
  const maxPercent = ((currentMax - min) / range) * 100;

  const hasFilter = value !== undefined;

  const getValueFromPosition = useCallback(
    (clientX: number): number => {
      const track = trackRef.current;
      if (!track) return min;
      const rect = track.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return min + percent * range;
    },
    [min, range]
  );

  const handleMouseDown = useCallback(
    (type: 'min' | 'max') => (e: React.MouseEvent) => {
      e.preventDefault();
      setDragging({
        type,
        localMin: displayMin,
        localMax: displayMax,
      });
    },
    [displayMin, displayMax]
  );

  // Global mouse event listeners for dragging
  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newValue = getValueFromPosition(e.clientX);

      setDragging((prev) => {
        if (!prev) return null;
        if (prev.type === 'min') {
          const clamped = Math.min(newValue, prev.localMax - range * 0.01);
          return { ...prev, localMin: Math.max(min, clamped) };
        } else {
          const clamped = Math.max(newValue, prev.localMin + range * 0.01);
          return { ...prev, localMax: Math.min(max, clamped) };
        }
      });
    };

    const handleMouseUp = () => {
      setDragging((prev) => {
        if (prev) {
          // Schedule the onChange call after state update
          setTimeout(() => {
            onChange([prev.localMin, prev.localMax]);
          }, 0);
        }
        return null;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, getValueFromPosition, min, max, range, onChange]);

  const handleReset = () => {
    onChange(undefined);
  };

  // Mini histogram rendering
  const histogramSvg = useMemo(() => {
    if (!histogramBins || histogramBins.length === 0) return null;

    const maxBin = Math.max(...histogramBins);
    const barCount = histogramBins.length;

    return (
      <svg className="w-full h-6" preserveAspectRatio="none">
        {histogramBins.map((count, i) => {
          const barWidth = 100 / barCount;
          const barHeight = maxBin > 0 ? (count / maxBin) * 100 : 0;
          const x = i * barWidth;

          // Determine if this bar is within the selected range
          const barMin = min + (i / barCount) * range;
          const barMax = min + ((i + 1) / barCount) * range;
          const isActive = barMin <= currentMax && barMax >= currentMin;

          return (
            <rect
              key={i}
              x={`${x}%`}
              y={`${100 - barHeight}%`}
              width={`${barWidth}%`}
              height={`${barHeight}%`}
              className={isActive ? 'fill-blue-400' : 'fill-zinc-200'}
            />
          );
        })}
      </svg>
    );
  }, [histogramBins, min, range, currentMin, currentMax]);

  return (
    <div className="py-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-zinc-700">{displayName}</span>
        {hasFilter && (
          <button
            onClick={handleReset}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            Reset
          </button>
        )}
      </div>

      {/* Mini histogram */}
      {histogramSvg && <div className="mb-1">{histogramSvg}</div>}

      {/* Slider track */}
      <div
        ref={trackRef}
        className="relative h-2 bg-zinc-200 rounded-full cursor-pointer"
      >
        {/* Active range */}
        <div
          className="absolute h-full bg-blue-500 rounded-full"
          style={{
            left: `${minPercent}%`,
            width: `${maxPercent - minPercent}%`,
          }}
        />

        {/* Min thumb */}
        <div
          className="absolute w-4 h-4 -mt-1 -ml-2 bg-white border-2 border-blue-500 rounded-full cursor-grab active:cursor-grabbing shadow"
          style={{ left: `${minPercent}%` }}
          onMouseDown={handleMouseDown('min')}
        />

        {/* Max thumb */}
        <div
          className="absolute w-4 h-4 -mt-1 -ml-2 bg-white border-2 border-blue-500 rounded-full cursor-grab active:cursor-grabbing shadow"
          style={{ left: `${maxPercent}%` }}
          onMouseDown={handleMouseDown('max')}
        />
      </div>

      {/* Value labels */}
      <div className="flex justify-between mt-1 text-xs text-zinc-500">
        <span>{currentMin.toFixed(2)}{feature.unit ? ` ${feature.unit}` : ''}</span>
        <span>{currentMax.toFixed(2)}{feature.unit ? ` ${feature.unit}` : ''}</span>
      </div>
    </div>
  );
}
