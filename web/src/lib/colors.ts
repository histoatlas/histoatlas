import { scaleSequential, scaleOrdinal } from 'd3-scale';
import { interpolateViridis } from 'd3-scale-chromatic';

// RGBA tuple for deck.gl
export type RGBAColor = [number, number, number, number];

// 33 distinct, colorblind-friendly colors for cancer types
// Based on a combination of ColorBrewer and custom selection for maximum distinctiveness
export const CANCER_TYPE_COLORS: Record<string, string> = {
  ACC: '#e41a1c',
  BLCA: '#377eb8',
  BRCA: '#4daf4a',
  CESC: '#984ea3',
  CHOL: '#ff7f00',
  COAD: '#a16207',
  DLBC: '#a65628',
  ESCA: '#f781bf',
  GBM: '#999999',
  HNSC: '#66c2a5',
  KICH: '#fc8d62',
  KIRC: '#8da0cb',
  KIRP: '#e78ac3',
  LAML: '#a6d854',
  LGG: '#ffd92f',
  LIHC: '#e5c494',
  LUAD: '#b3b3b3',
  LUSC: '#1b9e77',
  MESO: '#d95f02',
  OV: '#7570b3',
  PAAD: '#e7298a',
  PCPG: '#66a61e',
  PRAD: '#e6ab02',
  READ: '#a6761d',
  SARC: '#666666',
  SKCM: '#8dd3c7',
  STAD: '#4d7c0f',
  TGCT: '#bebada',
  THCA: '#fb8072',
  THYM: '#80b1d3',
  UCEC: '#fdb462',
  UCS: '#b3de69',
  UVM: '#fccde5',
  HNSCC: '#66c2a5',
};

// Tableau10 palette for clusters (up to 10 clusters)
export const CLUSTER_COLORS: string[] = [
  '#4e79a7',
  '#f28e2b',
  '#e15759',
  '#76b7b2',
  '#59a14f',
  '#edc948',
  '#b07aa1',
  '#ff9da7',
  '#9c755f',
  '#bab0ac',
];

// Immune subtype colors matching Thorsson et al.
export const IMMUNE_SUBTYPE_COLORS: Record<string, string> = {
  C1: '#e41a1c', // Wound Healing
  C2: '#377eb8', // IFN-gamma Dominant
  C3: '#4daf4a', // Inflammatory
  C4: '#984ea3', // Lymphocyte Depleted
  C5: '#ff7f00', // Immunologically Quiet
  C6: '#ffff33', // TGF-beta Dominant
};

/**
 * Convert hex color to RGBA array for deck.gl
 */
export function hexToRgba(hex: string, alpha: number = 255): RGBAColor {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    return [128, 128, 128, alpha]; // fallback gray
  }
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16),
    alpha,
  ];
}

/**
 * Create a continuous color scale using viridis
 * Returns a function that maps values to RGBA arrays
 */
export function createContinuousScale(
  min: number,
  max: number
): (value: number) => RGBAColor {
  const scale = scaleSequential(interpolateViridis).domain([min, max]);

  return (value: number): RGBAColor => {
    const color = scale(value);
    // interpolateViridis returns "rgb(r, g, b)" format
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      return [
        parseInt(match[1]),
        parseInt(match[2]),
        parseInt(match[3]),
        255,
      ];
    }
    return [128, 128, 128, 255];
  };
}

/**
 * Create a categorical color scale for cancer types
 */
export function createCancerTypeScale(): (cancerType: string) => RGBAColor {
  return (cancerType: string): RGBAColor => {
    const hex = CANCER_TYPE_COLORS[cancerType] || '#808080';
    return hexToRgba(hex);
  };
}

/**
 * Create a categorical color scale for clusters
 */
export function createClusterScale(): (clusterId: string) => RGBAColor {
  const scale = scaleOrdinal<string, string>().range(CLUSTER_COLORS);

  return (clusterId: string): RGBAColor => {
    const hex = scale(clusterId);
    return hexToRgba(hex);
  };
}

/**
 * Create a categorical color scale for immune subtypes
 */
export function createImmuneSubtypeScale(): (subtype: string) => RGBAColor {
  return (subtype: string): RGBAColor => {
    const hex = IMMUNE_SUBTYPE_COLORS[subtype] || '#808080';
    return hexToRgba(hex);
  };
}

/**
 * Get all cancer type entries for legend display
 */
export function getCancerTypeEntries(): Array<{ key: string; color: string }> {
  return Object.entries(CANCER_TYPE_COLORS).map(([key, color]) => ({
    key,
    color,
  }));
}

/**
 * Get cluster entries for legend display
 */
export function getClusterEntries(
  clusterIds: string[]
): Array<{ key: string; color: string }> {
  return clusterIds.map((id, index) => ({
    key: id,
    color: CLUSTER_COLORS[index % CLUSTER_COLORS.length],
  }));
}

/**
 * Get immune subtype entries for legend display
 */
export function getImmuneSubtypeEntries(): Array<{
  key: string;
  color: string;
}> {
  return Object.entries(IMMUNE_SUBTYPE_COLORS).map(([key, color]) => ({
    key,
    color,
  }));
}
