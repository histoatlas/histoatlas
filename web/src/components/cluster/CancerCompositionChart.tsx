import { useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { CANCER_TYPE_COLORS } from '../../lib/colors';
import { Skeleton } from '../ui/Skeleton';
import { InfoTooltip } from '../ui/InfoTooltip';
import { Icon } from '../ui/Icon';

interface CancerCompositionChartProps {
  composition?: Record<string, number>;
  nSlides?: number;
  isLoading: boolean;
  /** Maximum number of cancer types to show (default: 10). Set to Infinity to show all. */
  maxTypes?: number;
  /** Hide the title row (icon + heading + tooltip). Default: false. */
  hideTitle?: boolean;
  /** Hide the card wrapper (border + padding). Default: false. */
  hideCard?: boolean;
}

export function CancerCompositionChart({
  composition,
  nSlides,
  isLoading,
  maxTypes = 10,
  hideTitle = false,
  hideCard = false,
}: CancerCompositionChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const { entries, xScale } = useMemo(() => {
    if (!composition) return { entries: [], xScale: scaleLinear() };

    const sorted = Object.entries(composition).sort(([, a], [, b]) => b - a);
    const visible = maxTypes === Infinity ? sorted : sorted.slice(0, maxTypes);

    const entries: { label: string; proportion: number; color: string; count: number }[] =
      visible.map(([type, proportion]) => ({
        label: type,
        proportion,
        color: CANCER_TYPE_COLORS[type] || '#808080',
        count: nSlides != null ? Math.round(proportion * nSlides) : 0,
      }));

    const maxProportion = Math.max(...entries.map((e) => e.proportion));
    const xScale = scaleLinear().domain([0, maxProportion]).range([0, 200]);

    return { entries, xScale };
  }, [composition, nSlides, maxTypes]);

  if (isLoading) {
    return (
      <div className={hideCard ? '' : 'bg-white border border-zinc-200 rounded-lg p-5'}>
        {!hideTitle && <Skeleton className="h-5 w-44 mb-4" />}
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-10 h-4" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!composition || entries.length === 0) return null;

  const rowHeight = 24;
  const labelWidth = 50;
  const chartWidth = 270;
  const svgHeight = entries.length * rowHeight + 4;

  const hovered = hoveredIndex != null ? entries[hoveredIndex] : null;

  return (
    <div className={hideCard ? '' : 'bg-white border border-zinc-200 rounded-lg p-5'}>
      {!hideTitle && (
        <h2 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
          <Icon name="pie-chart" size={18} className="text-zinc-400" />
          Cancer Composition
          <InfoTooltip text="Proportion of slides by cancer type within this cluster. Shows the top 10 cancer types; remaining types are grouped under 'Other'." />
        </h2>
      )}

      <div className="relative">
        <svg
          viewBox={`0 0 ${chartWidth} ${svgHeight}`}
          className="max-w-sm w-full"
          preserveAspectRatio="xMinYMin meet"
          onMouseLeave={() => setHoveredIndex(null)}
          role="img"
          aria-label={`Cancer type composition of histopathology slides: ${entries.slice(0, 3).map(e => `${e.label} ${(e.proportion * 100).toFixed(1)}%`).join(', ')}${entries.length > 3 ? ` and ${entries.length - 3} more` : ''}${nSlides != null ? ` across ${nSlides} slides` : ''}`}
        >
          {entries.map((entry, i) => {
            const y = i * rowHeight + 2;
            const barWidth = xScale(entry.proportion);
            const pctText = `${(entry.proportion * 100).toFixed(1)}%`;
            const isHovered = hoveredIndex === i;

            return (
              <g
                key={entry.label}
                onMouseEnter={() => setHoveredIndex(i)}
                className="cursor-pointer"
              >
                {/* Invisible hit area for the full row */}
                <rect
                  x={0}
                  y={y}
                  width={chartWidth}
                  height={rowHeight}
                  fill="transparent"
                />
                {/* Highlight background */}
                {isHovered && (
                  <rect
                    x={0}
                    y={y}
                    width={chartWidth}
                    height={rowHeight}
                    fill="#f4f4f5"
                    rx={3}
                  />
                )}
                <text
                  x={hideCard ? 2 : labelWidth - 4}
                  y={y + rowHeight / 2}
                  textAnchor={hideCard ? 'start' : 'end'}
                  dominantBaseline="middle"
                  className={hideCard
                    ? `text-[11px] font-medium ${isHovered ? 'fill-zinc-900 font-semibold' : 'fill-zinc-900'}`
                    : `text-[9px] ${isHovered ? 'fill-zinc-900 font-medium' : 'fill-zinc-700'}`
                  }
                >
                  {entry.label}
                </text>
                <rect
                  x={labelWidth}
                  y={y + 4}
                  width={barWidth}
                  height={rowHeight - 8}
                  rx={2}
                  fill={entry.color}
                  opacity={hoveredIndex != null && !isHovered ? 0.4 : 1}
                  style={{ transition: 'opacity 150ms' }}
                />
                {!hideCard && (
                  <text
                    x={labelWidth + barWidth + 4}
                    y={y + rowHeight / 2}
                    dominantBaseline="middle"
                    className="text-[9px] fill-zinc-500"
                  >
                    {pctText}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {hovered && hoveredIndex != null && nSlides != null && (
          <div
            className="absolute bg-zinc-800 text-white text-xs rounded shadow-lg px-2.5 py-1.5 pointer-events-none z-10 whitespace-nowrap"
            style={{
              left: '50%',
              transform: 'translateX(-50%)',
              top: `${(hoveredIndex * rowHeight / svgHeight) * 100}%`,
              marginTop: -32,
            }}
          >
            <span className="font-medium">{hovered.label}</span>
            {' \u2014 '}
            {hovered.count} slide{hovered.count !== 1 ? 's' : ''}
            {' '}({(hovered.proportion * 100).toFixed(1)}%)
          </div>
        )}
      </div>
    </div>
  );
}
