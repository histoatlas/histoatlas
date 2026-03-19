interface MiniHistogramProps {
  bins: number[];
  percentile: number; // 0-100
  color?: string;
}

export function MiniHistogram({
  bins,
  percentile,
  color = '#3b82f6',
}: MiniHistogramProps) {
  if (!bins || bins.length === 0) return null;

  const maxBin = Math.max(...bins);
  const normalizedBins = bins.map((count) => (maxBin > 0 ? count / maxBin : 0));

  // Determine which bin the percentile falls into
  const activeBinIndex = Math.min(
    Math.floor((percentile / 100) * bins.length),
    bins.length - 1
  );

  return (
    <div className="h-6 w-20 flex items-end gap-px">
      {normalizedBins.map((height, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm"
          style={{
            height: `${Math.max(height * 100, 4)}%`,
            backgroundColor: i === activeBinIndex ? color : '#d4d4d8',
          }}
        />
      ))}
    </div>
  );
}
