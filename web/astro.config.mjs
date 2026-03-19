import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import fs from 'node:fs';

// Vite plugin to serve visual assets (tiles, masks) from the project root
// in development. In production these are served from Cloudflare R2.
function serveVisualAssets() {
  const root = path.resolve(import.meta.dirname, '..');
  return {
    name: 'serve-visual-assets',
    configureServer(server) {
      server.middlewares.use('/bundles', (req, res, next) => {
        const filePath = path.join(root, 'visual_assets', 'bundles', req.url);
        const resolved = path.resolve(filePath);
        // Prevent path traversal — trailing sep ensures we don't match
        // sibling dirs like visual_assets_evil/
        const allowedDir = path.join(root, 'visual_assets', 'bundles') + path.sep;
        if (!resolved.startsWith(allowedDir)) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }
        fs.stat(resolved, (err, stat) => {
          if (err || !stat.isFile()) {
            res.statusCode = 404;
            res.end('Not found');
            return;
          }
          const ext = path.extname(resolved).toLowerCase();
          const mime = ext === '.png' ? 'image/png' : ext === '.jpg' ? 'image/jpeg' : 'application/octet-stream';
          res.setHeader('Content-Type', mime);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          fs.createReadStream(resolved).pipe(res);
        });
      });
    },
  };
}

export default defineConfig({
  site: 'https://histoatlas.com',
  output: 'static',
  trailingSlash: 'always',
  integrations: [react(), mdx()],

  vite: {
    plugins: [tailwindcss(), serveVisualAssets()],
  },
});
