import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

const C = {
  primary: '#1B4965',
  secondary: '#62B6CB',
  accent: '#E07A5F',
  warm: '#F2CC8F',
  dark: '#2D3142',
  grid: '#E8ECEF',
  bg: '#FAFBFC',
  positive: '#1B4965',
  negative: '#E07A5F',
};

interface DataPoint {
  feature: string;
  label: string;
  cliffs_d: number;
  p_adj: number;
  n: number;
}

const DATA: DataPoint[] = [
  { feature: 'mitotic_index', label: 'Mitotic index', cliffs_d: 0.316, p_adj: 4.67e-77, n: 5304 },
  { feature: 'peritumoral_immune', label: 'Peritumoral immune richness', cliffs_d: 0.278, p_adj: 4.84e-60, n: 5294 },
  { feature: 'eosinophil_density', label: 'Intratumoral eosinophils', cliffs_d: 0.275, p_adj: 6.81e-59, n: 5305 },
  { feature: 'neutrophil_density', label: 'Intratumoral neutrophils', cliffs_d: 0.230, p_adj: 1.17e-41, n: 5305 },
  { feature: 'stromal_lymphocytes', label: 'Stromal lymphocytes', cliffs_d: 0.182, p_adj: 1.24e-26, n: 5306 },
  { feature: 'immune_pressure', label: 'Interface immune pressure', cliffs_d: 0.159, p_adj: 1.39e-20, n: 5305 },
  { feature: 'intratumoral_lymphocytes', label: 'Intratumoral lymphocytes', cliffs_d: 0.113, p_adj: 3.91e-11, n: 5305 },
];

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: DataPoint }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${C.grid}`,
      borderRadius: '6px',
      padding: '8px 12px',
      fontSize: '13px',
      maxWidth: '280px',
    }}>
      <div style={{ fontWeight: 600, color: C.dark }}>{d.label}</div>
      <div style={{ color: '#6B7280', marginTop: '4px' }}>
        Cliff's <em>d</em> = {d.cliffs_d.toFixed(3)} (n = {d.n.toLocaleString()})
      </div>
      <div style={{ color: '#6B7280' }}>
        p<sub>adj</sub> = {d.p_adj.toExponential(1)}
      </div>
    </div>
  );
}

export default function Figure2_TmbImmuneEffects_GroupedBar() {
  return (
    <figure
      role="figure"
      aria-label="Horizontal bar chart showing Cliff's delta effect sizes for TTN-mutant versus wild-type tumors across seven immune and proliferation features, all significantly elevated in mutant tumors"
      style={{
        margin: '2rem 0',
        padding: '1.5rem',
        background: C.bg,
        borderRadius: '8px',
        border: `1px solid ${C.grid}`,
      }}
    >
      <ResponsiveContainer width="100%" height={380}>
        <BarChart
          data={DATA}
          layout="vertical"
          margin={{ top: 10, right: 40, left: 180, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 12, fill: C.dark }}
            domain={[0, 0.35]}
            label={{
              value: "Cliff's delta (effect size)",
              position: 'insideBottom',
              offset: -5,
              style: { fontSize: 12, fill: '#6B7280' },
            }}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fontSize: 12, fill: C.dark }}
            width={170}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="cliffs_d" radius={[0, 4, 4, 0]}>
            {DATA.map((entry, index) => (
              <Cell
                key={entry.feature}
                fill={index === 0 ? C.accent : C.primary}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <figcaption style={{
        marginTop: '0.75rem',
        fontSize: '0.85rem',
        color: C.dark,
        lineHeight: 1.5,
      }}>
        <strong>Figure 2.</strong> Effect of high mutational burden on tumor morphology and immune
        infiltration (pan-cancer). Bars show Cliff's delta comparing <em>TTN</em>-mutant versus
        wild-type tumors, a validated proxy for TMB-high status [2]. Mitotic index shows the
        largest effect (d = 0.316), followed by multiple immune infiltration metrics. All
        associations BH-significant (p<sub>adj</sub> &lt; 10<sup>-10</sup>).
        <br />
        <span style={{ color: '#6B7280', fontSize: '0.8rem' }}>
          Data: HistoAtlas / TCGA (n=5,304 pan-cancer). Mann-Whitney U test, Cliff's delta effect size.
        </span>
      </figcaption>
    </figure>
  );
}
