import { GENE_BY_SLUG } from '../../../data/geneGlossary';
import { SLUG_TO_FULL_NAME } from '../../../data/cancerSlugs';
import { ogLayout } from './shared';

const GENE_TYPE_BADGE = {
  'Tumor Suppressor': { text: 'Tumor Suppressor', bg: '#fef2f2', fg: '#b91c1c' },
  Oncogene: { text: 'Oncogene', bg: '#fef2f2', fg: '#b91c1c' },
} as const;

export function geneCancerTemplate(geneSlug: string, cancerSlug: string) {
  const gene = GENE_BY_SLUG[geneSlug];
  const cancerName = SLUG_TO_FULL_NAME[cancerSlug] ?? cancerSlug;
  const symbol = gene?.symbol ?? geneSlug.toUpperCase();
  const badge = gene ? GENE_TYPE_BADGE[gene.geneType] : undefined;

  return ogLayout({
    title: `${symbol} Mutation in ${cancerName}`,
    subtitle: `Morphological associations of ${symbol} mutations`,
    badge,
  });
}
