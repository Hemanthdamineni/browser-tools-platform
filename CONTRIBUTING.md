# Contributing

Thanks for helping. The bar: tools must be genuinely useful, correct, accessible,
and run **entirely on the visitor's device**.

## Setup

```bash
npm install
npm run dev
```

## Adding a tool

See [docs/ADDING-A-TOOL.md](docs/ADDING-A-TOOL.md). Three files, no wiring.

## Before you open a PR

```bash
npm run verify   # astro check + eslint + vitest + build — all must pass
```

- New runtime dependency? Explain why in the PR, confirm the licence is
  permissive (MIT / ISC / BSD / Apache-2.0), and add it to `NOTICE`.
- No network calls from a tool. If one is unavoidable it must be opt-in,
  declared in `meta.privacy.network`, and added to the e2e allow-list with a
  comment.
- Keep copy plain and jargon-light. British or American spelling is fine; be
  consistent within a file.
- Accessibility: label every control, keep focus order sane, don't rely on
  colour alone, respect `prefers-reduced-motion`.

## Style

Prettier + ESLint enforce formatting. TypeScript `strict` with
`noUncheckedIndexedAccess`. Prefer small pure functions.

## Reporting bugs / requesting tools

Open an issue. For tool requests, say what it does, a sample input/output, and
why the browser can do it without a server.
