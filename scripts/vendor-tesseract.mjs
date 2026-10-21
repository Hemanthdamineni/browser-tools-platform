#!/usr/bin/env node
/**
 * Copies the Tesseract OCR assets out of `node_modules` and into
 * `public/vendor/tesseract/`, so the OCR tool can load them from this origin
 * at runtime instead of a CDN.
 *
 * Three kinds of asset are vendored:
 *
 *   core/   tesseract.js-core — the WebAssembly build of Tesseract. Only the
 *           LSTM-only variants are shipped (the legacy engine is not used),
 *           one with SIMD and one without, so the tool can pick the right one
 *           for the visitor's browser.
 *   lang/   the `*.traineddata.gz` language models, taken from the
 *           `@tesseract.js-data/<lang>` packages. The list of languages comes
 *           from `src/tools/image/ocr-langs.json`, which is the single source
 *           of truth shared with the tool itself.
 *   worker.min.js — the Tesseract worker script, which tesseract.js spawns as
 *           its own Web Worker.
 *
 * The binaries are committed to the repository: the site must build and run
 * without a network connection, and every byte has to be served from our own
 * origin for the "no third-party requests" guarantee to hold.
 *
 * Re-run this after bumping `tesseract.js`, `tesseract.js-core` or any
 * `@tesseract.js-data/*` dependency:
 *   npm run vendor:tesseract
 *
 * `npm run vendor:tesseract -- --check` verifies that the committed copies
 * still match the installed packages without writing anything.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const target = join(root, 'public', 'vendor', 'tesseract');
const check = process.argv.includes('--check');

/** The languages the OCR tool offers — kept in sync with the tool by this script. */
const langsFile = join(root, 'src', 'tools', 'image', 'ocr-langs.json');
const { languages } = JSON.parse(readFileSync(langsFile, 'utf8'));

/** Files copied verbatim from node_modules: [source, destination] pairs. */
const BINARIES = [
  // Tesseract WebAssembly core (Apache-2.0).
  [
    join(root, 'node_modules', 'tesseract.js-core', 'tesseract-core-simd-lstm.wasm.js'),
    join('core', 'tesseract-core-simd-lstm.wasm.js'),
  ],
  [
    join(root, 'node_modules', 'tesseract.js-core', 'tesseract-core-lstm.wasm.js'),
    join('core', 'tesseract-core-lstm.wasm.js'),
  ],
  [join(root, 'node_modules', 'tesseract.js-core', 'LICENSE'), join('core', 'LICENSE')],
  // The worker script tesseract.js spawns (Apache-2.0 + bundled MIT notices).
  [join(root, 'node_modules', 'tesseract.js', 'dist', 'worker.min.js'), 'worker.min.js'],
  [
    join(root, 'node_modules', 'tesseract.js', 'dist', 'worker.min.js.LICENSE.txt'),
    'worker.min.js.LICENSE.txt',
  ],
  [join(root, 'node_modules', 'tesseract.js', 'LICENSE.md'), 'LICENSE'],
];

for (const language of languages) {
  BINARIES.push([
    join(
      root,
      'node_modules',
      '@tesseract.js-data',
      language.code,
      '4.0.0_best_int',
      `${language.code}.traineddata.gz`,
    ),
    join('lang', `${language.code}.traineddata.gz`),
  ]);
}

/**
 * The provenance note for the language models. The npm packages carry no
 * licence file of their own, so the origin and the licence of the underlying
 * Tesseract models are spelled out here.
 */
const LANG_NOTICE = `Tesseract language models
========================

The *.traineddata.gz files in this directory are the Tesseract LSTM language
models, taken unchanged from the npm packages:

${languages.map((l) => `  @tesseract.js-data/${l.code}@1.0.0  (4.0.0_best_int/${l.code}.traineddata.gz)`).join('\n')}

Those packages are published by the tesseract.js project and are declared MIT
on the npm registry. The models themselves are the tessdata_best models from
the Tesseract OCR project (https://github.com/tesseract-ocr/tessdata), which
are licensed under the Apache License 2.0. The full Apache-2.0 text of the
Tesseract core is in ../core/LICENSE.

Run \`npm run vendor:tesseract\` after changing the language list to refresh
this file.
`;

/* ------------------------------- helpers ------------------------------- */

function digest(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function copy(from, to) {
  const dest = join(target, to);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(from, dest);
  return dest;
}

/* --------------------------------- run --------------------------------- */

mkdirSync(target, { recursive: true });

let stale = 0;
let total = 0;

for (const [from, to] of BINARIES) {
  if (!existsSync(from)) {
    console.error(`Missing vendored source: ${from}`);
    console.error('Run `npm install` first.');
    process.exit(1);
  }
  const dest = join(target, to);
  total += statSync(from).size;
  if (check) {
    if (!existsSync(dest) || digest(from) !== digest(dest)) {
      console.error(
        `public/vendor/tesseract/${to} is out of date — run \`npm run vendor:tesseract\`.`,
      );
      stale += 1;
    }
    continue;
  }
  copy(from, to);
  const kb = (statSync(dest).size / 1024).toFixed(0);
  console.log(`public/vendor/tesseract/${to} (${kb} kB)`);
}

// The language provenance note is generated, not copied.
const noticePath = join(target, 'lang', 'NOTICE.txt');
if (check) {
  if (!existsSync(noticePath) || readFileSync(noticePath, 'utf8') !== LANG_NOTICE) {
    console.error(
      'public/vendor/tesseract/lang/NOTICE.txt is out of date — run `npm run vendor:tesseract`.',
    );
    stale += 1;
  }
} else {
  mkdirSync(join(target, 'lang'), { recursive: true });
  writeFileSync(noticePath, LANG_NOTICE);
  console.log('public/vendor/tesseract/lang/NOTICE.txt');
}

if (check) {
  if (stale) process.exit(1);
  console.log('public/vendor/tesseract/ matches the installed tesseract.js packages.');
} else {
  console.log(
    `Done. ${(total / 1024 / 1024).toFixed(1)} MB of OCR assets are now served from this origin.`,
  );
}
