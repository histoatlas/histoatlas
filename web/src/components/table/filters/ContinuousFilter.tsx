import { useState, useCallback, useMemo } from 'react';

interface ContinuousFilterProps {
  min: number;
  max: number;
  histogramBins?: number[];
  currentRange?: [number, number];
  onRangeChange: (range: [number, number] | undefined) => void;
}

/**
 * Continuous filter with histogram visualization and range slider.
 */
export function ContinuousFilter({
  min,
  max,
  histogramBins,
  currentRange,
  onRangeChange,
}: ContinuousFilterProps) {
  const [localMin, setLocalMin] = useState(currentRange?.[0] ?? min);
  const [localMax, setLocalMax] = useState(currentRange?.[1] ?? max);
  const [isDragging, setIsDragging] = useState(false);

  const range = max - min;
  const step = range / 100;

  // Debounced update to store
  const commitChange = useCallback(
    (newMin: number, newMax: number) => {
      // If range is essentially full, clear the filter
      if (newMin <= min + step && newMax >= max - step) {
        onRangeChange(undefined);
      } else {
        onRangeChange([newMin, newMax]);
      }
    },
    [min, max, step, onRangeChange]
  );

  const handleMinChange = useCallback(
    (value: number) => {
      const newMin = Math.min(value, localMax - step);
      setLocalMin(newMin);
      if (!isDragging) {
        commitChange(newMin, localMax);
      }
    },
    [localMax, step, isDragging, commitChange]
  );

  const handleMaxChange = useCallback(
    (value: number) => {
      const newMax = Math.max(value, localMin + step);
      setLocalMax(newMax);
      if (!isDragging) {
        commitChange(localMin, newMax);
      }
    },
    [localMin, step, isDragging, commitChange]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    commitChange(localMin, localMax);
  }, [localMin, localMax, commitChange]);

  // Reset filter
  const handleReset = useCallback(() => {
    setLocalMin(min);
    setLocalMax(max);
    onRangeChange(undefined);
  }, [min, max, onRangeChange]);

  // Calculate histogram bar heights
  const histogramData = useMemo(() => {
    if (!histogramBins || histogramBins.length === 0) return null;
    const maxBin = Math.max(...histogramBins);
    return histogramBins.map((count) => (maxBin > 0 ? count / maxBin : 0));
  }, [histogramBins]);

  const isFiltered = currentRange !== undefined;

  return (
    <div className="p-3 space-y-3">
      {/* Histogram */}
      {histogramData && (
        <div className="h-12 flex items-end gap-px">
          {histogramData.map((height, i) => (
            <div
              key={i}
              className="flex-1 bg-zinc-300 rounded-t-sm transition-colors"
              style={{
                height: `${height * 100}%`,
                minHeight: height > 0 ? '2px' : '0',
              }}
            />
          ))}
        </div>
      )}

      {/* Range slider */}
      <div className="relative h-6">
        {/* Track */}
        <div className="absolute inset-x-0 top-2.5 h-1 bg-zinc-200 rounded" />

        {/* Selected range */}
        <div
          className="absolute top-2.5 h-1 bg-zinc-500 rounded"
          style={{
            left: `${((localMin - min) / range) * 100}%`,
            right: `${100 - ((localMax - min) / range) * 100}%`,
          }}
        />

        {/* Min thumb */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={localMin}
          onChange={(e) => handleMinChange(parseFloat(e.target.value))}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={handleDragEnd}
          onTouchEnd={handleDragEnd}
          className="absolute inset-x-0 top-0 h-6 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-zinc-400 [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing"
        />

        {/* Max thumb */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={localMax}
          onChange={(e) => handleMaxChange(parseFloat(e.target.value))}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={handleDragEnd}
          onTouchEnd={handleDragEnd}
          className="absolute inset-x-0 top-0 h-6 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-zinc-400 [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing"
        />
      </div>

      {/* Min/Max inputs */}
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={localMin.toFixed(2)}
          onChange={(e) => handleMinChange(parseFloat(e.target.value) || min)}
          onBlur={() => commitChange(localMin, localMax)}
          className="w-20 px-2 py-1 text-xs border border-zinc-200 rounded focus-ring"
          step={step}
        />
        <span className="text-zinc-400">-</span>
        <input
          type="number"
          value={localMax.toFixed(2)}
          onChange={(e) => handleMaxChange(parseFloat(e.target.value) || max)}
          onBlur={() => commitChange(localMin, localMax)}
          className="w-20 px-2 py-1 text-xs border border-zinc-200 rounded focus-ring"
          step={step}
        />
        {isFiltered && (
          <button
            onClick={handleReset}
            className="ml-auto text-xs text-zinc-500 hover:text-zinc-700"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
