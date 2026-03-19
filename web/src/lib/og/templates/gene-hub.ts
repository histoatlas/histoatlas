import { GENE_BY_SLUG } from '../../../data/geneGlossary';
import { ogLayout } from './shared';

const GENE_TYPE_BADGE = {
  'Tumor Suppressor': { text: 'Tumor Suppressor', bg: '#fef2f2', fg: '#b91c1c' },
  Oncogene: { text: 'Oncogene', bg: '#fef2f2', fg: '#b91c1c' },
} as const;

export function geneHubTemplate(geneSlug: string) {
  const gene = GENE_BY_SLUG[geneSlug];
  const symbol = gene?.symbol ?? geneSlug.toUpperCase();
  const fullName = gene?.fullName ?? '';
  const badge = gene ? GENE_TYPE_BADGE[gene.geneType] : undefined;

  return ogLayout({
    title: `${symbol} Mutation in Cancer`,
    subtitle: fullName || undefined,
    badge,
  });
}
