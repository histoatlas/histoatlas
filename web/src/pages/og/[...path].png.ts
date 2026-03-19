import { readFileSync } from 'node:fs';
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { renderOgImage } from '../../lib/og/render';
import { resolveTemplate } from '../../lib/og/templates';
import { ALL_FEATURES } from '../../data/featureGlossary';
import { TRACKED_GENES } from '../../data/geneGlossary';
import { MUTATION_PAGES } from '../../data/mutationPages';

export const getStaticPaths: GetStaticPaths = async () => {
  const paths: { params: { path: string } }[] = [];

  // Default
  paths.push({ params: { path: undefined as unknown as string } });

  // Static pages
  for (const page of ['about', 'methods', 'features', 'mutations']) {
    paths.push({ params: { path: page } });
  }

  // Blog listing
  paths.push({ params: { path: 'blog' } });

  // Load datasets manifest
  let manifest: Record<string, { cancerTypes: string[] }> = {};
  try {
    manifest = JSON.parse(readFileSync('public/api/_manifests/datasets.json', 'utf-8'));
  } catch { /* not available */ }

  // Cohort pages (dataset/cohort/page)
  for (const [dataset, info] of Object.entries(manifest)) {
    for (const cohort of info.cancerTypes) {
      for (const page of ['atlas', 'associations', 'histomics', 'cluster', 'slide']) {
        paths.push({ params: { path: `${dataset}/${cohort}/${page}` } });
      }
    }
  }

  // Feature pages (dataset/cohort/histomics/feature)
  for (const [dataset, info] of Object.entries(manifest)) {
    for (const cohort of info.cancerTypes) {
      for (const f of ALL_FEATURES) {
        paths.push({ params: { path: `${dataset}/${cohort}/histomics/${f.name}` } });
      }
    }
  }

  // Cluster detail pages
  for (const dataset of Object.keys(manifest)) {
    try {
      const clusterManifest: Record<string, string[]> = JSON.parse(
        readFileSync(`public/api/${dataset}/_manifests/cluster-ids.json`, 'utf-8'),
      );
      for (const [cohort, ids] of Object.entries(clusterManifest)) {
        for (const id of ids) {
          paths.push({ params: { path: `${dataset}/${cohort}/cluster/${id}` } });
        }
      }
    } catch { /* manifest not available */ }
  }

  // Gene hub pages
  for (const gene of TRACKED_GENES) {
    paths.push({ params: { path: `mutations/${gene.slug}` } });
  }

  // Gene × cancer intersection pages
  for (const mp of MUTATION_PAGES) {
    paths.push({ params: { path: `mutations/${mp.geneSlug}/${mp.cancerSlug}` } });
  }

  // Blog posts
  const posts = await getCollection('blog');
  for (const post of posts) {
    const slug = post.id.replace(/\/index\.mdx?$/, '').replace(/\.mdx?$/, '');
    paths.push({ params: { path: `blog/${slug}` } });
  }

  return paths;
};

export const GET: APIRoute = async ({ params }) => {
  const path = params.path ?? '';
  const segments = path.split('/').filter(Boolean);
  const cacheKey = segments.join('/') || '__default__';

  const node = await resolveTemplate(segments);
  const png = await renderOgImage(node, cacheKey);

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400, s-maxage=604800',
    },
  });
};
