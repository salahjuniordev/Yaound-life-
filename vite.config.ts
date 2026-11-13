import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const STATIC_SHELL_FILES = [
  'new-app-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
  'fonts/fredoka-latin.woff2',
  'fonts/plus-jakarta-sans-latin.woff2',
];

/**
 * Write the list of built app-shell files next to the production bundle.
 *
 * Vite hashes JS/CSS filenames, so a static service worker cannot list them
 * itself. The worker reads this manifest during install and caches the actual
 * HTML, JS and CSS for a first-load offline reload.
 */
function appShellManifestPlugin() {
  let root = process.cwd();
  let outDir = 'dist';

  return {
    name: 'yaounde-app-shell-manifest',
    apply: 'build' as const,
    configResolved(config: { root: string; build: { outDir: string } }) {
      root = config.root;
      outDir = config.build.outDir;
    },
    closeBundle() {
      const dist = resolve(root, outDir);
      const indexPath = join(dist, 'index.html');
      if (!existsSync(indexPath)) return;

      const files = new Set(['', 'index.html', 'app-shell.json', 'manifest.webmanifest']);
      const html = readFileSync(indexPath, 'utf8');
      for (const match of html.matchAll(/(?:src|href)=["'](?:\.\/|\/)?([^"'#?]+)["']/g)) {
        const path = match[1];
        if (!path || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(path)) continue;
        files.add(path);
      }

      const assetsDir = join(dist, 'assets');
      if (existsSync(assetsDir)) {
        for (const name of readdirSync(assetsDir)) {
          if (/\.(?:js|css)$/i.test(name)) files.add(`assets/${name}`);
        }
      }
      for (const path of STATIC_SHELL_FILES) {
        if (existsSync(join(dist, path))) files.add(path);
      }

      const list = [...files].filter((path) => path !== '..' && !path.includes('../')).sort();
      const buildId = createHash('sha256')
        .update(list.join('\n'))
        .update(readFileSync(indexPath))
        .digest('hex')
        .slice(0, 12);
      writeFileSync(join(dist, 'app-shell.json'), `${JSON.stringify({ buildId, files: list }, null, 2)}\n`);

      // The source worker is stable, but hashed app assets are not. Stamp the
      // built worker so every shell change causes a service-worker update and
      // a fresh app cache instead of serving a stale cached index forever.
      const swPath = join(dist, 'sw.js');
      const swMarker = "const APP_CACHE = 'yaounde-life-v8';";
      if (existsSync(swPath)) {
        const source = readFileSync(swPath, 'utf8');
        if (source.includes(swMarker)) {
          writeFileSync(swPath, source.replace(swMarker, `const APP_CACHE = 'yaounde-life-v8-${buildId}';`));
        } else {
          console.warn('[app-shell] could not stamp APP_CACHE in sw.js');
        }
      }
      console.log(`[app-shell] wrote ${list.length} entries to app-shell.json (build ${buildId})`);
    },
  };
}

export default defineConfig({
  plugins: [react(), appShellManifestPlugin()],
  base: './',
  esbuild: { legalComments: 'none' },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  server: { port: 5173 },
});
