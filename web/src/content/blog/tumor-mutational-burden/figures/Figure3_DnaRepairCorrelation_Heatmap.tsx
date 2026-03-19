import React from 'react';

const C = {
  dark: '#2D3142',
  grid: '#E8ECEF',
  bg: '#FAFBFC',
};

// Sequential palette for positive correlations
const SEQUENTIAL = [
  '#F7F7F7', '#D9E8F0', '#A8D0DB', '#62B6CB',
  '#3D8FA6', '#1B4965', '#0D2C3E',
];

interface CellData {
  cancer_type: string;
  feature: string;
  rho: number;
  significant: boolean;
  n: number;
}

const CANCER_TYPES = ['LUAD', 'LIHC', 'BRCA', 'BLCA', 'MESO', 'PAAD', 'UCEC', 'CESC', 'THCA', 'COAD', 'LUSC'];
const FEATURES = [
  'mitotic_index_tumor',
  'tumor_pleomorphism_index',
  'intratumoral_lymphocyte_density',
  'peritumoral_immune_richness',
  'stromal_lymphocyte_density',
];
const FEATURE_LABELS: Record<string, string> = {
  mitotic_index_tumor: 'Mitotic index',
  tumor_pleomorphism_index: 'Pleomorphism',
  intratumoral_lymphocyte_density: 'TIL density',
  peritumoral_immune_richness: 'Peritumoral immune',
  stromal_lymphocyte_density: 'Stromal lymphocytes',
};

