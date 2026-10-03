# Phase 2 State

Updated: 2026-10-03

## Completed

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

1. Implement privacy harness file execution, context-level network assertions, offline coverage, and completion waits.
2. Add trusted external golden-output tests for media/document/archive tools.
3. Add failing tests and fixes for worker cancellation, stale runs, object URL cleanup, ZIP path safety, and file limits.
4. Extend axe and keyboard coverage to all 82 current tool pages and 9 populated category pages.
5. Add Firefox/WebKit/mobile CI projects, bundle budgets, Lighthouse, SEO assertions, red-team lanes, and docs-guide verification.

## Known risks

- The current E2E privacy test exercises text tools but skips the sole file tool (`crypto/file-hash`).
- Existing browser config declares Chromium and mobile Safari; CI installs Chromium only.
- Media tests mostly use internal round trips rather than independent reference tools.
- Video capability remains deferred pending a feasibility and licensing spike.
- Service-worker/offline behavior is not proven by E2E.

Status vocabulary: Phase 0 is BUILT+VERIFIED; Phase 1 and Phase 2 tasks are BUILT+UNVERIFIED or READY as shown in the task graph; video is DEFERRED with reason.
