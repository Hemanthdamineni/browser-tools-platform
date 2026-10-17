# Round Report

Append-only log. One entry per autonomous run. A human reviews this at the end of the
round and writes the next `BACKLOG.md` and `TODOS.md`.

## run-20261016-1001-61fc — 2026-10-16T10:19:56Z

- Merged: none — the run ended in setup because clean `main` does not pass the repo check.
- Failed: none — no items were claimed.
- Blocked: all items — the required check is red on a clean checkout, so the entire batch was left for a human rather than built on a broken base.
- Main broken: `npm run test` fails on a clean checkout of `origin/master`.
  - Failing test: `src/lib/registry.test.ts > registry > each tool module loads and exposes run()` — `Error: Test timed out in 5000ms.`
  - Root cause: the test loops over `ALL_TOOLS` (263 tools) and `await t.load()`s each `<id>.tool.ts` under jsdom. In isolation it takes ~4.4s; inside the full suite (268 files in parallel) it exceeds vitest's 5s default `testTimeout`.
  - Evidence: `npm test` on clean main failed twice with this single failure (1894 passed / 1 failed); `npx vitest run --testTimeout=60000` passes cleanly — 268 files / 1895 tests, so only the default timeout is too tight.
  - Other check steps on the same clean main are green: `astro check` → 0 errors; `eslint .` → clean; `npm run build` → 288 pages built.
  - Not fixed here: this is unrelated breakage and the protocol says not to touch it. I did **not** raise the timeout. Note a fix already exists as an uncommitted edit in the primary checkout (add `, 60_000` to that test).
- Mistakes noticed:
  - `src/lib/registry.test.ts` — the "each tool module loads and exposes run()" test has a fixed 5s timeout that does not scale with the catalogue. It is load-sensitive and deterministically red in the full parallel suite at 263 tools; it needs an explicit timeout.
  - The `TOOLS.md` generator is **not committed**. `scripts/gen-tools-doc.mjs` (regenerates `docs/TOOLS.md` + `docs/TOOLS.md.csv` from `src/tools/**/*.meta.ts`) exists only as an untracked file in the primary checkout; there is no `npm` script for it and CI does not call it. A run cannot reliably "regenerate `TOOLS.md` with the repo's generator".
  - Settings said `MAIN_BRANCH = main`, but this repo has no `main` branch: `origin/HEAD -> origin/master` and the only remote heads are `master` and `worktree-new-tool-worktree`. This run treated `master` as the main branch so pushes target the branch the other runs actually use.
  - Several concurrent runs had already claimed items (`merge-cors-headers` + `upgrade-image-batch-1/2/3`, `merge-conditional-headers`/`video-foundation`/`ml-runtime-foundation`/`pdf-compress`, `merge-cache-headers`/`qr-scanner`/`heic-to-jpg`/`image-strip-metadata`, `merge-escape-tools`/`pdf-sign`/`code-beautify`/`code-minify`); they will hit the same red suite when they verify.
- Ideas: none this run.

## run-20261017-1203-68f4 — 2026-10-17T13:49:49Z

Batch (filled from `BACKLOG.md` first, then `TODOS.md`): `merge-cache-headers`,
`ml-runtime-foundation`, `pdf-compress`, `qr-scanner`. One merge item, no intra-batch dependencies,
no two items touching the same tool.

- Merged: `merge-cache-headers` — `8943bdc` — one `cache-headers` tool absorbs Cache-Control,
  CDN-Cache-Control, Surrogate-Control, Expires, Age, Cache-Status and Vary; the seven old ids stay
  routable as hidden `redirectTo` aliases (verified with two live redirects in a browser).
- Merged: `qr-scanner` — `efe0e63` — camera plus image scanning, native `BarcodeDetector` with a
  lazily-imported `jsqr` fallback; verified by decoding real URL / Wi-Fi / plain-text QR PNGs, plus a
  friendly error on a blank image, with zero console errors and zero off-origin requests.
- Merged: `pdf-compress` — `d7aa8b6` — image downsampling and stream cleanup with presets and a
  before/after size report; a 2,058,214-byte test PDF compressed to 224,501 bytes (89.1% saved) and
  the downloaded file re-opens as a valid 1-page PDF.
- Merged: `ml-runtime-foundation` — `af99d71` — shared WebGPU→WASM loader for
  transformers.js/onnxruntime-web with Cache Storage caching, download-size/progress reporting,
  `AbortSignal` cancellation and a deny-by-default permissive-licence allow-list.
- Failed: none. Blocked: none.

Checks per merge (rebase onto `origin/master`, then `npm run verify` =
`astro check` + `eslint .` + `vitest run` + `astro build`, all EXIT=0, then a Playwright smoke test
against `astro preview`): `merge-cache-headers` 270 files / 2022 tests; `qr-scanner` 271 / 2063;
`pdf-compress` 273 / 2098 (292 pages); `ml-runtime-foundation` 280 / 2145 (291 pages).

New dependencies (both lazy; neither is in the eager bundle):
- `jsqr@^1.4.0` — Apache-2.0, ~46 KB gzip — dynamically imported only when `BarcodeDetector` is
  unavailable.
- `@huggingface/transformers@^4.3.1` — Apache-2.0 — pulled in by `import()` inside `loadModel()`;
  `onnxruntime-web` (MIT) comes in transitively. `NOTICE` was updated for both.
