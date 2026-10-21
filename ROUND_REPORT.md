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

- `/tmp` runs on a tmpfs with a _per-user quota_, and this run exhausted it: `git` began failing with
  `unable to write file …`, which truncated `BACKLOG.md` to 0 bytes mid-run. Both the interrupted
  `git reset --hard` and a machine restart hit the same working tree, so the tick-off commit had to be
  re-applied from scratch on a freshly reset `origin/master`. Deleting the two finished item worktrees
  (1.4 GB) restored the quota. Worth knowing: `df` shows space free long before the quota is hit.
- A machine restart wiped `/tmp/opencode` earlier in the run and every worktree directory vanished.
  The branches survived in the repo, so all in-flight work was recovered from git and re-verified. The
  first `pdf-compress` verify reported EXIT=1 for this reason alone; re-run on a fresh worktree it is
  green.
- The `ml-runtime-foundation` sub-agent died _after_ committing, with a transient
  LLM-infrastructure error (`getaddrinfo ETIMEOUT opencode.ai`) — not an item failure. Its commit
  survived, so I verified and merged it instead of spending a failed attempt on it.
- The run's first batch (`merge-conditional-headers`, `upgrade-image-batch-2/3`, `video-foundation`)
  was lost to a push race with concurrent run `run-20261017-1202-8af9`; the control files were
  re-read and a fresh batch selected. `master` advanced five times during this run and one push was
  rejected and had to be re-applied.

Mistakes noticed:

- **`pdf-lib` ships eagerly to the whole site.** `src/tools/pdf/shared.ts` imports `pdf-lib`, and all
  12 eager `src/tools/pdf/*.meta.ts` files import _values_ (`pdfCredit`, `fflateCredit`) from it.
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

## run-20261021-0200-recovery — 2026-10-21T02:00:00Z

Recovery round. The 2026-10-17 runs left the repo mid-flight: `master` was 20 commits behind
`origin/master`, four `⏳` claims were four days stale, six branches held finished work that was
never merged, and the primary checkout held 282 untracked tool files that one `git reset` away from
being lost. No orchestrator was running.

- Merged: **the uncommitted tranche** — 94 new tools rescued from the 2026-10-19 working tree onto
  `master` (`recover/uncommitted-tranche` → `1904c74`, `71e3f12`, merged as `9a22354`). It arrived
  broken and was fixed rather than pushed as-is:
  - `src/tools/text/unicode-lookup.meta.ts` had been committed **without its `.tool.ts`**, so
    `build()` in `src/lib/registry.ts` threw and took `src/lib/registry.test.ts` down with it.
    The implementation and 8 tests were written from the meta's own spec.
  - The tranche's copy of `src/lib/registry.test.ts` was an **older revision** that reverted
    `origin/master`'s alias coverage (`ALIAS_TOOLS`, `redirectTarget`) and its 120 s timeout. The
    upstream version was kept.
  - 32 `related` arrays pointed at ids that the header merges had turned into hidden aliases, so
    those links resolved to nothing. They now point at the merged replacement.
- Merged: `tool/merge-escape-tools-r432a` (`85eb2e3`) — `string-escape` absorbs backslash/json/
  unicode escape; the old ids are aliases.
- Merged: `tool/upgrade-image-batch-2` (`4979654`) and `tool/upgrade-image-batch-3` (`5903715`) —
  the image tools are now `stable`.
- Merged: `tool/video-foundation` (`14f0fc6`) — the `video` category plus a shared lazy video
  engine on Mediabunny (MPL-2.0). `mediabunny@^1.61.6` added to `package.json`/`NOTICE`.
- Merged: `tool/image-strip-metadata-r432a` (`4c3fe6b`) — lossless EXIF/GPS/XMP removal.
- Merged: `worktree-new-tool-worktree` — 7 new tools (matrix calculator, binary file signature
  inspector, CSV transpose, markdown table format, Unicode styles, whitespace visualizer). Its
  `image-resize` was dropped in favour of the `stable` version, and its `markdown-toc` was dropped
  because the rescued tranche already ships that id — the registry rejects duplicate ids.
