import type { APIRoute } from 'astro';
import { readFileSync } from 'node:fs';
import { getCollection } from 'astro:content';
import { ALL_FEATURES } from '../data/featureGlossary';
import { TRACKED_GENES } from '../data/geneGlossary';
import { MUTATION_PAGES } from '../data/mutationPages';

const SITE_ORIGIN = 'https://histoatlas.com';

const STATIC_PAGES = [
  '/',
  '/about',
  '/methods',
  '/blog',
  '/privacy',
  '/terms',
];

const BUILD_DATE = new Date().toISOString().split('T')[0];

function url(path: string): string {
  const loc = path.endsWith('/') ? path : `${path}/`;
  return `  <url><loc>${SITE_ORIGIN}${loc}</loc><lastmod>${BUILD_DATE}</lastmod></url>`;
}

export const GET: APIRoute = async () => {
  const urls: string[] = [];

  // Static pages
  for (const page of STATIC_PAGES) {
    urls.push(url(page));
  }

  // Load datasets manifest
  let manifest: Record<string, { cancerTypes: string[] }> = {};
  try {
    manifest = JSON.parse(readFileSync('public/api/_manifests/datasets.json', 'utf-8'));
  } catch { /* not available */ }

  // Per-dataset × cohort pages
  for (const [dataset, info] of Object.entries(manifest)) {
    for (const cohort of info.cancerTypes) {
      urls.push(url(`/${dataset}/${cohort}/atlas`));
      urls.push(url(`/${dataset}/${cohort}/histomics`));
      urls.push(url(`/${dataset}/${cohort}/associations`));
      urls.push(url(`/${dataset}/${cohort}/cluster`));
    }
  }

  // Per-dataset × cohort × feature pages
  for (const [dataset, info] of Object.entries(manifest)) {
    for (const cohort of info.cancerTypes) {
      for (const feature of ALL_FEATURES) {
        urls.push(url(`/${dataset}/${cohort}/histomics/${encodeURIComponent(feature.name)}`));
      }
    }
  }

  // Blog posts
  const blogPosts = await getCollection('blog');
  for (const post of blogPosts) {
    const slug = post.id.replace(/\/index\.mdx?$/, '').replace(/\.mdx?$/, '');
    urls.push(url(`/blog/${slug}`));
  }

  // Mutation pages (global)
  urls.push(url('/mutations'));
  for (const gene of TRACKED_GENES) {
    urls.push(url(`/mutations/${gene.slug}`));
  }
  for (const page of MUTATION_PAGES) {
    urls.push(url(`/mutations/${page.geneSlug}/${page.cancerSlug}`));
  }

  // Cluster detail pages
  for (const dataset of Object.keys(manifest)) {
    try {
      const clusterManifest: Record<string, string[]> = JSON.parse(
        readFileSync(`public/api/${dataset}/_manifests/cluster-ids.json`, 'utf-8'),
      );
      for (const [cohort, ids] of Object.entries(clusterManifest)) {
        for (const id of ids) {
          urls.push(url(`/${dataset}/${cohort}/cluster/${encodeURIComponent(id)}`));
        }
      }
    } catch {
      // Manifest not available at build time, skip cluster URLs
    }
  }

  // Slide detail pages
  for (const dataset of Object.keys(manifest)) {
    try {
      const slideManifest: Record<string, string[]> = JSON.parse(
        readFileSync(`public/api/${dataset}/_manifests/slide-ids.json`, 'utf-8'),
      );
      for (const [cohort, ids] of Object.entries(slideManifest)) {
        for (const id of ids) {
          urls.push(url(`/${dataset}/${cohort}/slide/${encodeURIComponent(id)}`));
        }
      }
    } catch {
      // Manifest not available at build time, skip slide URLs
    }
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
  ].join('\n');

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml' },
  });
};
