import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';

const C = {
  positive: '#E07A5F',
  negative: '#1B4965',
  dark: '#2D3142',
  grid: '#E8ECEF',
  bg: '#FAFBFC',
};

const DATA = [
  { feature: 'Pleomorphism index', rho: 0.338, label: 'ρ = +0.34' },
  { feature: 'Mitotic index', rho: 0.305, label: 'ρ = +0.31' },
  { feature: 'Nuclear area', rho: 0.269, label: 'ρ = +0.27' },
  { feature: 'Nuclear irregularity (IQR)', rho: 0.253, label: 'ρ = +0.25' },
  { feature: 'Tumor area fraction', rho: 0.223, label: 'ρ = +0.22' },
  { feature: 'Nuclear eccentricity', rho: 0.190, label: 'ρ = +0.19' },
  { feature: 'Stroma-interface density', rho: -0.226, label: 'ρ = −0.23' },
  { feature: 'Stroma area fraction', rho: -0.230, label: 'ρ = −0.23' },
  { feature: 'Cell density heterogeneity', rho: -0.197, label: 'ρ = −0.20' },
  { feature: 'Invasion depth', rho: -0.185, label: 'ρ = −0.19' },
];

export default function Figure1_MycCnvMorphology_BarChart() {
  const sorted = [...DATA].sort((a, b) => b.rho - a.rho);

  return (
    <figure
      role="figure"
      aria-label="Bar chart showing Spearman correlations between MYC copy number and histomic features in TCGA-BRCA"
      style={{
        margin: '2rem 0',
        padding: '1.5rem',
        background: C.bg,
        borderRadius: '8px',
        border: `1px solid ${C.grid}`,
      }}
    >
      <ResponsiveContainer width="100%" height={420}>
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ top: 10, right: 40, left: 180, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
          <XAxis
            type="number"
            domain={[-0.3, 0.4]}
            tick={{ fontSize: 12, fill: C.dark }}
            tickFormatter={(v: number) => v.toFixed(1)}
            label={{
              value: 'Spearman ρ',
              position: 'insideBottom',
              offset: -5,
              style: { fontSize: 13, fill: C.dark },
            }}
          />
          <YAxis
            dataKey="feature"
            type="category"
            tick={{ fontSize: 12, fill: C.dark }}
            width={170}
          />
          <Tooltip
            contentStyle={{
              background: '#fff',
              border: `1px solid ${C.grid}`,
              borderRadius: '6px',
              fontSize: '13px',
            }}
            formatter={(value: number | undefined) => {
              const v = value ?? 0;
              return [`ρ = ${v > 0 ? '+' : ''}${v.toFixed(3)}`, 'Spearman'];
            }}
          />
          <ReferenceLine x={0} stroke={C.dark} strokeWidth={1} />
          <Bar dataKey="rho" radius={[0, 4, 4, 0]}>
            {sorted.map((entry, index) => (
              <Cell key={index} fill={entry.rho >= 0 ? C.positive : C.negative} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <figcaption
        style={{
          marginTop: '0.75rem',
          fontSize: '0.85rem',
          color: C.dark,
          lineHeight: 1.5,
        }}
      >
        <strong>Figure 1.</strong> Spearman correlations between <em>MYC</em> copy number
        and histomic features in breast cancer. Positive correlations (orange) indicate
        features that increase with <em>MYC</em> amplification; negative correlations
        (blue) indicate features that decrease. All correlations are significant after
        Benjamini-Hochberg correction (q &lt; 0.05).
        <br />
        <span style={{ color: '#6B7280', fontSize: '0.8rem' }}>
          Data: HistoAtlas / TCGA-BRCA (n = 957)
        </span>
      </figcaption>
    </figure>
  );
}
