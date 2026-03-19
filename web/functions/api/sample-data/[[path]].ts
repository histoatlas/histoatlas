// Pages Function: proxies /api/sample-data/* requests to R2 bucket
// Needed because PANCAN.json exceeds Pages' 25MB file limit

interface Env {
  ASSETS_BUCKET: R2Bucket;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  // R2 key: api/sample-data/{cancer}.json
  const key = url.pathname.replace(/^\//, '');

  if (!key || key === 'api/sample-data/') {
    return new Response('Not Found', { status: 404 });
  }

  const object = await context.env.ASSETS_BUCKET.get(key);

  if (!object) {
    return new Response('Not Found', { status: 404 });
  }

  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  headers.set('Cache-Control', 'public, max-age=86400, s-maxage=604800');
  headers.set('Access-Control-Allow-Origin', '*');

  return new Response(object.body, { headers });
};