- Fixed (from the unmerged `phase2/verification` branch): the workbench capped file selection
  (20 files / 100 MB), sanitised ZIP entry names (`../x` no longer escapes the archive, duplicates
  no longer overwrite each other), made file reads abortable, escaped filenames before they reach
  `innerHTML`, invalidated stale runs so a cancelled run cannot publish a result after a reset,
  and released preview object URLs. `tar-create` now writes the ustar `size`/`mtime` fields as
  12-byte fields with a POSIX base-256 fallback, and `calculator` rejects empty function arguments
  and non-finite results.
- Control files: `BACKLOG.md` and `TODOS.md` no longer carry a single `⏳` claim. Everything that
  landed is ticked with its merge SHA, and the four dead runs are marked `⚠️ run died`.
- Tooling: `scripts/gen-tools-doc.mjs` is committed and wired to `npm run docs:tools`; CI gained a
  "Tool docs are current" step, so the inventory cannot drift again. The whole tree is now
  Prettier-clean (671 files were not) and `npm run format:check` passes.
- Tests: the external golden-output checks from `phase2/verification` were ported — `unzip` for
  `zip-create`, `ffprobe` for `audio-to-wav`, `qpdf` and `pdfinfo` for `pdf-metadata`. They check our
  output with programs we do not control, which is the only way to catch a file we can read back
  but no other program can. Each skips itself when its reference tool is absent; CI installs the
  four so the checks actually run there.
- Merged: **two more tools rescued from the dead runs' abandoned worktrees** — `yaml-format`
  (YAML 1.2 formatter/validator, no new dependencies) and `code-beautify` (Prettier standalone with
  each parser plugin loaded lazily). `prettier` moves from devDependencies to dependencies because
  the tool ships it to the browser, and `NOTICE` records it as a runtime dependency. The text
  workbench now shows a tool's progress message while it runs, which the lazy parser loading
  needs. The remaining abandoned implementations (`code-minify`, `image-ocr`, `merge-base64`,
  `pdf-sign`, `heic-to-jpg`) were committed onto their branches and pushed, so they are preserved
  rather than lost; they need dependency, licence and review work before they can be merged.

Checks: `astro check` → 0 errors; `eslint .` → clean; `prettier --check` → clean;
`vitest run` → 395 files / 3406 tests; `astro build` → 398 pages.

Mistakes noticed:

- **`npm run test` was OOM-killed on this machine**, not logically red: every test file passed
  (389/389) but vitest reported `Worker exited unexpectedly` and exited 1, because a jsdom
  environment per file at 12 workers exceeded the 15 GB of RAM. Capping the pool
  (`maxWorkers: 6`) makes it deterministic. The earlier "main is red" note in
  `run-20261016-1001-61fc` was this same symptom seen at a smaller catalogue size.
- **The control files were the only record of what had been done**, and they were four days stale.
  Six branches (`tool/merge-escape-tools-r432a`, `tool/upgrade-image-batch-2/3`,
  `tool/video-foundation`, `tool/image-strip-metadata-r432a`, `tool/merge-cache-headers-r68f4`)
  held finished work that no control file referenced.
- **Dead branches pile up and collide on bare names.** `tool/merge-cache-headers`,
  `tool/merge-cache-headers-r68f4`, `tool/merge-conditional-headers`, `tool/pdf-compress`,
  `tool/qr-scanner-r68f4` and `tool/ml-runtime-foundation` are byte-identical patches to work
  already on `origin/master`. They should be deleted.
- **The `phase2/verification` branch is a work of its own**, not a merge candidate: it carries its
  own `docs/mission/` ledger and was written against a much older tree. Merging it wholesale would
  have reverted newer work; the security fixes were ported by hand instead.
- **`related` ids are not validated anywhere.** Pointing one at a hidden alias is silently ignored
  by `relatedTools()`, so a stale id looks fine and silently falls back to same-category tools.
  There should be a registry test for dangling `related` ids.
- **Two tools with the same purpose but different ids can both ship.** The tranche and
  `worktree-new-tool-worktree` each had a `markdown-toc`; the registry's duplicate-id check caught
  it only because the ids happened to match.

Ideas:

- `parquet-inspect`, `hex-diff` and `subtitle-convert` are still worth building (see the ideas
  list above) — `subtitle-convert` in particular is already half-built in the rescued tranche.
