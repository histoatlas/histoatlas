import React from 'react';

const C = {
  primary: '#1B4965',
  secondary: '#62B6CB',
  accent: '#E07A5F',
  dark: '#2D3142',
  grid: '#E8ECEF',
  bg: '#FAFBFC',
  enriched: '#1B4965',
  depleted: '#E07A5F',
};

interface ClusterEmt {
  clusterId: number;
  name: string;
  emtDiff: number;
  pAdj: number;
  nSlides: number;
  significant: boolean;
}

const DATA: ClusterEmt[] = [
  { clusterId: 8, name: 'Immune-Cold, High-Interface (BRCA)', emtDiff: 0.103, pAdj: 7.26e-39, nSlides: 1199, significant: true },
  { clusterId: 9, name: 'Immune-Mixed, Tumor-Sparse', emtDiff: 0.061, pAdj: 4.82e-8, nSlides: 1100, significant: true },
  { clusterId: 2, name: 'Immune-Mixed, Round-Nuclei (LIHC)', emtDiff: 0.057, pAdj: 2.96e-7, nSlides: 607, significant: true },
  { clusterId: 3, name: 'Immune-Mixed, Eosinophil-Rich', emtDiff: 0.023, pAdj: 1.20e-2, nSlides: 1012, significant: true },
  { clusterId: 0, name: 'Immune-Cold, Homo-Density', emtDiff: -0.054, pAdj: 1.05e-1, nSlides: 102, significant: false },
  { clusterId: 1, name: 'Immune-Mixed, Myeloid-Skewed', emtDiff: -0.054, pAdj: 4.79e-4, nSlides: 312, significant: true },
  { clusterId: 5, name: 'Immune-Cold, Lymph-Distant', emtDiff: -0.039, pAdj: 2.24e-2, nSlides: 488, significant: true },
  { clusterId: 7, name: 'Immune-Mixed, Core-Dominant', emtDiff: -0.081, pAdj: 1.16e-20, nSlides: 1020, significant: true },
  { clusterId: 6, name: 'Immune-Mixed, Variable (COAD)', emtDiff: -0.126, pAdj: 4.68e-29, nSlides: 709, significant: true },
  { clusterId: 4, name: 'Immune-Hot, Lymph-Proximal (THYM)', emtDiff: -0.141, pAdj: 7.58e-10, nSlides: 196, significant: true },
];