- A build with the loader retained emits one separate 576 KB `transformers.web.*.js` chunk that no
  page requests; the `ml` barrel itself bundles to 3.4 KB with no runtime code, so importing it from a
  `*.meta.ts` stays cheap.
- `docs/TOOLS.md` and `docs/TOOLS.md.csv` regenerated: 268 tools across 18 categories. This also
  fixes pre-existing drift — the committed docs claimed 261 tools / 17 categories and were missing
  the whole `converters` category.

Incidents:
- `/tmp` runs on a tmpfs with a *per-user quota*, and this run exhausted it: `git` began failing with
  `unable to write file …`, which truncated `BACKLOG.md` to 0 bytes mid-run. Both the interrupted
  `git reset --hard` and a machine restart hit the same working tree, so the tick-off commit had to be
  re-applied from scratch on a freshly reset `origin/master`. Deleting the two finished item worktrees
  (1.4 GB) restored the quota. Worth knowing: `df` shows space free long before the quota is hit.
- A machine restart wiped `/tmp/opencode` earlier in the run and every worktree directory vanished.
  The branches survived in the repo, so all in-flight work was recovered from git and re-verified. The
  first `pdf-compress` verify reported EXIT=1 for this reason alone; re-run on a fresh worktree it is
  green.
- The `ml-runtime-foundation` sub-agent died *after* committing, with a transient
  LLM-infrastructure error (`getaddrinfo ETIMEOUT opencode.ai`) — not an item failure. Its commit
  survived, so I verified and merged it instead of spending a failed attempt on it.
- The run's first batch (`merge-conditional-headers`, `upgrade-image-batch-2/3`, `video-foundation`)
  was lost to a push race with concurrent run `run-20261017-1202-8af9`; the control files were
  re-read and a fresh batch selected. `master` advanced five times during this run and one push was
  rejected and had to be re-applied.

Mistakes noticed:
- **`pdf-lib` ships eagerly to the whole site.** `src/tools/pdf/shared.ts` imports `pdf-lib`, and all
  12 eager `src/tools/pdf/*.meta.ts` files import *values* (`pdfCredit`, `fflateCredit`) from it.
  Because the registry eagerly imports every `*.meta.ts`, the shared chunk grows to 963 KB raw /
  322 KB gzip and 267 of the 291 built pages load it — including pages with nothing to do with PDF
  (`/tools/yaml-to-json`, `/tools/request-id`, `/tools/x-frame-options`, …). The credit strings need
  to live in a dependency-free module so only `*.tool.ts` pulls the library.
- **Merged tools keep their old implementations.** All 19 `redirectTo` aliases still have their
  `.tool.ts` and `.core.ts` files on disk, so the build emits 19 never-loaded lazy chunks of dead
  code. A merge should delete the retired implementation instead of only flipping the meta.
- **`npm run format:check` is red repo-wide** — `prettier --check` reports 457 unformatted files,
  while `.prettierrc.json`, `.prettierignore` and the `prettier` devDependency are all committed. The
  gap is that `verify` runs `check && lint && test && build` and never runs `format:check`, so
  nothing keeps the tree formatted.
- **Legacy `.js` tools are tracked but invisible.** `src/tools/index.js`,
  `src/tools/text-summary/{index,test}.js` and `src/tools/pdf/pdf-to-image.js` are committed, are not
  `*.meta.ts`, and therefore are not in the registry, not type-checked, not linted and not tested.
  `src/tools/index.js` has no importer anywhere.
- **`FileWorkbench.astro` never renders `result.stats`.** The file-workbench run result has a `stats`
  field and `pdf-compress` populates it, but the component only renders `report` and `outputs`, so the
  numbers are silently dropped. `pdf-compress` worked around this with a `report` table.
- **The `TOOLS.md` generator is still not committed.** `scripts/gen-tools-doc.mjs` exists only as an
  untracked file in the primary checkout and `verify` never calls it, which is exactly why the
  committed docs had drifted. This run copied it in to regenerate the docs and deliberately did not
  commit it.
- **Settings still say `MAIN_BRANCH = main`.** This repo has no `main`; `origin/HEAD` points at
  `master`, and treating `main` as the main branch would push to nothing.
- **Dead runs leave branches, worktrees and claims behind** (`tool/upgrade-image-batch-2` `1167aee`,
  `tool/upgrade-image-batch-3` `149b717`, prunable worktree entries, and four abandoned `⏳` claims).
  That is what makes bare branch names collide for later runs and forced this run's suffixed branch
  names.

Ideas (new tools, not variants of anything already in the catalogue — each id checked against
`docs/TOOLS.md`):
- `parquet-inspect` — read a Parquet file's schema, row groups and per-column stats in the browser
  (`hyparquet`, MIT), plus Parquet ↔ CSV/JSON. Nothing in the catalogue touches columnar data, and
  data engineers constantly need to look inside a `.parquet` without uploading it anywhere.
- `toml-convert` — TOML ↔ JSON/YAML. The catalogue covers YAML, JSON, XML and `.env`, but there is no
  TOML tool at all, despite `Cargo.toml` and `pyproject.toml` being everywhere.
- `hex-diff` — byte-level diff of two binaries (firmware, captures, blobs) with region highlighting.
  Only `diff-text` exists today, and every binary-debugging session needs this.
- `subtitle-convert` — SRT/VTT/ASS conversion, shifting and retiming, entirely on-device; there is no
  subtitle tool in the catalogue.
