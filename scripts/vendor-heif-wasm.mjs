// Copies the libheif WebAssembly binary out of `node_modules` and into
// `public/vendor/libheif/`, so the HEIC tool can fetch it from this origin at
// runtime instead of a CDN.
//
// The binary is committed to the repository: the site must build and run
// without a network connection, and the file has to be served from our own
// origin for the "no third-party requests" guarantee to hold.
//
// Re-run this after bumping the `libheif-js` dependency:
//   npm run vendor:heif
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const source = join(root, 'node_modules', 'libheif-js', 'libheif-wasm');
const target = join(root, 'public', 'vendor', 'libheif');

if (!existsSync(join(source, 'libheif.wasm'))) {
  console.error('libheif-js is not installed — run `npm install` first.');
  process.exit(1);
}

mkdirSync(target, { recursive: true });
copyFileSync(join(source, 'libheif.wasm'), join(target, 'libheif.wasm'));
copyFileSync(join(source, 'LICENSE'), join(target, 'LICENSE'));
console.log('Copied libheif.wasm + LICENSE into public/vendor/libheif/');
