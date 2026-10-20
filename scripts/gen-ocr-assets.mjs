/**
 * Stage the self-hosted tesseract.js runtime in `public/ocr/`.
 *
 * The OCR tool must never touch a CDN, so everything it needs is copied out of
 * node_modules onto the site's own origin:
 *
 *   public/ocr/worker.min.js                  — tesseract.js worker script
 *   public/ocr/tesseract-core-*-lstm.wasm.js  — wasm core builds (LSTM only)
 *   public/ocr/tessdata/<lang>.traineddata.gz — language models
 *   public/ocr/LICENSE.*.txt                  — licences for the copied binaries
 *
 * Run by `npm run build` (prebuild) and on demand with `npm run ocr:assets`.
 * `public/ocr/` is gitignored: the files are large and always regenerated.
 */
import { createRequire } from 'node:module';
import { copyFile, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'ocr');
const tessdataDir = path.join(outDir, 'tessdata');

/** Languages vendored as `@tesseract.js-data/<code>` (LSTM-only "best" models). */
const LANGUAGES = ['eng', 'deu', 'fra', 'spa'];

/**
 * The core builds tesseract.js asks for in LSTM-only mode (its default), one
 * per SIMD capability tier. Only the `-lstm` builds are needed because the tool
 * always runs with `OEM.LSTM_ONLY`.
 */
const CORE_FILES = [
  'tesseract-core-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-relaxedsimd-lstm.wasm.js',
];

const packageDir = (name) => path.dirname(require.resolve(`${name}/package.json`));

const tesseractDir = packageDir('tesseract.js');
const coreDir = packageDir('tesseract.js-core');

function modelPath(lang) {
  return path.join(packageDir(`@tesseract.js-data/${lang}`), '4.0.0_best_int', `${lang}.traineddata.gz`);
}

async function copy(from, to) {
  await copyFile(from, to);
  return (await stat(to)).size;
}

async function main() {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(tessdataDir, { recursive: true });

  const files = [
    ['worker.min.js', path.join(tesseractDir, 'dist', 'worker.min.js')],
    ...CORE_FILES.map((file) => [file, path.join(coreDir, file)]),
    ...LANGUAGES.map((lang) => [path.join('tessdata', `${lang}.traineddata.gz`), modelPath(lang)]),
  ];

  let total = 0;
  for (const [name, source] of files) {
    const size = await copy(source, path.join(outDir, name));
    total += size;
    console.log(`  ${name} — ${(size / 1048576).toFixed(1)} MB`);
  }

  // The licences travel with the copied binaries (Apache-2.0, section 4).
  await copyFile(path.join(coreDir, 'LICENSE'), path.join(outDir, 'LICENSE.tesseract.js-core.txt'));
  await copyFile(
    path.join(tesseractDir, 'dist', 'worker.min.js.LICENSE.txt'),
    path.join(outDir, 'LICENSE.tesseract.js.txt'),
  );

  console.log(
    `OCR assets ready: ${files.length} files, ${(total / 1048576).toFixed(1)} MB, in ${path.relative(root, outDir)}/`,
  );
}

await main();
