import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import tailwind from '@astrojs/tailwind';

/**
 * Public site URL. Override at build time with SITE_URL for your deployment,
 * e.g. `SITE_URL=https://toolbench.app npm run build`.
 */
const SITE_URL = process.env.SITE_URL || 'https://toolbench.app';

const srcAlias = { '@': fileURLToPath(new URL('./src', import.meta.url)) };

// https://astro.build
export default defineConfig({
  site: SITE_URL,
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    inlineStylesheets: 'auto',
    format: 'directory',
  },
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
  integrations: [tailwind({ applyBaseStyles: false })],
  vite: {
    resolve: { alias: srcAlias },
    build: {
      target: 'es2022',
      cssCodeSplit: true,
    },
    worker: {
      format: 'es',
      rollupOptions: {
        // Worker sub-build needs the alias too.
        plugins: [],
      },
    },
  },
  compressHTML: true,
});
