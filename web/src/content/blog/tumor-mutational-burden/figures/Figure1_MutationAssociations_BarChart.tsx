import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

const C = {
  primary: '#1B4965',
  secondary: '#62B6CB',
  accent: '#E07A5F',
  dark: '#2D3142',
  grid: '#E8ECEF',
  bg: '#FAFBFC',
};

interface DataPoint {
  cancer_type: string;
  count: number;
  full_name: string;
}

const DATA: DataPoint[] = [
  { cancer_type: 'COAD', count: 330, full_name: 'Colon Adenocarcinoma' },
  { cancer_type: 'STAD', count: 221, full_name: 'Stomach Adenocarcinoma' },
  { cancer_type: 'UCEC', count: 183, full_name: 'Uterine Endometrial' },
  { cancer_type: 'LUAD', count: 108, full_name: 'Lung Adenocarcinoma' },
  { cancer_type: 'BLCA', count: 45, full_name: 'Bladder Urothelial' },
  { cancer_type: 'HNSC', count: 35, full_name: 'Head & Neck SCC' },
  { cancer_type: 'READ', count: 34, full_name: 'Rectum Adenocarcinoma' },
  { cancer_type: 'BRCA', count: 30, full_name: 'Breast Carcinoma' },
  { cancer_type: 'PRAD', count: 21, full_name: 'Prostate Adenocarcinoma' },
  { cancer_type: 'ESCA', count: 15, full_name: 'Esophageal Carcinoma' },
  { cancer_type: 'LIHC', count: 12, full_name: 'Liver HCC' },
  { cancer_type: 'PAAD', count: 9, full_name: 'Pancreatic Adenocarcinoma' },
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
    }}>
      <div style={{ fontWeight: 600, color: C.dark }}>{d.full_name}</div>
      <div style={{ color: '#6B7280' }}>
        {d.count} significant mutation-morphology associations
      </div>
    </div>
  );
}

export default function Figure1_MutationAssociations_BarChart() {
  return (
    <figure
      role="figure"
      aria-label="Bar chart showing the number of significant mutation-morphology associations across 12 TCGA cancer types, with colorectal, stomach, and uterine cancers leading"
      style={{
        margin: '2rem 0',
        padding: '1.5rem',
        background: C.bg,
        borderRadius: '8px',
        border: `1px solid ${C.grid}`,
      }}
    >
      <ResponsiveContainer width="100%" height={420}>
        <BarChart data={DATA} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
          <XAxis
            dataKey="cancer_type"
            tick={{ fontSize: 11, fill: C.dark }}
            tickLine={false}
            tickMargin={8}
          />
          <YAxis
            tick={{ fontSize: 12, fill: C.dark }}
            label={{
              value: 'Significant associations',
              angle: -90,
              position: 'insideLeft',
              style: { fontSize: 12, fill: '#6B7280' },
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={50} stroke={C.accent} strokeDasharray="4 4" strokeWidth={1} />
          <Bar dataKey="count" fill={C.primary} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <figcaption style={{
        marginTop: '0.75rem',
        fontSize: '0.85rem',
        color: C.dark,
        lineHeight: 1.5,
      }}>
        <strong>Figure 1.</strong> Number of statistically significant mutation-morphology associations
        per cancer type. Colorectal (COAD), stomach (STAD), and uterine (UCEC) cancers, known
        for high mutational burden and microsatellite instability, show the most mutation-driven
        morphological variation. Dashed line at 50 highlights the sharp drop-off after the top four.
        <br />
        <span style={{ color: '#6B7280', fontSize: '0.8rem' }}>
          Data: HistoAtlas / TCGA (n=6,745). BH-adjusted p &lt; 0.05, Mann-Whitney U with Cliff's delta.
        </span>
      </figcaption>
    </figure>
  );
}
