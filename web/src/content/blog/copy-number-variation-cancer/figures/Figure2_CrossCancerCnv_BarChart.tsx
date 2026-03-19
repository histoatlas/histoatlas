import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

const C = {
  primary: '#1B4965',
  secondary: '#62B6CB',
  accent: '#E07A5F',
  dark: '#2D3142',
  grid: '#E8ECEF',
  bg: '#FAFBFC',
  categorical: [
    '#1B4965', '#62B6CB', '#E07A5F', '#F2CC8F',
    '#5B8E7D', '#8D6B94',
  ],
};

const DATA = [
  { cancer: 'BRCA', gene: 'CCNB1', rho: -0.351, n: 957, direction: 'negative' },
  { cancer: 'LUAD', gene: 'CCNB1', rho: -0.302, n: 442, direction: 'negative' },
  { cancer: 'BLCA', gene: 'EGFR', rho: 0.275, n: 346, direction: 'positive' },
  { cancer: 'COAD', gene: 'SNAI1', rho: 0.266, n: 404, direction: 'positive' },
  { cancer: 'UCEC', gene: 'SOX2', rho: 0.222, n: 416, direction: 'positive' },
  { cancer: 'STAD', gene: 'MET', rho: 0.210, n: 364, direction: 'positive' },
];

export default function Figure2_CrossCancerCnv_BarChart() {
  return (
    <figure
      role="figure"
      aria-label="Bar chart showing the strongest copy number variation correlation with mitotic index across six TCGA cancer types"
      style={{
        margin: '2rem 0',
        padding: '1.5rem',
        background: C.bg,
        borderRadius: '8px',
        border: `1px solid ${C.grid}`,
      }}
    >
      <ResponsiveContainer width="100%" height={360}>
        <BarChart
          data={DATA}
          margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
          <XAxis
            dataKey="cancer"
            tick={{ fontSize: 12, fill: C.dark }}
            label={{
              value: 'Cancer type',
              position: 'insideBottom',
              offset: -10,
              style: { fontSize: 13, fill: C.dark },
            }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: C.dark }}
            domain={[-0.4, 0.3]}
            tickFormatter={(v: number) => v.toFixed(1)}
            label={{
              value: 'Spearman ρ',
              angle: -90,
              position: 'insideLeft',
              offset: 10,
              style: { fontSize: 13, fill: C.dark },
            }}
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
                `ρ = ${v > 0 ? '+' : ''}${v.toFixed(3)} (${entry.payload?.gene}, n=${entry.payload?.n})`,
                'Top CNV–mitotic index',
              ];
            }}
          />
          <Bar dataKey="rho" radius={[4, 4, 0, 0]}>
            {DATA.map((entry, index) => (
              <Cell key={index} fill={C.categorical[index]} />
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
        <strong>Figure 2.</strong> Strongest CNV–mitotic index correlation per cancer type.
        Each bar represents the gene whose copy number most strongly correlates with
        mitotic index in that cancer type. The top gene varies across cancers — <em>CCNB1</em> in
        breast and lung, <em>EGFR</em> in bladder, <em>SNAI1</em> in colon — revealing
        cancer-type-specific CNV-morphology relationships.
        <br />
        <span style={{ color: '#6B7280', fontSize: '0.8rem' }}>
          Data: HistoAtlas / TCGA (n = 2,929 across 6 cancer types)
        </span>
      </figcaption>
    </figure>
  );
}
