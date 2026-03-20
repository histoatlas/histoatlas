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
const KNOWN_DATASETS = new Set(['tcga', 'cptac']);

const STATIC_PAGE_META: Record<string, { title: string; subtitle: string }> = {
  about: { title: 'About HistoAtlas', subtitle: 'Why this atlas exists' },
  methods: { title: 'Methods', subtitle: 'Image analysis pipeline and statistical methods' },
  features: { title: 'Feature Documentation', subtitle: 'Histomic feature definitions and interpretation' },
  mutations: { title: 'Gene Mutations in Cancer', subtitle: 'Frequency, survival & morphology data for 8 driver genes' },
};

export async function resolveTemplate(pathSegments: string[]): Promise<unknown> {
  const [first, second, third, fourth] = pathSegments;

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

  // Static pages (about, methods, features, mutations hub)
  if (first && !second && STATIC_PAGE_META[first]) {
    const meta = STATIC_PAGE_META[first];
    return ogLayout({ title: meta.title, subtitle: meta.subtitle });
  }

  // Dataset-scoped routes: {dataset}/{cohort}/...
  // The URL pattern is /{dataset}/{cohort}/{page} where dataset is "tcga" or "cptac"
  // and cohort is an uppercase code like "BRCA", "PANCAN", etc.
  if (KNOWN_DATASETS.has(first) && COHORT_CODES.has(second)) {
    // {dataset}/{cohort}/histomics/{feature}
    if (third === 'histomics' && fourth) {
      return featureTemplate(second, decodeURIComponent(fourth));
    }

    // {dataset}/{cohort}/cluster/{id}
    if (third === 'cluster' && fourth) {
      return clusterTemplate(second, fourth);
    }

    // {dataset}/{cohort}/slide/{id}
    if (third === 'slide' && fourth) {
      return slideTemplate(second, fourth);
    }

    // {dataset}/{cohort}/{page} (atlas, associations, histomics, cluster, slide index)
    if (third) {
      return cohortTemplate(second, third);
    }
  }

  return defaultTemplate();
}
