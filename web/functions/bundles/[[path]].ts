// Pages Function: proxies /bundles/* and /api/sample-data/* requests to R2 bucket
// The [[path]] catch-all captures everything after /bundles/

interface Env {
  ASSETS_BUCKET: R2Bucket;
}

const CONTENT_TYPES: Record<string, string> = {
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

function getContentType(key: string): string {
  const ext = key.slice(key.lastIndexOf('.'));
  return CONTENT_TYPES[ext] || 'application/octet-stream';
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  // R2 key mirrors the URL path with bundles/ prefix
  const key = 'bundles/' + url.pathname.replace(/^\/bundles\//, '');

  if (!key || key === 'bundles/') {
    return new Response('Not Found', { status: 404 });
  }

  const object = await context.env.ASSETS_BUCKET.get(key);

  if (!object) {
    return new Response('Not Found', { status: 404 });
  }

  const headers = new Headers();
  headers.set(
    'Content-Type',
    object.httpMetadata?.contentType || getContentType(key),
  );
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  return new Response(object.body, { headers });
};
