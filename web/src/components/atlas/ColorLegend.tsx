import { useMemo } from 'react';
import type { LegendInfo } from '../../hooks/useColorScale';
import { interpolateViridis } from 'd3-scale-chromatic';

interface ColorLegendProps {
  legend: LegendInfo;
}

export function ColorLegend({ legend }: ColorLegendProps) {
  if (legend.type === 'categorical' && legend.entries) {
    return <CategoricalLegend title={legend.title} entries={legend.entries} />;
  }

  if (legend.type === 'continuous' && legend.min !== undefined) {
    return (
      <ContinuousLegend
        title={legend.title}
        min={legend.min}
        max={legend.max!}
        unit={legend.unit}
      />
    );
  }

  return null;
}

interface CategoricalLegendProps {
  title: string;
  entries: Array<{ key: string; color: string }>;
}

function CategoricalLegend({ title, entries }: CategoricalLegendProps) {
  // Limit to 12 entries for display in compact legend, show "and X more" if needed
  const displayEntries = entries.slice(0, 12);
  const moreCount = entries.length - displayEntries.length;

  return (
    <div>
      <h3 className="text-xs font-medium text-zinc-700 mb-2">{title}</h3>
      <div className="space-y-0.5 max-h-48 overflow-y-auto">
        {displayEntries.map(({ key, color }) => (
          <div key={key} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs text-zinc-600 leading-tight">{key}</span>
          </div>
        ))}
        {moreCount > 0 && (
          <div className="text-xs text-zinc-400 pt-1">
            +{moreCount} more
          </div>
        )}
      </div>
    </div>
  );
}

interface ContinuousLegendProps {
  title: string;
  min: number;
  max: number;
  unit?: string;
}

function ContinuousLegend({ title, min, max, unit }: ContinuousLegendProps) {
  // Generate gradient stops from viridis
  const gradientStyle = useMemo(() => {
    const stops: string[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const color = interpolateViridis(t);
      stops.push(`${color} ${t * 100}%`);
    }
    return {
      background: `linear-gradient(to right, ${stops.join(', ')})`,
    };
  }, []);

  return (
    <div>
      <h3 className="text-xs font-medium text-zinc-700 mb-2">{title}</h3>
      <div className="flex flex-col gap-1">
        <div
          className="h-2.5 rounded"
          style={gradientStyle}
        />
        <div className="flex justify-between text-xs text-zinc-500">
          <span>{min.toFixed(2)}</span>
          <span>{max.toFixed(2)}</span>
        </div>
        {unit && (
          <p className="text-[10px] text-zinc-400 mt-0.5">{unit}</p>
        )}
      </div>
    </div>
  );
}
