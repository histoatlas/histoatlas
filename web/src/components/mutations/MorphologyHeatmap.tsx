import type { MorphologyHeatmapCell, MorphologyHeatmapResponse } from '../../types';

// Diverging palette: coral → white → teal
const DIVERGING = [
  '#C23B22', '#E07A5F', '#F0A990', '#F7D6C8',
  '#F7F7F7',
  '#C8DFE8', '#62B6CB', '#1B4965',
];

const CELL_W = 52;
const CELL_H = 40;
const LABEL_W = 160;
const TOP_MARGIN = 30;
const LEFT_MARGIN = 10;
const LEGEND_W = 60;

function deltaToColor(delta: number | null, maxAbs: number): string {
  if (delta == null) return '#F0F0F0';
  const clamped = Math.max(-maxAbs, Math.min(delta, maxAbs));
  // Map [-maxAbs, maxAbs] → [0, 1]
  const t = (clamped + maxAbs) / (2 * maxAbs);
  const idx = t * (DIVERGING.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.min(lower + 1, DIVERGING.length - 1);
  const frac = idx - lower;

  const parse = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const lerp = (a: number, b: number, f: number) => Math.round(a + (b - a) * f);

  const [r1, g1, b1] = parse(DIVERGING[lower]);
  const [r2, g2, b2] = parse(DIVERGING[upper]);
  return `rgb(${lerp(r1, r2, frac)},${lerp(g1, g2, frac)},${lerp(b1, b2, frac)})`;
}

interface MorphologyHeatmapProps {
  data: MorphologyHeatmapResponse;
  gene: string;
}

export function MorphologyHeatmap({ data, gene }: MorphologyHeatmapProps) {
  const { features, featureLabels, cancerTypes, cells } = data;

  if (features.length === 0 || cancerTypes.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No morphology association data available.
      </p>
    );
  }

  const lookup = new Map<string, (typeof cells)[0]>();
  for (const c of cells) {
    lookup.set(`${c.feature}:${c.cancerType}`, c);
  }

  // Symmetric color range, clamped at 0.6
  const allEffects = cells.map((c: MorphologyHeatmapCell) => Math.abs(c.effectSize ?? 0));
  const maxAbs = Math.min(Math.max(...allEffects, 0.1), 0.6);

  const svgW = LEFT_MARGIN + LABEL_W + cancerTypes.length * CELL_W + LEGEND_W;
  const svgH = TOP_MARGIN + features.length * CELL_H + 40;

  // Legend ticks
  const legendTicks = [-maxAbs, -maxAbs / 2, 0, maxAbs / 2, maxAbs];

  return (
    <figure
      role="figure"
      aria-label={`Heatmap showing Cliff's delta effect sizes for ${gene.toUpperCase()} mutation across cancer types`}
    >
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          width={svgW}
          style={{ display: 'block', minWidth: svgW }}
        >
          {/* Column labels (cancer types) */}
          {cancerTypes.map((ct: string, i: number) => (
            <text
              key={ct}
              x={LEFT_MARGIN + LABEL_W + i * CELL_W + CELL_W / 2}
              y={TOP_MARGIN - 10}
              textAnchor="middle"
              fontSize={11}
              fill="#2D3142"
              fontFamily="system-ui, sans-serif"
            >
              {ct}
            </text>
          ))}

          {/* Rows */}
          {features.map((feat: string, rowIdx: number) => (
            <g key={feat}>
              {/* Row label */}
              <text
                x={LEFT_MARGIN + LABEL_W - 8}
                y={TOP_MARGIN + rowIdx * CELL_H + CELL_H / 2 + 4}
                textAnchor="end"
                fontSize={11}
                fill="#2D3142"
                fontFamily="system-ui, sans-serif"
              >
                {featureLabels[rowIdx]}
              </text>

              {/* Cells */}
              {cancerTypes.map((ct: string, colIdx: number) => {
                const cell = lookup.get(`${feat}:${ct}`);
                const es = cell?.effectSize ?? null;
                const sig = cell?.isSignificant ?? false;
                const n = cell?.nSamples ?? 0;
                return (
                  <g key={`${ct}-${feat}`}>
                    <rect
                      x={LEFT_MARGIN + LABEL_W + colIdx * CELL_W + 1}
                      y={TOP_MARGIN + rowIdx * CELL_H + 1}
                      width={CELL_W - 2}
                      height={CELL_H - 2}
                      fill={deltaToColor(es, maxAbs)}
                      rx={3}
                    >
                      <title>
                        {`${featureLabels[rowIdx]} × ${ct}: δ = ${es != null ? es.toFixed(2) : 'N/A'}, N = ${n}`}
                      </title>
                    </rect>
                    <text
                      x={LEFT_MARGIN + LABEL_W + colIdx * CELL_W + CELL_W / 2}
                      y={TOP_MARGIN + rowIdx * CELL_H + CELL_H / 2 + 4}
                      textAnchor="middle"
                      fontSize={10}
                      fill={es != null && Math.abs(es) > maxAbs * 0.7 ? '#fff' : '#2D3142'}
                      fontFamily="system-ui, sans-serif"
                      fontWeight={sig ? 600 : 400}
                    >
                      {es != null ? es.toFixed(2) : '—'}
                    </text>
                  </g>
                );
              })}
            </g>
          ))}

          {/* Legend */}
          <text
            x={LEFT_MARGIN + LABEL_W + cancerTypes.length * CELL_W + 12}
            y={TOP_MARGIN - 8}
            fontSize={9}
            fill="#6B7280"
            fontFamily="system-ui, sans-serif"
          >
            Cliff&apos;s δ
          </text>
          {legendTicks.map((val, i) => (
            <g key={val}>
              <rect
                x={LEFT_MARGIN + LABEL_W + cancerTypes.length * CELL_W + 12}
                y={TOP_MARGIN + i * 22}
                width={18}
                height={18}
                fill={deltaToColor(val, maxAbs)}
                rx={2}
              />
              <text
                x={LEFT_MARGIN + LABEL_W + cancerTypes.length * CELL_W + 34}
                y={TOP_MARGIN + i * 22 + 13}
                fontSize={9}
                fill="#6B7280"
                fontFamily="system-ui, sans-serif"
              >
                {val >= 0 ? '+' : ''}{val.toFixed(2)}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <figcaption className="mt-3 text-sm text-zinc-700 leading-relaxed">
        <strong>Figure.</strong> {gene.toUpperCase()} mutation is associated with distinct
        morphological phenotypes across cancer types. Heatmap shows Cliff&apos;s delta
        effect sizes (mutant vs wild-type) for the five most associated histomic features.
        Bold values indicate BH-adjusted significance (p &lt; 0.05). Positive delta
        indicates higher feature values in mutant samples.
        <br />
        <span className="text-xs text-zinc-500">
          Data: HistoAtlas / TCGA. Mann–Whitney U test, Cliff&apos;s delta, BH correction
          (p &lt; 0.05).
        </span>
      </figcaption>
    </figure>
  );
}
