import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FONTS_DIR = join(process.cwd(), 'src/assets/fonts');

let cached: { name: string; data: ArrayBuffer; weight: 400 | 600; style: 'normal' }[] | null =
  null;

export function loadFonts() {
  if (cached) return cached;

  const regular = readFileSync(join(FONTS_DIR, 'inter-regular.ttf'));
  const semibold = readFileSync(join(FONTS_DIR, 'inter-semibold.ttf'));

  cached = [
    { name: 'Inter', data: regular.buffer as ArrayBuffer, weight: 400, style: 'normal' as const },
    {
      name: 'Inter',
      data: semibold.buffer as ArrayBuffer,
      weight: 600,
      style: 'normal' as const,
    },
  ];

  return cached;
}