// Pre-computed data from HistoAtlas MCP
const RAW_DATA: CellData[] = [
  { cancer_type: 'LUAD', feature: 'mitotic_index_tumor', rho: 0.538, significant: true, n: 437 },
  { cancer_type: 'LIHC', feature: 'mitotic_index_tumor', rho: 0.430, significant: true, n: 348 },
  { cancer_type: 'BRCA', feature: 'mitotic_index_tumor', rho: 0.405, significant: true, n: 958 },
  { cancer_type: 'BLCA', feature: 'mitotic_index_tumor', rho: 0.378, significant: true, n: 343 },
  { cancer_type: 'MESO', feature: 'mitotic_index_tumor', rho: 0.345, significant: true, n: 71 },
  { cancer_type: 'PAAD', feature: 'mitotic_index_tumor', rho: 0.298, significant: true, n: 129 },
  { cancer_type: 'UCEC', feature: 'mitotic_index_tumor', rho: 0.265, significant: true, n: 407 },
  { cancer_type: 'CESC', feature: 'mitotic_index_tumor', rho: 0.237, significant: true, n: 259 },
  { cancer_type: 'THCA', feature: 'mitotic_index_tumor', rho: 0.193, significant: true, n: 451 },
  { cancer_type: 'COAD', feature: 'mitotic_index_tumor', rho: 0.176, significant: true, n: 413 },
  { cancer_type: 'LUSC', feature: 'mitotic_index_tumor', rho: 0.149, significant: true, n: 318 },
  { cancer_type: 'LUAD', feature: 'tumor_pleomorphism_index', rho: 0.268, significant: true, n: 437 },
  { cancer_type: 'LIHC', feature: 'tumor_pleomorphism_index', rho: 0.235, significant: true, n: 348 },
  { cancer_type: 'BRCA', feature: 'tumor_pleomorphism_index', rho: 0.285, significant: true, n: 958 },
  { cancer_type: 'BLCA', feature: 'tumor_pleomorphism_index', rho: 0.365, significant: true, n: 345 },
  { cancer_type: 'MESO', feature: 'tumor_pleomorphism_index', rho: 0.248, significant: false, n: 71 },
  { cancer_type: 'PAAD', feature: 'tumor_pleomorphism_index', rho: 0.135, significant: false, n: 129 },
  { cancer_type: 'UCEC', feature: 'tumor_pleomorphism_index', rho: 0.086, significant: false, n: 407 },
  { cancer_type: 'CESC', feature: 'tumor_pleomorphism_index', rho: 0.004, significant: false, n: 259 },
  { cancer_type: 'THCA', feature: 'tumor_pleomorphism_index', rho: -0.017, significant: false, n: 453 },
  { cancer_type: 'COAD', feature: 'tumor_pleomorphism_index', rho: 0.043, significant: false, n: 414 },
  { cancer_type: 'LUSC', feature: 'tumor_pleomorphism_index', rho: 0.026, significant: false, n: 326 },
  { cancer_type: 'LUAD', feature: 'intratumoral_lymphocyte_density', rho: -0.055, significant: false, n: 437 },
  { cancer_type: 'LIHC', feature: 'intratumoral_lymphocyte_density', rho: 0.116, significant: false, n: 348 },
  { cancer_type: 'BRCA', feature: 'intratumoral_lymphocyte_density', rho: 0.090, significant: true, n: 958 },
  { cancer_type: 'BLCA', feature: 'intratumoral_lymphocyte_density', rho: 0.252, significant: true, n: 345 },
  { cancer_type: 'MESO', feature: 'intratumoral_lymphocyte_density', rho: -0.039, significant: false, n: 71 },
  { cancer_type: 'PAAD', feature: 'intratumoral_lymphocyte_density', rho: 0.119, significant: false, n: 129 },
  { cancer_type: 'UCEC', feature: 'intratumoral_lymphocyte_density', rho: 0.130, significant: true, n: 407 },
  { cancer_type: 'CESC', feature: 'intratumoral_lymphocyte_density', rho: -0.024, significant: false, n: 259 },
  { cancer_type: 'THCA', feature: 'intratumoral_lymphocyte_density', rho: 0.147, significant: true, n: 453 },
  { cancer_type: 'COAD', feature: 'intratumoral_lymphocyte_density', rho: -0.033, significant: false, n: 414 },
  { cancer_type: 'LUSC', feature: 'intratumoral_lymphocyte_density', rho: -0.012, significant: false, n: 326 },
  { cancer_type: 'LUAD', feature: 'peritumoral_immune_richness', rho: 0.191, significant: true, n: 437 },
  { cancer_type: 'LIHC', feature: 'peritumoral_immune_richness', rho: 0.186, significant: true, n: 344 },
  { cancer_type: 'BRCA', feature: 'peritumoral_immune_richness', rho: 0.136, significant: true, n: 958 },
  { cancer_type: 'BLCA', feature: 'peritumoral_immune_richness', rho: 0.099, significant: false, n: 345 },
  { cancer_type: 'MESO', feature: 'peritumoral_immune_richness', rho: 0.111, significant: false, n: 71 },
  { cancer_type: 'PAAD', feature: 'peritumoral_immune_richness', rho: 0.270, significant: false, n: 129 },
  { cancer_type: 'UCEC', feature: 'peritumoral_immune_richness', rho: 0.036, significant: false, n: 407 },
  { cancer_type: 'CESC', feature: 'peritumoral_immune_richness', rho: 0.112, significant: false, n: 259 },
  { cancer_type: 'THCA', feature: 'peritumoral_immune_richness', rho: 0.188, significant: true, n: 452 },
  { cancer_type: 'COAD', feature: 'peritumoral_immune_richness', rho: -0.029, significant: false, n: 414 },
  { cancer_type: 'LUSC', feature: 'peritumoral_immune_richness', rho: -0.190, significant: true, n: 325 },
  { cancer_type: 'LUAD', feature: 'stromal_lymphocyte_density', rho: 0.066, significant: false, n: 438 },
  { cancer_type: 'LIHC', feature: 'stromal_lymphocyte_density', rho: 0.041, significant: false, n: 348 },
  { cancer_type: 'BRCA', feature: 'stromal_lymphocyte_density', rho: 0.303, significant: true, n: 958 },
  { cancer_type: 'BLCA', feature: 'stromal_lymphocyte_density', rho: 0.101, significant: false, n: 345 },
  { cancer_type: 'MESO', feature: 'stromal_lymphocyte_density', rho: -0.032, significant: false, n: 71 },
  { cancer_type: 'PAAD', feature: 'stromal_lymphocyte_density', rho: 0.089, significant: false, n: 129 },
  { cancer_type: 'UCEC', feature: 'stromal_lymphocyte_density', rho: 0.096, significant: false, n: 407 },
  { cancer_type: 'CESC', feature: 'stromal_lymphocyte_density', rho: 0.043, significant: false, n: 259 },
  { cancer_type: 'THCA', feature: 'stromal_lymphocyte_density', rho: 0.132, significant: true, n: 453 },
  { cancer_type: 'COAD', feature: 'stromal_lymphocyte_density', rho: -0.007, significant: false, n: 414 },
  { cancer_type: 'LUSC', feature: 'stromal_lymphocyte_density', rho: 0.051, significant: false, n: 326 },
];

function rhoToColor(rho: number): string {
  // Map negative values to very light gray, positive to blue sequential
  const clamped = Math.max(-0.2, Math.min(rho, 0.6));
  const t = clamped <= 0 ? 0 : clamped / 0.6;
  const idx = t * (SEQUENTIAL.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.min(lower + 1, SEQUENTIAL.length - 1);
  const frac = idx - lower;

  const lowerColor = SEQUENTIAL[lower];
  const upperColor = SEQUENTIAL[upper];

  // Simple linear interpolation in hex
  const lerp = (a: number, b: number, f: number) => Math.round(a + (b - a) * f);
  const parse = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];

  const [r1, g1, b1] = parse(lowerColor);
  const [r2, g2, b2] = parse(upperColor);
  const r = lerp(r1, r2, frac);
  const g = lerp(g1, g2, frac);
  const b = lerp(b1, b2, frac);

  return `rgb(${r},${g},${b})`;
}

const CELL_W = 52;
const CELL_H = 40;
const LABEL_W = 140;
const TOP_MARGIN = 30;
const LEFT_MARGIN = 10;

