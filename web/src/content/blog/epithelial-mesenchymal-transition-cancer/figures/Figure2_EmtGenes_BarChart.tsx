import React from 'react';

const C = {
  primary: '#1B4965',
  secondary: '#62B6CB',
  accent: '#E07A5F',
  warm: '#F2CC8F',
  dark: '#2D3142',
  grid: '#E8ECEF',
  bg: '#FAFBFC',
};

interface GeneCorrelation {
  gene: string;
  feature: string;
  featureLabel: string;
  rho: number;
}

const DATA: GeneCorrelation[] = [
  { gene: 'ZEB1', feature: 'tumor_stroma_interface_density', featureLabel: 'Tumor-stroma interface', rho: 0.45 },
  { gene: 'ZEB1', feature: 'tumor_front_fraction', featureLabel: 'Tumor front fraction', rho: 0.45 },
  { gene: 'ZEB1', feature: 'stroma_area_fraction', featureLabel: 'Stroma fraction', rho: 0.42 },
  { gene: 'VIM', feature: 'lymphocyte_infiltration_ratio_front', featureLabel: 'Lymphocyte infiltration', rho: 0.31 },
  { gene: 'SNAI1', feature: 'intratumoral_cancer_cell_density', featureLabel: 'Cancer cell density', rho: -0.29 },
  { gene: 'TWIST1', feature: 'tumor_stroma_interface_density', featureLabel: 'Tumor-stroma interface', rho: 0.26 },
  { gene: 'TWIST1', feature: 'stroma_area_fraction', featureLabel: 'Stroma fraction', rho: 0.26 },
  { gene: 'FN1', feature: 'tumor_front_fraction', featureLabel: 'Tumor front fraction', rho: 0.26 },
  { gene: 'CDH1', feature: 'lymphocyte_infiltration_ratio_front', featureLabel: 'Lymphocyte infiltration', rho: -0.26 },
];

const GENE_COLORS: Record<string, string> = {
  ZEB1: C.primary,
  VIM: C.secondary,
  SNAI1: C.accent,
  TWIST1: '#5B8E7D',
  FN1: C.warm,
  CDH1: '#8D6B94',
};

export default function Figure2_EmtGenes_BarChart() {
  const maxAbs = Math.max(...DATA.map((d) => Math.abs(d.rho)));
  const barMaxW = 280;

  const barH = 26;
  const gap = 6;
  const labelW = 220;
  const geneW = 55;
  const pad = { top: 30, left: geneW + labelW + 10, right: 60, bottom: 50 };
  const plotH = DATA.length * (barH + gap);
  const width = pad.left + barMaxW + pad.right;
  const height = pad.top + plotH + pad.bottom;

  const centerX = pad.left + barMaxW / 2;

  return (
    <figure
      role="figure"
      aria-label="Horizontal bar chart showing Spearman correlations between EMT transcription factor genes and histomic features in TCGA-BRCA"
      style={{
        margin: '2rem 0',
        padding: '1.5rem',
        background: C.bg,
        borderRadius: '8px',
        border: `1px solid ${C.grid}`,
      }}
    >
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
        {/* Center axis */}
        <line
          x1={centerX}
          y1={pad.top - 5}
          x2={centerX}
          y2={pad.top + plotH + 5}
          stroke={C.grid}
          strokeWidth={1}
        />

        {/* Grid lines */}
        {[-0.4, -0.2, 0.2, 0.4].map((v) => {
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
        {DATA.map((d, i) => {
          const y = pad.top + i * (barH + gap);
          const barW = (Math.abs(d.rho) / maxAbs) * (barMaxW / 2);
          const x = d.rho >= 0 ? centerX : centerX - barW;
          const color = GENE_COLORS[d.gene] || C.primary;

          return (
            <g key={i}>
              {/* Gene label */}
              <text
                x={geneW - 4}
                y={y + barH / 2 + 4}
                textAnchor="end"
                fontSize={11}
                fontWeight={600}
                fontStyle="italic"
                fill={color}
              >
                {d.gene}
              </text>
              {/* Feature label */}
              <text
                x={geneW + 4}
                y={y + barH / 2 + 4}
                textAnchor="start"
                fontSize={10}
                fill={C.dark}
              >
                {d.featureLabel}
              </text>
              {/* Bar */}
              <rect
                x={x}
                y={y + 2}
                width={barW}
                height={barH - 4}
                rx={3}
                fill={color}
                opacity={0.85}
              >
                <title>{`${d.gene} × ${d.featureLabel}: ρ = ${d.rho.toFixed(2)}`}</title>
              </rect>
              {/* Value */}
              <text
                x={d.rho >= 0 ? centerX + barW + 5 : centerX - barW - 5}
                y={y + barH / 2 + 4}
                textAnchor={d.rho >= 0 ? 'start' : 'end'}
                fontSize={10}
                fontWeight={500}
                fill={C.dark}
              >
                {d.rho > 0 ? '+' : ''}{d.rho.toFixed(2)}
              </text>
            </g>
          );
        })}

        {/* X-axis labels */}
        {[-0.4, -0.2, 0, 0.2, 0.4].map((v) => {
          const x = centerX + (v / maxAbs) * (barMaxW / 2);
          return (
            <text
              key={v}
              x={x}
              y={pad.top + plotH + 20}
              textAnchor="middle"
              fontSize={10}
              fill={C.dark}
            >
              {v === 0 ? '0' : (v > 0 ? '+' : '') + v.toFixed(1)}
            </text>
          );
        })}
        <text
          x={centerX}
          y={pad.top + plotH + 38}
          textAnchor="middle"
          fontSize={11}
          fill={C.dark}
        >
          Spearman ρ
        </text>

        {/* Direction annotations */}
        <text x={pad.left + barMaxW - 5} y={pad.top - 12} textAnchor="end" fontSize={9} fill={C.secondary} fontWeight={500}>
          Mesenchymal →
        </text>
        <text x={pad.left + 5} y={pad.top - 12} textAnchor="start" fontSize={9} fill={C.accent} fontWeight={500}>
          ← Epithelial
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
        <strong>Figure 2.</strong> Spearman correlations between canonical EMT transcription
        factor/marker gene expression and histomic features in TCGA-BRCA (n = 958). Mesenchymal
        markers (<em>ZEB1</em>, <em>VIM</em>, <em>TWIST1</em>, <em>FN1</em>) positively correlate
        with stromal expansion and tumor front activity, while the epithelial marker <em>CDH1</em>{' '}
        (E-cadherin) shows inverse associations. <em>SNAI1</em> expression correlates with reduced
        intratumoral cancer cell density, consistent with EMT-driven cell dispersal.
        <br />
        <span style={{ color: '#6B7280', fontSize: '0.8rem' }}>
          Data: HistoAtlas / TCGA-BRCA (n = 958). All shown correlations FDR &lt; 0.05.
        </span>
      </figcaption>
    </figure>
  );
}
