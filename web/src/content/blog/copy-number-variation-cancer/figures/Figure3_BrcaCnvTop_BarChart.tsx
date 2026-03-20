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
  { gene: 'MYC', rho: 0.305, evidence: 'strong' },
  { gene: 'MSH2', rho: 0.251, evidence: 'moderate' },
  { gene: 'ALK', rho: 0.249, evidence: 'moderate' },
  { gene: 'GZMA', rho: -0.306, evidence: 'strong' },
  { gene: 'HAVCR2', rho: -0.297, evidence: 'moderate' },
  { gene: 'CD14', rho: -0.280, evidence: 'moderate' },
  { gene: 'APC', rho: -0.334, evidence: 'strong' },
  { gene: 'CCNB1', rho: -0.351, evidence: 'strong' },
];

export default function Figure3_BrcaCnvTop_BarChart() {
  const sorted = [...DATA].sort((a, b) => b.rho - a.rho);

  return (
    <figure
      role="figure"
      aria-label="Top CNV-mitotic index correlations in TCGA-BRCA showing both oncogene amplification and tumor suppressor deletion effects"
      style={{
        margin: '2rem 0',
        padding: '1.5rem',
        background: C.bg,
        borderRadius: '8px',
        border: `1px solid ${C.grid}`,
      }}
    >
      <ResponsiveContainer width="100%" height={340}>
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ top: 10, right: 40, left: 80, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
          <XAxis
            type="number"
            domain={[-0.4, 0.35]}
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
            dataKey="gene"
            type="category"
            tick={{ fontSize: 13, fill: C.dark, fontStyle: 'italic' }}
            width={70}
          />
          <Tooltip
            contentStyle={{
              background: '#fff',
              border: `1px solid ${C.grid}`,
              borderRadius: '6px',
              fontSize: '13px',
            }}
            formatter={(value: number | undefined, _name: string | undefined, entry: { payload?: typeof DATA[number] }) => {
              const v = value ?? 0;
              return [
                `ρ = ${v > 0 ? '+' : ''}${v.toFixed(3)} (${entry.payload?.evidence} evidence)`,
                'CNV × mitotic index',
              ];
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
        <strong>Figure 3.</strong> Top CNV-mitotic index correlations in breast cancer.
        Oncogene amplification (<em>MYC</em>, <em>ALK</em>, <em>MSH2</em>; orange) correlates
        with higher mitotic activity, while tumor suppressor and immune gene copy number
        loss (<em>CCNB1</em>, <em>APC</em>, <em>GZMA</em>; blue) shows the opposite pattern.
        Evidence strength reflects BH-adjusted significance and effect size magnitude.
        <br />
        <span style={{ color: '#6B7280', fontSize: '0.8rem' }}>
          Data: HistoAtlas / TCGA-BRCA (n = 957). All q &lt; 0.005.
        </span>
      </figcaption>
    </figure>
  );
}
