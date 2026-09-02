# Toolbench

A large collection of file and text utilities that run **entirely in your
browser**. No uploads, no accounts, no tracking. Works offline once loaded and
installs as an app on every major OS.

> Encoders, hashers, formatters, converters, generators, colour, date/time,
> numbers, network, image, PDF, archive and audio tools — each one a small,
> lazy-loaded module so the site stays fast no matter how many are added.

## Why

Most "online tools" upload your file to someone's server for a job the browser
can do itself. Toolbench does the job locally: your data never leaves the tab.
You can verify that in DevTools → Network, or by pulling the plug after the page
loads.

## Develop

```bash
npm install
npm run dev            # http://localhost:4321
```

| Script                            | What                                                          |
| --------------------------------- | ------------------------------------------------------------- |
| `npm run dev`                     | Dev server                                                    |
| `npm run build`                   | Static build to `dist/` (`SITE_URL=… npm run build` for prod) |
| `npm run preview`                 | Serve the build                                               |
| `npm run check`                   | `astro check` (types)                                         |
| `npm run lint` / `npm run format` | ESLint / Prettier                                             |
| `npm test`                        | Vitest unit tests                                             |
| `npm run test:e2e`                | Playwright smoke + "no network egress" privacy check          |
| `npm run verify`                  | check + lint + test + build (the CI gate)                     |

Requires Node 20+.

## Add a tool

Three small files, no wiring — see **[docs/ADDING-A-TOOL.md](docs/ADDING-A-TOOL.md)**.

## How it's built

Static Astro + TypeScript, Tailwind, hand-written vanilla islands, a generic Web
Worker for heavy jobs. No backend. Full write-up in
**[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## Deploy

Any static host. Netlify / Vercel / Cloudflare Pages configs are included —
**[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

## Privacy & security

**[/privacy](src/pages/privacy.astro)** (generated from per-tool metadata) and
**[SECURITY.md](SECURITY.md)**.

## Licence

MIT — see [LICENSE](LICENSE). Bundled libraries and their licences: [NOTICE](NOTICE).
