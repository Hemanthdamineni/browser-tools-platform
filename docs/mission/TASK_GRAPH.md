# Phase 2 Task Graph

Updated: 2026-10-03

| ID | State | Task | Evidence / Open Work |
|---|---|---|---|
| `P0-branch` | **VERIFIED** | Dedicated phase branch and hygiene | git branch phase2/verification; git status --short --branch |
| `P0-toolchain` | **VERIFIED** | Toolchain and reference CLI inventory | node -v => v26.8.2; npm -v => 12.0.2; ffmpeg/ImageMagick/qpdf/poppler/zip/tar/gzip available |
| `P0-inventory` | **IMPLEMENTED** | Per-tool inventory and status table | docs/mission/TOOL_STATUS.md; src/lib/registry.ts |
| `P0-baseline` | **VERIFIED** | Canonical baseline verification | npm run check => 0 errors, 0 warnings, 13 hints; npm run lint => exit 0; npm run format:check => all matched; npx vitest run => 164 files and 1167 tests passed; npm run build => 183 pages built |
| `P1-privacy` | **VERIFIED** | Generic zero-network harness for every registered tool and file input | src/pages/tools-index.json.ts emits ALL_TOOLS; e2e/privacy.spec.ts:42-114; npx playwright test e2e/privacy.spec.ts --project=chromium => 2 passed — The test iterates every entry with network:none, performs file input via setInputFiles, awaits result/error, derives same-origin from baseURL, and captures requestfailed/WebSocket traffic. |
| `P1-correctness` | **READY** | Golden outputs using trusted external reference tools | src/tools/audio; src/tools/image; src/tools/pdf; src/tools/archive; scripts/gen-fixtures.mjs — Current media tests are primarily internal round trips; no ffmpeg/ImageMagick/qpdf/archive CLI golden assertions. |
| `P1-robustness` | **READY** | Malformed, oversized, cancellation, memory and cleanup coverage | src/lib/worker/client.ts:56-67; src/components/workbench/FileWorkbench.astro:230-278; src/lib/files.ts:3-60 — Shared worker aborts, stale UI runs, missing size/count caps, unreleased object URLs, and unsafe ZIP names require tests and fixes. |
| `P1-browsers` | **READY** | Chromium Firefox WebKit and mobile matrix | playwright.config.ts:19-22; .github/workflows/ci.yml:53-55 — Configuration has Chromium and mobile Safari only; CI installs Chromium only. |
| `P1-a11y` | **READY** | Axe and keyboard coverage across all generated routes | e2e/smoke.spec.ts:24-151; src/pages/tools/[tool].astro:8-13 — Axe covers 6 core routes and 2 tools; 80 tool pages and 9 category pages lack axe, plus keyboard flows. |
| `P1-performance` | **READY** | Bundle budgets and Lighthouse | .github/workflows/ci.yml:15-42; src/lib/registry.ts:5-18 — No bundle budget or Lighthouse CI; current dist/_astro is about 1.4 MB raw. |
| `P1-seo` | **READY** | SEO assertions and list-page structured data | src/components/BaseHead.astro:24-68; src/lib/seo.ts:9-53; dist/sitemap.xml — List/category pages have no JSON-LD and no automated canonical/OG/sitemap/robots assertions. |
| `P2-redteam` | **READY** | Independent red-team findings and fixes | src/tools/archive; src/tools/image/image-metadata.tool.ts; src/components/workbench — Zip path traversal/duplicate names, image metadata parsing, calculator evaluation, SVG external resources, and XSS surfaces need failing tests first. |
| `P3-video` | **DEFERRED** | Video feasibility spike |  — E4 media tools are now merged, but no evidence-based WebCodecs/demuxer/license/hosting spike has been run. |
| `P3-pwa` | **READY** | PWA offline implementation and proof | public/sw.js; e2e/privacy.spec.ts — Service worker exists but offline E2E and zero-network integration are not proven. |
| `P3-ci` | **READY** | CI matrix, audit, license and budget gates | .github/workflows/ci.yml — Current CI lacks browser matrix, Lighthouse, bundle-size and generated license audit gates. |
| `P3-docs` | **READY** | Adding-a-tool documentation test | docs/ADDING-A-TOOL.md — No independent agent has followed the guide and added a trivial tool. |
