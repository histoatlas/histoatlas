import React, { useMemo } from 'react';

const C = {
  primary: '#1B4965',
  secondary: '#62B6CB',
  accent: '#E07A5F',
  dark: '#2D3142',
  grid: '#E8ECEF',
  bg: '#FAFBFC',
};

const DIVERGING = [
  '#E07A5F', '#F0A990', '#F7D6C8',
  '#F7F7F7',
  '#C8DFE8', '#62B6CB', '#1B4965',
];

interface EmtCorrelation {
  cancer_type: string;
  feature: string;
  rho: number;
  n_samples: number;
}

function interpolateColor(value: number, min: number, max: number): string {
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const idx = t * (DIVERGING.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return DIVERGING[lower];

  const frac = idx - lower;
  const c1 = DIVERGING[lower];
  const c2 = DIVERGING[upper];
  const r = Math.round(parseInt(c1.slice(1, 3), 16) * (1 - frac) + parseInt(c2.slice(1, 3), 16) * frac);
  const g = Math.round(parseInt(c1.slice(3, 5), 16) * (1 - frac) + parseInt(c2.slice(3, 5), 16) * frac);
  const b = Math.round(parseInt(c1.slice(5, 7), 16) * (1 - frac) + parseInt(c2.slice(5, 7), 16) * frac);
  return `rgb(${r},${g},${b})`;
}

const FEATURE_LABELS: Record<string, string> = {
  intratumoral_cancer_cell_density: 'Cancer cell density',
  invasion_depth_p75: 'Invasion depth',
  tumor_stroma_interface_density: 'Tumor–stroma interface',
  stroma_area_fraction: 'Stroma fraction',
  tumor_area_fraction: 'Tumor fraction',
  deep_intratumoral_lymphocyte_fraction: 'Deep TIL fraction',
  tumor_front_fraction: 'Tumor front fraction',
  tumor_fibroblast_coupling_front: 'Fibroblast coupling',
};

const DATA: EmtCorrelation[] = [
  { cancer_type: 'STAD', feature: 'intratumoral_cancer_cell_density', rho: -0.42, n_samples: 353 },
  { cancer_type: 'BLCA', feature: 'intratumoral_cancer_cell_density', rho: -0.37, n_samples: 345 },
  { cancer_type: 'PAAD', feature: 'intratumoral_cancer_cell_density', rho: -0.36, n_samples: 127 },
  { cancer_type: 'BRCA', feature: 'intratumoral_cancer_cell_density', rho: -0.19, n_samples: 958 },
  { cancer_type: 'LUAD', feature: 'intratumoral_cancer_cell_density', rho: -0.30, n_samples: 435 },
  { cancer_type: 'HNSC', feature: 'intratumoral_cancer_cell_density', rho: -0.19, n_samples: 435 },
  { cancer_type: 'MESO', feature: 'invasion_depth_p75', rho: 0.47, n_samples: 71 },
  { cancer_type: 'ESCA', feature: 'invasion_depth_p75', rho: 0.34, n_samples: 154 },
  { cancer_type: 'LUAD', feature: 'invasion_depth_p75', rho: 0.34, n_samples: 434 },
  { cancer_type: 'STAD', feature: 'invasion_depth_p75', rho: 0.40, n_samples: 348 },
  { cancer_type: 'BRCA', feature: 'invasion_depth_p75', rho: 0.13, n_samples: 958 },
  { cancer_type: 'BLCA', feature: 'tumor_stroma_interface_density', rho: 0.39, n_samples: 345 },
  { cancer_type: 'BRCA', feature: 'tumor_stroma_interface_density', rho: 0.17, n_samples: 958 },
  { cancer_type: 'LUSC', feature: 'tumor_stroma_interface_density', rho: 0.23, n_samples: 326 },
  { cancer_type: 'STAD', feature: 'tumor_stroma_interface_density', rho: 0.30, n_samples: 353 },
  { cancer_type: 'BRCA', feature: 'stroma_area_fraction', rho: 0.18, n_samples: 958 },
  { cancer_type: 'COAD', feature: 'stroma_area_fraction', rho: 0.22, n_samples: 414 },
  { cancer_type: 'LUSC', feature: 'stroma_area_fraction', rho: 0.20, n_samples: 326 },
  { cancer_type: 'COAD', feature: 'deep_intratumoral_lymphocyte_fraction', rho: -0.22, n_samples: 404 },
  { cancer_type: 'HNSC', feature: 'deep_intratumoral_lymphocyte_fraction', rho: -0.26, n_samples: 389 },
  { cancer_type: 'BRCA', feature: 'tumor_front_fraction', rho: 0.21, n_samples: 958 },
  { cancer_type: 'PRAD', feature: 'tumor_front_fraction', rho: 0.31, n_samples: 316 },
  { cancer_type: 'LUSC', feature: 'tumor_fibroblast_coupling_front', rho: -0.28, n_samples: 318 },
  { cancer_type: 'BRCA', feature: 'tumor_fibroblast_coupling_front', rho: -0.18, n_samples: 958 },
  { cancer_type: 'BRCA', feature: 'tumor_area_fraction', rho: -0.18, n_samples: 958 },
  { cancer_type: 'COAD', feature: 'tumor_area_fraction', rho: -0.22, n_samples: 414 },
  { cancer_type: 'LUAD', feature: 'tumor_area_fraction', rho: -0.22, n_samples: 436 },
  { cancer_type: 'THCA', feature: 'tumor_area_fraction', rho: -0.19, n_samples: 451 },
];

export default function Figure1_EmtPanCancer_Heatmap() {
  const { cancerTypes, features, grid } = useMemo(() => {
    const cts = ['STAD', 'BLCA', 'LUAD', 'MESO', 'ESCA', 'HNSC', 'BRCA', 'COAD', 'PRAD', 'LUSC', 'PAAD', 'THCA'];
    const feats = [
      'intratumoral_cancer_cell_density',
      'invasion_depth_p75',
      'tumor_stroma_interface_density',
      'stroma_area_fraction',
      'tumor_area_fraction',
      'deep_intratumoral_lymphocyte_fraction',
      'tumor_front_fraction',
      'tumor_fibroblast_coupling_front',
    ];

    const lookup: Record<string, number> = {};
    DATA.forEach((d) => {
      lookup[`${d.cancer_type}:${d.feature}`] = d.rho;
    });

    const gridData = feats.map((f) =>
      cts.map((ct) => lookup[`${ct}:${f}`] ?? null)
    );

    return { cancerTypes: cts, features: feats, grid: gridData };
  }, []);

  const cellW = 44;
  const cellH = 32;
  const labelW = 160;
  const labelH = 50;
  const legendH = 40;
  const pad = { top: labelH + 10, left: labelW + 10, right: 20, bottom: legendH + 30 };
  const width = pad.left + cancerTypes.length * cellW + pad.right;
  const height = pad.top + features.length * cellH + pad.bottom;

  return (
    <figure
      role="figure"
      aria-label="Heatmap showing Spearman correlations between HALLMARK_EMT scores and histomic features across 12 TCGA cancer types"
      style={{
        margin: '2rem 0',
        padding: '1.5rem',
        background: C.bg,
        borderRadius: '8px',
        border: `1px solid ${C.grid}`,
      }}
    >
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
        {/* Column labels */}
        {cancerTypes.map((ct, i) => (
          <text
            key={ct}
            x={pad.left + i * cellW + cellW / 2}
            y={pad.top - 8}
            textAnchor="middle"
            fontSize={11}
            fontWeight={600}
            fill={C.dark}
          >
            {ct}
          </text>
        ))}

        {/* Row labels */}
        {features.map((f, j) => (
          <text
            key={f}
            x={pad.left - 8}
            y={pad.top + j * cellH + cellH / 2 + 4}
            textAnchor="end"
            fontSize={10.5}
            fill={C.dark}
          >
            {FEATURE_LABELS[f] || f}
          </text>
        ))}

        {/* Heatmap cells */}
        {grid.map((row, j) =>
          row.map((val, i) => {
            if (val === null) return null;
            return (
              <g key={`${j}-${i}`}>
                <rect
                  x={pad.left + i * cellW + 1}
                  y={pad.top + j * cellH + 1}
                  width={cellW - 2}
                  height={cellH - 2}
                  rx={3}
                  fill={interpolateColor(val, -0.5, 0.5)}
                >
                  <title>{`${cancerTypes[i]} × ${FEATURE_LABELS[features[j]]}: ρ = ${val.toFixed(2)}`}</title>
                </rect>
                <text
                  x={pad.left + i * cellW + cellW / 2}
                  y={pad.top + j * cellH + cellH / 2 + 4}
                  textAnchor="middle"
                  fontSize={9.5}
                  fontWeight={500}
                  fill={Math.abs(val) > 0.3 ? '#fff' : C.dark}
                >
                  {val.toFixed(2)}
                </text>
              </g>
            );
          })
        )}

        {/* Empty cells */}
        {grid.map((row, j) =>
          row.map((val, i) => {
            if (val !== null) return null;
            return (
              <rect
                key={`empty-${j}-${i}`}
                x={pad.left + i * cellW + 1}
                y={pad.top + j * cellH + 1}
                width={cellW - 2}
                height={cellH - 2}
                rx={3}
                fill="#f0f0f0"
                stroke="#e0e0e0"
                strokeWidth={0.5}
              />
            );
          })
        )}

        {/* Color legend */}
        {(() => {
          const legendY = pad.top + features.length * cellH + 20;
          const legendW = 200;
          const legendX = pad.left + (cancerTypes.length * cellW - legendW) / 2;
          const steps = 40;
          const stepW = legendW / steps;
          return (
            <g>
              {Array.from({ length: steps }).map((_, k) => {
                const v = -0.5 + (k / (steps - 1));
                return (
                  <rect
                    key={k}
                    x={legendX + k * stepW}
                    y={legendY}
                    width={stepW + 0.5}
                    height={12}
                    fill={interpolateColor(v, -0.5, 0.5)}
                  />
                );
              })}
              <text x={legendX} y={legendY + 26} fontSize={10} fill={C.dark} textAnchor="middle">-0.5</text>
              <text x={legendX + legendW / 2} y={legendY + 26} fontSize={10} fill={C.dark} textAnchor="middle">0</text>
              <text x={legendX + legendW} y={legendY + 26} fontSize={10} fill={C.dark} textAnchor="middle">+0.5</text>
              <text x={legendX + legendW / 2} y={legendY - 6} fontSize={10} fill={C.dark} textAnchor="middle">
                Spearman ρ (HALLMARK_EMT score)
              </text>
            </g>
          );
        })()}
      </svg>

      <figcaption
        style={{
          marginTop: '0.75rem',
          fontSize: '0.85rem',
          color: C.dark,
          lineHeight: 1.5,
        }}
      >
        <strong>Figure 1.</strong> Spearman correlations between HALLMARK_EPITHELIAL_MESENCHYMAL_TRANSITION (EMT) pathway scores
        and histomic features across 12 TCGA cancer types. Warm tones (red) indicate negative
        correlations, cool tones (blue) indicate positive. EMT-high tumors consistently show
        reduced intratumoral cancer cell density, greater invasion depth, and expanded tumor–stroma
        interfaces. Grey cells indicate the correlation was not statistically significant (FDR &gt; 0.05).
        <br />
        <span style={{ color: '#6B7280', fontSize: '0.8rem' }}>
          Data: HistoAtlas / TCGA (n = 6,745 slides across 21 cancer types)
        </span>
      </figcaption>
    </figure>
  );
}
