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
  ReferenceLine,
} from 'recharts';

const C = {
  enriched: '#1B4965',
  depleted: '#E07A5F',
  nonsig: '#D9E8F0',
  dark: '#2D3142',
  grid: '#E8ECEF',
  bg: '#FAFBFC',
};

interface PathwayDatum {
  pathway: string;
  cliffsDelta: number;
  significant: boolean;
  pAdj: number;
}

interface Props {
  data: PathwayDatum[];
}

export default function Figure3_Cluster4Profile_BarChart({ data }: Props) {
  const sorted = [...data].sort((a, b) => b.cliffsDelta - a.cliffsDelta);

  const formatted = sorted.map((d) => ({
    ...d,
    label: d.pathway
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase()),
  }));

  return (
    <figure
      role="figure"
      aria-label="Horizontal bar chart showing pathway enrichment profile of Cluster 4 (Immune-Hot), with Cliff's delta effect sizes for 21 biological pathways"
      style={{
        margin: '2rem 0',
        padding: '1.5rem',
        background: C.bg,
        borderRadius: '8px',
        border: `1px solid ${C.grid}`,
      }}
    >
      <ResponsiveContainer width="100%" height={520}>
        <BarChart
          data={formatted}
          layout="vertical"
          margin={{ top: 10, right: 30, left: 150, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 12, fill: C.dark }}
            domain={[-0.8, 1.0]}
            tickFormatter={(v: number) => v.toFixed(1)}
            label={{
              value: "Cliff's delta (effect size)",
              position: 'insideBottom',
              offset: -5,
              fontSize: 12,
              fill: C.dark,
            }}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fontSize: 11, fill: C.dark }}
            width={145}
          />
          <Tooltip
            contentStyle={{
              background: '#fff',
              border: `1px solid ${C.grid}`,
              borderRadius: '6px',
              fontSize: '13px',
            }}
            formatter={(value: number | undefined, _name: string | undefined, props: { payload?: { significant: boolean; pAdj: number } }) => {
              const v = value ?? 0;
              const sig = props.payload?.significant;
              const p = props.payload?.pAdj;
              return [
                `${v.toFixed(3)}${sig ? ` (p = ${p?.toExponential(1)})` : ' (n.s.)'}`,
                "Cliff's delta",
              ];
            }}
          />
          <ReferenceLine x={0} stroke={C.dark} strokeWidth={1} />
          <Bar dataKey="cliffsDelta" radius={[0, 4, 4, 0]}>
            {formatted.map((entry, idx) => (
              <Cell
                key={idx}
                fill={
                  !entry.significant
                    ? C.nonsig
                    : entry.cliffsDelta > 0
                      ? C.enriched
                      : C.depleted
                }
              />
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
        <strong>Figure 3.</strong> Pathway enrichment profile of Cluster 4 (&quot;Immune-Hot,
        Lymph-Proximal&quot;, n=196 slides). Bars show Cliff&apos;s delta effect sizes comparing
        pathway scores inside vs. outside the cluster. Teal = significantly enriched, coral =
        significantly depleted, light blue = not significant (BH-adjusted p &ge; 0.05). This
        morphology-defined cluster shows strong immune activation (T-cell, cytotoxic, checkpoint)
        and depletion of stemness, hypoxia, and angiogenesis programs.
        <br />
        <span style={{ color: '#6B7280', fontSize: '0.8rem' }}>
          Data: HistoAtlas / TCGA (n=196 in cluster, 5,681 out of cluster)
        </span>
      </figcaption>
    </figure>
  );
}
