import satori from 'satori';
import sharp from 'sharp';
import { loadFonts } from './fonts';

const WIDTH = 1200;
const HEIGHT = 630;
const MAX_CACHE = 200;

const cache = new Map<string, Buffer>();

export async function renderOgImage(node: unknown, cacheKey?: string): Promise<Buffer> {
  if (cacheKey && cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  const svg = await satori(node as React.ReactElement, {
    width: WIDTH,
    height: HEIGHT,
    fonts: loadFonts(),
  });

  const png = await sharp(Buffer.from(svg)).png().toBuffer();

  if (cacheKey) {
    if (cache.size >= MAX_CACHE) {
      const firstKey = cache.keys().next().value as string;
      cache.delete(firstKey);
    }
    cache.set(cacheKey, png);
  }

  return png;
}
