# Phase 2 State

Updated: 2026-10-03

## Completed

- Added trusted external golden-output tests and verified them against installed reference CLIs:
  - `src/tools/audio/audio-to-wav.golden.test.ts` via `ffprobe` (pcm_s16le, 16 kHz, stereo, 0.1 s).
  - `src/tools/archive/zip-create.golden.test.ts` via `unzip` (entry names, nested extraction, PK signature).
  - `src/tools/pdf/pdf-metadata.golden.test.ts` via `qpdf --json` and `pdfinfo` (Title/Author/Subject/Keywords).
  - `npx vitest run` on the three files => 3 passed.
- Upgraded the privacy harness to include all registered tools (not only visible tools), validate metadata privacy contracts, exercise file inputs, await run completion, derive origin from `baseURL`, and detect failed requests and WebSockets.
- Privacy verification: `npx playwright test e2e/privacy.spec.ts --project=chromium` => 2 passed, including all tools declaring `network: 'none'`.

- Dedicated branch `phase2/verification` created and kept clean between waves.
- Local `master` E4 media commits merged non-destructively; branch now contains 160 registered tools and 164 test files.
- `docs/mission/TOOL_STATUS.md` generated for all 160 registered tools.
- Canonical baseline is green on this session's merged branch:
  - `npm run check`: 0 errors, 0 warnings, 13 hints.
  - `npm run lint`: exit 0.
  - `npm run format:check`: all matched files use Prettier code style.
  - `npx vitest run`: 164 test files, 1,167 tests passed.
  - `npm run build`: 183 pages built.
- Independent discovery lanes completed inventory, privacy, accessibility, robustness, correctness, and SEO/performance audits.
- Machine-readable task ledger is `docs/mission/task_graph.json`; generated view is `docs/mission/TASK_GRAPH.md`.

## Next

1. Extend trusted external golden-output tests for remaining image and archive/document tools.
2. Add failing tests and fixes for stale runs, object URL cleanup, preview URL release, FileReader cancellation, and file size/count caps.
3. Extend axe and keyboard coverage to all 160 current tool pages and populated category pages.
4. Add Firefox/WebKit/mobile CI projects, bundle budgets, Lighthouse, SEO assertions, red-team lanes, and docs-guide verification.

## Known risks

- Existing browser config declares Chromium and mobile Safari; CI installs Chromium only.
- Media tests mostly use internal round trips rather than independent reference tools; three tools now have CLI golden coverage, the rest do not.
- Golden tests shell out to ffprobe/unzip/qpdf/pdfinfo; CI runners must have those CLIs installed or the tests will need a skip guard.
- Video capability remains deferred pending a feasibility and licensing spike.
- Service-worker/offline behavior is not proven by E2E.
- `npm run test:e2e` on 2026-10-03 produced 10 Chromium passes and 10 mobile-Safari failures because WebKit was unavailable at `/home/zorro-omarchy/.cache/ms-playwright/webkit-2336/pw_run.sh`; this is an environment blocker, not a product verdict.

Status vocabulary: Phase 0 is BUILT+VERIFIED; Phase 1 and Phase 2 tasks are BUILT+UNVERIFIED or READY as shown in the task graph; video is DEFERRED with reason.