export default function Figure3_ClusterEmt_BarChart() {
  const sorted = [...DATA].sort((a, b) => b.emtDiff - a.emtDiff);
  const maxAbs = Math.max(...sorted.map((d) => Math.abs(d.emtDiff)));

  const barH = 30;
  const gap = 8;
  const labelW = 290;
  const barMaxW = 220;
  const pad = { top: 30, left: labelW + 10, right: 80, bottom: 50 };
  const plotH = sorted.length * (barH + gap);
  const width = pad.left + barMaxW + pad.right;
  const height = pad.top + plotH + pad.bottom;
  const centerX = pad.left + barMaxW / 2;

  function formatP(p: number): string {
    if (p < 1e-30) return 'p < 10⁻³⁰';
    if (p < 1e-10) return 'p < 10⁻¹⁰';
    if (p < 1e-5) return 'p < 10⁻⁵';
    if (p < 0.001) return `p = ${p.toExponential(0)}`;
    if (p < 0.05) return `p = ${p.toFixed(3)}`;
    return 'n.s.';
  }

  return (
    <figure
      role="figure"
      aria-label="Bar chart showing Hallmark EMT pathway enrichment scores across 10 pan-cancer morphology clusters from HistoAtlas"
      style={{
        margin: '2rem 0',
        padding: '1.5rem',
        background: C.bg,
        borderRadius: '8px',
        border: `1px solid ${C.grid}`,
      }}
    >
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
        {/* Center line */}
        <line
          x1={centerX}
          y1={pad.top - 5}
          x2={centerX}
          y2={pad.top + plotH + 5}
          stroke={C.dark}
          strokeWidth={1}
          opacity={0.3}
        />

        {/* Grid */}
        {[-0.1, -0.05, 0.05, 0.1].map((v) => {
          const x = centerX + (v / maxAbs) * (barMaxW / 2);
          return (
            <line
              key={v}
              x1={x}
              y1={pad.top - 5}
              x2={x}
              y2={pad.top + plotH + 5}
              stroke={C.grid}
              strokeWidth={0.5}
              strokeDasharray="3 3"
            />
          );
        })}

        {/* Bars */}
        {sorted.map((d, i) => {
          const y = pad.top + i * (barH + gap);
          const barW = (Math.abs(d.emtDiff) / maxAbs) * (barMaxW / 2);
          const x = d.emtDiff >= 0 ? centerX : centerX - barW;
          const color = d.emtDiff >= 0 ? C.enriched : C.depleted;
          const opacity = d.significant ? 0.85 : 0.35;
          // Place value/p labels to the right of the bar end for both directions
          // (for negative bars this means between bar right edge and center line)
          const valX = d.emtDiff >= 0 ? centerX + barW + 5 : centerX + 5;
          const valAnchor = 'start' as const;

          return (
            <g key={d.clusterId}>
              {/* Label */}
              <text
                x={pad.left - 8}
                y={y + barH / 2 + 4}
                textAnchor="end"
                fontSize={10}
                fill={C.dark}
              >
                <tspan fontWeight={600}>L1-{d.clusterId}</tspan>
                <tspan dx={4} fill="#6B7280">{d.name}</tspan>
              </text>
              {/* Bar */}
              <rect
                x={x}
                y={y + 3}
                width={barW}
                height={barH - 6}
                rx={3}
                fill={color}
                opacity={opacity}
              >
                <title>{`Cluster ${d.clusterId}: Δ EMT = ${d.emtDiff > 0 ? '+' : ''}${d.emtDiff.toFixed(3)}, ${formatP(d.pAdj)}, n = ${d.nSlides}`}</title>
              </rect>
              {/* Value + p */}
              <text
                x={valX}
                y={y + barH / 2 + 1}
                textAnchor={valAnchor}
                fontSize={9}
                fill={C.dark}
              >
                {d.emtDiff > 0 ? '+' : ''}{d.emtDiff.toFixed(3)}
              </text>
              <text
                x={valX}
                y={y + barH / 2 + 12}
                textAnchor={valAnchor}
                fontSize={8}
                fill="#9CA3AF"
              >
                {formatP(d.pAdj)}
              </text>
              {/* n */}
              <text
                x={width - pad.right + 10}
                y={y + barH / 2 + 4}
                textAnchor="start"
                fontSize={9}
                fill="#9CA3AF"
              >
                n={d.nSlides.toLocaleString()}
              </text>
            </g>
          );
        })}

        {/* Axis labels */}
        <text x={centerX} y={pad.top + plotH + 25} textAnchor="middle" fontSize={11} fill={C.dark}>
          Mean EMT score difference (cluster vs. rest)
        </text>
        <text x={pad.left + barMaxW - 5} y={pad.top - 12} textAnchor="end" fontSize={9} fill={C.enriched} fontWeight={500}>
          EMT-enriched →
        </text>
        <text x={pad.left + 5} y={pad.top - 12} textAnchor="start" fontSize={9} fill={C.depleted} fontWeight={500}>
          ← EMT-depleted
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
        <strong>Figure 3.</strong> Hallmark EMT pathway score enrichment across 10 pan-cancer morphology
        clusters (L1). Cluster 8 (BRCA-enriched, high tumor–stroma interface) shows the strongest
        EMT enrichment (p &lt; 10⁻³⁰), while Cluster 4 (immune-hot, THYM-enriched) and Cluster 6
        (COAD-enriched) are the most EMT-depleted. Faded bars indicate non-significant enrichment
        (FDR &gt; 0.05). Enrichment is computed as the difference in mean Hallmark EMT pathway score between
        slides in the cluster and all other slides.
        <br />
        <span style={{ color: '#6B7280', fontSize: '0.8rem' }}>
          Data: HistoAtlas / TCGA (n = 6,745 slides, 10 pan-cancer clusters)
        </span>
      </figcaption>
    </figure>
  );
}
