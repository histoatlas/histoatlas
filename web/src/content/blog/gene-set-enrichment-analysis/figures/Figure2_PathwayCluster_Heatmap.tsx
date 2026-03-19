import React from 'react';

const C = {
  dark: '#2D3142',
  grid: '#E8ECEF',
  bg: '#FAFBFC',
};

// Diverging palette: negative (coral) → white → positive (teal)
const DIVERGING = [
  '#E07A5F', '#F0A990', '#F7D6C8',
  '#F7F7F7',
  '#C8DFE8', '#62B6CB', '#1B4965',
];

function interpolateColor(value: number, min: number, max: number): string {
  const absMax = Math.max(Math.abs(min), Math.abs(max));
  const t = Math.max(-1, Math.min(1, value / absMax));
  const normalized = (t + 1) / 2; // 0 to 1
  const idx = normalized * (DIVERGING.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return DIVERGING[lo];
  const frac = idx - lo;
  return lerpColor(DIVERGING[lo], DIVERGING[hi], frac);
}

function lerpColor(a: string, b: string, t: number): string {
  const parse = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const bl = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${bl})`;
}

interface HeatmapDatum {
  pathway: string;
  cluster: number;
  cliffsDelta: number;
  significant: boolean;
}

interface Props {
  data: HeatmapDatum[];
  pathways: string[];
  clusterNames: string[];
}

export default function Figure2_PathwayCluster_Heatmap({
  data,
  pathways,
  clusterNames,
}: Props) {
  const cellW = 52;
  const cellH = 22;
  const labelW = 180;
  const topLabelH = 140;
  const pad = { top: 10, right: 20, bottom: 30, left: 10 };

  const nCols = clusterNames.length;
  const nRows = pathways.length;
  const width = pad.left + labelW + nCols * cellW + pad.right + 60; // 60 for legend
  const height = pad.top + topLabelH + nRows * cellH + pad.bottom;

  const lookup = new Map<string, HeatmapDatum>();
  for (const d of data) {
    lookup.set(`${d.pathway}_${d.cluster}`, d);
  }

  const values = data.map((d) => d.cliffsDelta);
  const vMin = Math.min(...values);
  const vMax = Math.max(...values);

  const gridLeft = pad.left + labelW;
  const gridTop = pad.top + topLabelH;

  // Legend dimensions
  const legendX = gridLeft + nCols * cellW + 14;
  const legendH = nRows * cellH;
  const legendW = 12;

  return (
    <figure
      role="figure"
      aria-label="Heatmap of pathway enrichment (Cliff's delta) across 10 morphological clusters, showing which biological programs are enriched or depleted in each cluster"
      style={{
        margin: '2rem 0',
        padding: '1.5rem',
        background: C.bg,
        borderRadius: '8px',
        border: `1px solid ${C.grid}`,
        overflowX: 'auto',
      }}
    >
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', minWidth: 600 }}>
        {/* Column labels (cluster names, rotated) */}
        {clusterNames.map((name, ci) => (
          <text
            key={ci}
            x={gridLeft + ci * cellW + cellW / 2}
            y={gridTop - 8}
            textAnchor="start"
            dominantBaseline="auto"
            fontSize={10}
            fill={C.dark}
            transform={`rotate(-50, ${gridLeft + ci * cellW + cellW / 2}, ${gridTop - 8})`}
          >
            {name.length > 18 ? name.slice(0, 18) + '...' : name}
          </text>
        ))}

        {/* Row labels (pathway names) */}
        {pathways.map((pw, ri) => (
          <text
            key={ri}
            x={gridLeft - 6}
            y={gridTop + ri * cellH + cellH / 2 + 4}
            textAnchor="end"
            fontSize={10}
            fill={C.dark}
          >
            {pw.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
          </text>
        ))}

        {/* Heatmap cells */}
        {pathways.map((pw, ri) =>
          clusterNames.map((_, ci) => {
            const d = lookup.get(`${pw}_${ci}`);
            const val = d ? d.cliffsDelta : 0;
            const sig = d ? d.significant : false;
            return (
              <g key={`${ri}_${ci}`}>
                <rect
                  x={gridLeft + ci * cellW}
                  y={gridTop + ri * cellH}
                  width={cellW}
                  height={cellH}
                  fill={interpolateColor(val, vMin, vMax)}
                  stroke="#fff"
                  strokeWidth={1}
                />
                {sig && (
                  <text
                    x={gridLeft + ci * cellW + cellW / 2}
                    y={gridTop + ri * cellH + cellH / 2 + 3.5}
                    textAnchor="middle"
                    fontSize={9}
                    fontWeight={600}
                    fill={Math.abs(val) > 0.4 ? '#fff' : C.dark}
                  >
                    {val > 0 ? '+' : ''}{val.toFixed(2)}
                  </text>
                )}
                <title>
                  {`${pw.replace(/_/g, ' ')}, Cluster ${ci}: d=${val.toFixed(3)}${sig ? ' *' : ''}`}
                </title>
              </g>
            );
          }),
        )}

        {/* Color legend */}
        <defs>
          <linearGradient id="hm-legend" x1="0" y1="1" x2="0" y2="0">
            {DIVERGING.map((color, i) => (
              <stop
                key={i}
                offset={`${(i / (DIVERGING.length - 1)) * 100}%`}
                stopColor={color}
              />
            ))}
          </linearGradient>
        </defs>
        <rect
          x={legendX}
          y={gridTop + (legendH - 120) / 2}
          width={legendW}
          height={120}
          fill="url(#hm-legend)"
          stroke={C.grid}
          strokeWidth={0.5}
        />
        <text x={legendX + legendW + 4} y={gridTop + (legendH - 120) / 2 + 8} fontSize={9} fill={C.dark}>
          +0.8
        </text>
        <text x={legendX + legendW + 4} y={gridTop + (legendH - 120) / 2 + 63} fontSize={9} fill={C.dark}>
          0
        </text>
        <text x={legendX + legendW + 4} y={gridTop + (legendH - 120) / 2 + 118} fontSize={9} fill={C.dark}>
          -0.6
        </text>
        <text
          x={legendX + legendW / 2}
          y={gridTop + (legendH - 120) / 2 - 8}
          textAnchor="middle"
          fontSize={9}
          fill={C.dark}
        >
          Cliff&apos;s d
        </text>
      </svg>
      <figcaption
        style={{
          marginTop: '0.75rem',
          fontSize: '0.85rem',
          color: C.dark,
          lineHeight: 1.5,
        }}
      >
        <strong>Figure 2.</strong> Pathway enrichment across 10 pan-cancer morphological clusters.
        Each cell shows the Cliff&apos;s delta effect size comparing pathway scores inside vs.
        outside the cluster. Values shown in cells are statistically significant (BH-adjusted p &lt; 0.05).
        Positive values (teal) indicate enrichment; negative (coral) indicate depletion.
        <br />
        <span style={{ color: '#6B7280', fontSize: '0.8rem' }}>
          Data: HistoAtlas / TCGA (n=5,877 slides across 10 clusters)
        </span>
      </figcaption>
    </figure>
  );
}
