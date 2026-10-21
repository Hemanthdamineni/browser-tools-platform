#!/usr/bin/env node
/**
 * Copies the libheif WebAssembly binary out of `node_modules` and into
 * `public/vendor/libheif/`, so the HEIC tool can fetch it from this origin at
 * runtime instead of a CDN.
 *
 * The binary is committed to the repository: the site must build and run
 * without a network connection, and the file has to be served from our own
 * origin for the "no third-party requests" guarantee to hold.
 *
 * Re-run this after bumping the `libheif-js` dependency:
 *   npm run vendor:heif
 *
 * `npm run vendor:heif -- --check` verifies that the committed copy still
 * matches the installed package without writing anything.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = join(root, 'node_modules', 'libheif-js', 'libheif-wasm');
const target = join(root, 'public', 'vendor', 'libheif');
const check = process.argv.includes('--check');

const FILES = ['libheif.wasm', 'LICENSE'];

if (!existsSync(join(source, 'libheif.wasm'))) {
  console.error('libheif-js is not installed — run `npm install` first.');
  process.exit(1);
}

function digest(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

mkdirSync(target, { recursive: true });

let stale = 0;
for (const name of FILES) {
  const from = join(source, name);
  const to = join(target, name);
  if (!existsSync(from)) {
    console.error(`libheif-js does not ship ${name} — skipping.`);
    continue;
  }
  if (check) {
    if (!existsSync(to) || digest(from) !== digest(to)) {
      console.error(`public/vendor/libheif/${name} is out of date — run \`npm run vendor:heif\`.`);
      stale += 1;
    }
    continue;
  }
  copyFileSync(from, to);
  const kb = (statSync(to).size / 1024).toFixed(0);
  console.log(`public/vendor/libheif/${name} (${kb} kB)`);
}

if (check) {
  if (stale) process.exit(1);
  console.log('public/vendor/libheif/ matches the installed libheif-js.');
} else {
  console.log('Done. The HEIC decoder is now served from this origin.');
}
