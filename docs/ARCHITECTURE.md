# Architecture

## Goals

- **Private by construction.** Static files on a CDN. No server, so there is
  nothing to upload to. Tools run in the visitor's tab.
- **Lightweight core, large catalogue.** The shell is HTML + a few kB of JS.
  Each tool's code — and any heavy library it needs — is a separate chunk fetched
  only when that tool is opened.
- **Cheap to extend.** Adding a tool is three small files and no wiring
  (`docs/ADDING-A-TOOL.md`).
- **Installable everywhere.** A PWA that works offline on Windows, macOS, Linux,
  Android and iOS.

## Stack

| Concern        | Choice                                        | Why                                           |
| -------------- | --------------------------------------------- | --------------------------------------------- |
| Site generator | Astro 4, `output: 'static'`                   | Zero JS by default; islands only where needed |
| Styling        | Tailwind CSS 3 + CSS custom properties        | Small, themeable (light/dark/system)          |
| Interactivity  | Hand-written TypeScript in `<script>` islands | No framework runtime shipped                  |
| Heavy work     | Web Worker (`src/lib/worker/tool.worker.ts`)  | UI never blocks                               |
| Tests          | Vitest (unit) + Playwright (e2e + privacy)    | —                                             |

## Directory map

```
src/
  lib/
    types.ts        The tool contract (ToolMeta, ToolModule, render kinds)
    registry.ts     import.meta.glob discovery of src/tools/**
    categories.ts   Category definitions
    options.ts      resolveOptions(): merge caller values over declared defaults
    format.ts       formatBytes / slugify / escapeHtml / …
    files.ts        read*, downloadBlob, downloadZip, createDropZone
    clipboard.ts    copyText with legacy fallback
    capabilities.ts SSR-safe feature detection
    seo.ts          JSON-LD builders
    site.ts         Branding + nav (rename the product here only)
    worker/
      tool.worker.ts  Generic worker: id -> lazy import -> run()
      client.ts       runTool / runToolById, worker lifecycle, abort
  components/
    Layout / Header / Footer / BaseHead / SearchDialog / ThemeToggle / Icon
    ToolPage.astro        Per-tool page chrome (breadcrumb, privacy, FAQ, related)
    PrivacyBadge.astro    Rendered from meta.privacy — never hard-coded
    ToolCard / CategoryCard
    workbench/
      TextWorkbench.astro + FileWorkbench.astro
      OptionsFields.astro   Renders the option schema
      shared.ts             readOptions / applyShowWhen / renderTextResult
  pages/
    index / tools/index / tools/[tool] / categories/[category] / privacy / about
    sitemap.xml.ts / robots.txt.ts / manifest.webmanifest.ts / opensearch.xml.ts
  tools/<category>/<id>.{meta,tool,test}.ts
public/
  sw.js  favicon.*  icons/*  _headers  og.png
scripts/gen-icons.mjs   Deterministic PNG/ICO generation (Node zlib only)
```

## Request/response flow for a tool run

```
tool page (static HTML)
  └─ TextWorkbench / FileWorkbench island
       └─ runToolById(id, payload, { signal, onProgress })      src/lib/worker/client.ts
            ├─ text tool  → import the module on the main thread → run()
            └─ file tool  → postMessage to tool.worker.ts
                              └─ import.meta.glob lazy import of <id>.tool.ts → run()
                                   └─ progress + result posted back
```

`AbortSignal` is not structured-cloneable, so cancelling a worker job
`terminate()`s the worker; it is recreated on the next run.

## Privacy model as data

`meta.privacy = { processing: 'on-device', network: 'none' | string[], offline }`.
`PrivacyBadge` and `/privacy` are generated from this. An e2e test
(`e2e/privacy.spec.ts`) loads every tool page, exercises it, and fails if any
cross-origin request is made by a tool that declares `network: 'none'`.

## Build output

`npm run build` → `dist/` of pre-rendered HTML + hashed assets under `/_astro/`.
`public/_headers` carries the CSP and cache rules for Netlify / Cloudflare Pages;
`docs/DEPLOYMENT.md` translates them for other hosts.

## Known follow-ups

- Astro 4 has advisories fixed only in Astro 7 (all dev-server / SSR; none affect
  the static output). Tracked in `SECURITY.md`; upgrade planned.
- Worker + main thread each bundle a copy of a tool's module. Small today;
  revisit if the catalogue's worker tools get heavy.
- True multi-GB streaming hashing/compression (needs an incremental-hash lib).
