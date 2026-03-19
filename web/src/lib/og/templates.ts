import { getCollection } from 'astro:content';
import { defaultTemplate } from './templates/default';
import { featureTemplate } from './templates/feature';
import { geneCancerTemplate } from './templates/gene-cancer';
import { geneHubTemplate } from './templates/gene-hub';
import { blogTemplate } from './templates/blog';
import { clusterTemplate } from './templates/cluster';
import { slideTemplate } from './templates/slide';
import { cohortTemplate } from './templates/cohort';
import { ogLayout } from './templates/shared';
import { COHORT_FULL_NAMES } from '../../data/cohortNames';

const COHORT_CODES = new Set(Object.keys(COHORT_FULL_NAMES));

const STATIC_PAGE_META: Record<string, { title: string; subtitle: string }> = {
  about: { title: 'About HistoAtlas', subtitle: 'Why this atlas exists' },
  methods: { title: 'Methods', subtitle: 'Image analysis pipeline and statistical methods' },
  features: { title: 'Feature Documentation', subtitle: 'Histomic feature definitions and interpretation' },
  mutations: { title: 'Gene Mutations in Cancer', subtitle: 'Frequency, survival & morphology data for 8 driver genes' },
};

export async function resolveTemplate(pathSegments: string[]): Promise<unknown> {
  const [first, second, third] = pathSegments;

  // blog listing (no slug)
  if (first === 'blog' && !second) {
    return ogLayout({
      title: 'Blog',
      subtitle: 'Educational articles on computational pathology, genomics, and cancer biology',
    });
  }

  // blog/{slug}
  if (first === 'blog' && second) {
    const posts = await getCollection('blog');
    const post = posts.find((p) => {
      const slug = p.id.replace(/\/index\.mdx?$/, '').replace(/\.mdx?$/, '');
      return slug === second;
    });
    return blogTemplate(post?.data.title ?? second, post?.data.description);
  }

  // mutations/{gene}/{cancer}
  if (first === 'mutations' && second && third) {
    return geneCancerTemplate(second, third);
  }

  // mutations/{gene}
  if (first === 'mutations' && second) {
    return geneHubTemplate(second);
  }

  // Static pages (about, methods, features, mutations hub, compare)
  if (first && !second && STATIC_PAGE_META[first]) {
    const meta = STATIC_PAGE_META[first];
    return ogLayout({ title: meta.title, subtitle: meta.subtitle });
  }

  // {COHORT}/histomics/{feature}
  if (COHORT_CODES.has(first) && second === 'histomics' && third) {
    return featureTemplate(first, decodeURIComponent(third));
  }

  // {COHORT}/cluster/{id}
  if (COHORT_CODES.has(first) && second === 'cluster' && third) {
    return clusterTemplate(first, third);
  }

  // {COHORT}/slide/{id}
  if (COHORT_CODES.has(first) && second === 'slide' && third) {
    return slideTemplate(first, third);
  }

  // {COHORT}/{page} (atlas, associations, histomics, cluster, slide index)
  if (COHORT_CODES.has(first) && second) {
    return cohortTemplate(first, second);
  }

  return defaultTemplate();
}
