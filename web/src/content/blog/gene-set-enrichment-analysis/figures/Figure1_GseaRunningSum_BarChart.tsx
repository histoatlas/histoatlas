import React, { useMemo } from 'react';

const C = {
  primary: '#1B4965',
  secondary: '#62B6CB',
  accent: '#E07A5F',
  dark: '#2D3142',
  grid: '#E8ECEF',
  bg: '#FAFBFC',
  hit: '#1B4965',
  miss: '#D9E8F0',
};

/**
 * Figure 1: Conceptual GSEA running-sum diagram.
 * Shows a simulated enrichment score walk along a ranked gene list,
 * with gene set "hits" marked below the x-axis.
 */
export default function Figure1_GseaRunningSum() {
  const { walkPoints, hits, peakIdx } = useMemo(() => {
    // Simulate a ranked list of 80 genes with hits concentrated near the top
    const n = 80;
    const hitPositions = [2, 5, 8, 11, 14, 18, 23, 30, 42, 55, 68, 74];
    const nHits = hitPositions.length;
    const increment = Math.sqrt((n - nHits) / nHits);
    const decrement = 1 / Math.sqrt((n - nHits) * nHits);

    let score = 0;
    let maxScore = 0;
    let maxIdx = 0;
    const points: { x: number; y: number }[] = [{ x: 0, y: 0 }];

    for (let i = 0; i < n; i++) {
      if (hitPositions.includes(i)) {
        score += increment;
      } else {
        score -= decrement;
      }
      points.push({ x: i + 1, y: score });
      if (score > maxScore) {
        maxScore = score;
        maxIdx = i + 1;
      }
    }

    // Normalize to [0, 1] range
    const absMax = Math.max(...points.map((p) => Math.abs(p.y)));
    const normalized = points.map((p) => ({ x: p.x, y: p.y / absMax }));

    return {
      walkPoints: normalized,
      hits: hitPositions,
      peakIdx: maxIdx,
    };
  }, []);

  const width = 700;
  const height = 320;
  const pad = { top: 30, right: 30, bottom: 70, left: 55 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const xScale = (v: number) => pad.left + (v / 80) * plotW;
  const yScale = (v: number) => pad.top + plotH / 2 - (v * plotH) / 2;

  const pathD = walkPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(p.x).toFixed(1)},${yScale(p.y).toFixed(1)}`)
    .join(' ');

  const peakPoint = walkPoints[peakIdx];

  return (
    <figure
      role="figure"
      aria-label="Conceptual diagram of the GSEA enrichment score running sum, showing how the score increases when gene set members are encountered at the top of a ranked list"
      style={{
        margin: '2rem 0',
        padding: '1.5rem',
        background: C.bg,
        borderRadius: '8px',
        border: `1px solid ${C.grid}`,
      }}
    >
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
        {/* Grid lines */}
        <line
          x1={pad.left}
          y1={yScale(0)}
          x2={width - pad.right}
          y2={yScale(0)}
          stroke={C.grid}
          strokeWidth={1}
        />
        {[-0.5, 0.5, 1.0].map((v) => (
          <line
            key={v}
            x1={pad.left}
            y1={yScale(v)}
            x2={width - pad.right}
            y2={yScale(v)}
            stroke={C.grid}
            strokeWidth={0.5}
            strokeDasharray="4 4"
          />
        ))}

        {/* Running sum line */}
        <path d={pathD} fill="none" stroke={C.primary} strokeWidth={2.5} />

        {/* Peak annotation */}
        <circle cx={xScale(peakPoint.x)} cy={yScale(peakPoint.y)} r={5} fill={C.accent} />
        <line
          x1={xScale(peakPoint.x)}
          y1={yScale(peakPoint.y) + 8}
          x2={xScale(peakPoint.x)}
          y2={yScale(0)}
          stroke={C.accent}
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        <text
          x={xScale(peakPoint.x) + 8}
          y={yScale(peakPoint.y) - 8}
          fontSize={12}
          fontWeight={600}
          fill={C.accent}
        >
          ES (peak)
        </text>

        {/* Hit markers below x-axis */}
        {hits.map((pos) => (
          <rect
            key={pos}
            x={xScale(pos) - 1.5}
            y={yScale(0) + 4}
            width={3}
            height={14}
            fill={C.hit}
            opacity={0.7}
          />
        ))}

        {/* Axis labels */}
        <text
          x={pad.left + plotW / 2}
          y={height - 10}
          textAnchor="middle"
          fontSize={12}
          fill={C.dark}
        >
          Gene rank (sorted by signal)
        </text>
        <text
          x={14}
          y={pad.top + plotH / 2}
          textAnchor="middle"
          fontSize={12}
          fill={C.dark}
          transform={`rotate(-90, 14, ${pad.top + plotH / 2})`}
        >
          Enrichment score
        </text>

        {/* Hit label */}
        <text
          x={pad.left + plotW / 2}
          y={yScale(0) + 30}
          textAnchor="middle"
          fontSize={11}
          fill={C.dark}
          opacity={0.7}
        >
          ▲ Gene set members (hits)
        </text>

        {/* Y-axis ticks */}
        {[-0.5, 0, 0.5, 1.0].map((v) => (
          <text
            key={v}
            x={pad.left - 8}
            y={yScale(v) + 4}
            textAnchor="end"
            fontSize={11}
            fill={C.dark}
          >
            {v.toFixed(1)}
          </text>
        ))}
      </svg>
      <figcaption
        style={{
          marginTop: '0.75rem',
          fontSize: '0.85rem',
          color: C.dark,
          lineHeight: 1.5,
        }}
      >
        <strong>Figure 1.</strong> The GSEA running-sum statistic. Walking down a ranked gene list, the
        score increases each time a gene set member is encountered (vertical bars) and decreases
        otherwise. The enrichment score (ES) is the peak deviation from zero. When gene set members
        cluster near the top of the list, ES is large and positive, indicating the pathway is
        upregulated in the phenotype of interest.
      </figcaption>
    </figure>
  );
}
