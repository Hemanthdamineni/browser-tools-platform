# Deployment

The build output is a plain folder of static files. Any static host works.

```bash
SITE_URL=https://your-domain.example npm run build   # writes dist/
```

`SITE_URL` must be the final public origin — it is baked into canonical URLs,
the sitemap, `robots.txt`, JSON-LD and the OpenSearch descriptor.

## Netlify / Cloudflare Pages

Zero config. `netlify.toml` and `public/_headers` are already in the repo.

- Build command: `npm run build`
- Publish directory: `dist`
- Environment: `SITE_URL=https://your-domain`

## Vercel

`vercel.json` is included (static build + header rules). Set `SITE_URL` in the
project's environment variables.

## GitHub Pages / S3 / nginx / Caddy

Serve `dist/` as-is. Apply the headers from `public/_headers` in your server
config. The important ones:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'self' blob:; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; object-src 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Cache-Control: public, max-age=31536000, immutable        # only for /_astro/*
Cache-Control: no-cache                                    # for /sw.js
```

`Content-Type: application/manifest+json` for `/manifest.webmanifest`.

### nginx snippet

```nginx
location /_astro/ { add_header Cache-Control "public, max-age=31536000, immutable"; }
location = /sw.js { add_header Cache-Control "no-cache"; }
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' blob:; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; object-src 'none'" always;
add_header X-Content-Type-Options "nosniff" always;
```

## Custom domain + PWA

- HTTPS is required for the service worker and install prompt.
- After changing `site.name` / `site.themeColor` in `src/lib/site.ts`, re-run
  `node scripts/gen-icons.mjs` if you also change the brand colour.
- `og.png`, icons and favicons are committed; regenerate with the same script.

## Rollback

Static output — redeploy the previous build. The service worker is
network-first for navigations and versioned (`VERSION` in `public/sw.js`); bump
it when the shell changes so clients drop stale caches.