export default function Figure3_DnaRepairCorrelation_Heatmap() {
  const svgW = LEFT_MARGIN + LABEL_W + CANCER_TYPES.length * CELL_W + 60;
  const svgH = TOP_MARGIN + FEATURES.length * CELL_H + 40;

  const lookup = new Map<string, CellData>();
  for (const d of RAW_DATA) {
    lookup.set(`${d.cancer_type}:${d.feature}`, d);
  }

  return (
    <figure
      role="figure"
      aria-label="Heatmap showing DNA repair pathway correlations with morphological features across 11 TCGA cancer types"
      style={{
        margin: '2rem 0',
        padding: '1.5rem',
        background: C.bg,
        borderRadius: '8px',
        border: `1px solid ${C.grid}`,
        overflowX: 'auto',
      }}
    >
      <svg width={svgW} height={svgH} style={{ display: 'block', margin: '0 auto' }}>
        {/* Column labels (cancer types) — horizontal, centered above each column */}
        {CANCER_TYPES.map((ct, i) => (
          <text
            key={ct}
            x={LEFT_MARGIN + LABEL_W + i * CELL_W + CELL_W / 2}
            y={TOP_MARGIN - 10}
            textAnchor="middle"
            fontSize={11}
            fill={C.dark}
            fontFamily="system-ui, sans-serif"
          >
            {ct}
          </text>
        ))}

        {/* Rows */}
        {FEATURES.map((feat, rowIdx) => (
          <g key={feat}>
            {/* Row label */}
            <text
              x={LEFT_MARGIN + LABEL_W - 8}
              y={TOP_MARGIN + rowIdx * CELL_H + CELL_H / 2 + 4}
              textAnchor="end"
              fontSize={11}
              fill={C.dark}
              fontFamily="system-ui, sans-serif"
            >
              {FEATURE_LABELS[feat]}
            </text>

            {/* Cells */}
            {CANCER_TYPES.map((ct, colIdx) => {
              const cell = lookup.get(`${ct}:${feat}`);
              const rho = cell?.rho ?? 0;
              const sig = cell?.significant ?? false;
              return (
                <g key={`${ct}-${feat}`}>
                  <rect
                    x={LEFT_MARGIN + LABEL_W + colIdx * CELL_W + 1}
                    y={TOP_MARGIN + rowIdx * CELL_H + 1}
                    width={CELL_W - 2}
                    height={CELL_H - 2}
                    fill={rhoToColor(rho)}
                    rx={3}
                  >
                    <title>{`${FEATURE_LABELS[feat]} × ${ct}: ρ = ${rho.toFixed(2)}${sig ? ' *' : ''}`}</title>
                  </rect>
                  <text
                    x={LEFT_MARGIN + LABEL_W + colIdx * CELL_W + CELL_W / 2}
                    y={TOP_MARGIN + rowIdx * CELL_H + CELL_H / 2 + 4}
                    textAnchor="middle"
                    fontSize={10}
                    fill={rho > 0.3 ? '#fff' : C.dark}
                    fontFamily="system-ui, sans-serif"
                    fontWeight={sig ? 600 : 400}
                  >
                    {rho.toFixed(2)}
                  </text>
                </g>
              );
            })}
          </g>
        ))}

        {/* Legend */}
        {[0, 0.1, 0.2, 0.3, 0.4, 0.5].map((val, i) => (
          <g key={val}>
            <rect
              x={LEFT_MARGIN + LABEL_W + CANCER_TYPES.length * CELL_W + 12}
              y={TOP_MARGIN + i * 22}
              width={18}
              height={18}
              fill={rhoToColor(val)}
              rx={2}
            />
            <text
              x={LEFT_MARGIN + LABEL_W + CANCER_TYPES.length * CELL_W + 34}
              y={TOP_MARGIN + i * 22 + 13}
              fontSize={9}
              fill="#6B7280"
              fontFamily="system-ui, sans-serif"
            >
              {val.toFixed(1)}
            </text>
          </g>
        ))}
        <text
          x={LEFT_MARGIN + LABEL_W + CANCER_TYPES.length * CELL_W + 12}
          y={TOP_MARGIN - 8}
          fontSize={9}
          fill="#6B7280"
          fontFamily="system-ui, sans-serif"
        >
          Spearman ρ
        </text>
      </svg>

      <figcaption style={{
        marginTop: '0.75rem',
        fontSize: '0.85rem',
        color: C.dark,
        lineHeight: 1.5,
      }}>
        <strong>Figure 3.</strong> DNA repair pathway activity correlates with morphological features
        across cancer types. Heatmap shows Spearman correlations between the DNA_REPAIR pathway
        score and five histomic features. Bold values indicate BH-adjusted significance (p &lt; 0.05).
        Mitotic index shows the strongest and most consistent positive correlation across all
        11 cancer types (rho up to 0.54 in LUAD). Pleomorphism and immune features show
        more cancer-type-specific patterns.
        <br />
        <span style={{ color: '#6B7280', fontSize: '0.8rem' }}>
          Data: HistoAtlas / TCGA. Spearman rank correlation, BH-adjusted p &lt; 0.05.
        </span>
      </figcaption>
    </figure>
  );
}
