import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

/**
 * Image OCR: the engine is a ~3.8 MB WebAssembly build of Tesseract plus a
 * language model, so these tests cover the things only a real browser can
 * prove — the engine really reads the text, the binary and the model come
 * from this origin, and a file that cannot be read fails with a readable
 * message instead of an empty result.
 *
 * `e2e/fixtures/ocr-sample.png` is a 700×230 image with three lines of
 * black-on-white text ("TOOLBENCH", "Invoice 4711", "Total 42.50 EUR") and
 * `e2e/fixtures/ocr-sample-de.png` the same in German. Both are rendered by
 * `scripts/gen-ocr-fixture.mjs` in a real browser, so the glyphs are
 * antialiased like a screenshot.
 */

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

test.describe.configure({ mode: 'serial' });

/** The OCR engine is big; the first run downloads it. */
test.setTimeout(180_000);

/** The textarea the workbench shows the recognised text in. */
const report = '[data-report] textarea';

/** Run the tool on the given fixtures and wait for the result. */
async function runOcr(
  page: import('@playwright/test').Page,
  files: string | string[] | { name: string; mimeType: string; buffer: Buffer }[],
): Promise<void> {
  const inputs = Array.isArray(files) ? files : [files];
  await page.setInputFiles(
    'input[type=file]',
    inputs.map((f) => (typeof f === 'string' ? fixture(f) : f)),
  );
  await page.locator('[data-run]').click();
  await expect(page.locator('[data-result-wrap]')).toBeVisible({ timeout: 150_000 });
  await expect(page.locator('[data-error]')).toBeHidden();
}

test('reads the text out of an image', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/tools/image-ocr`);
  await runOcr(page, 'ocr-sample.png');

  const text = await page.locator(report).inputValue();
  expect(text).toContain('TOOLBENCH');
  expect(text).toContain('Invoice');
  expect(text).toContain('4711');
  // The decimal point is the part OCR usually gets wrong — check it survived.
  expect(text).toMatch(/42[.,]50/);
  // The engine must not have mixed the lines up.
  expect(text.indexOf('TOOLBENCH')).toBeLessThan(text.indexOf('Invoice'));
});

test('saves the recognised text as a .txt file', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/tools/image-ocr`);
  await runOcr(page, 'ocr-sample.png');

  await expect(page.locator('[data-outputs] li')).toHaveCount(1);
  await expect(page.locator('[data-outputs] li').first()).toContainText('ocr-sample.txt');

  const download = page.waitForEvent('download');
  await page.locator('[data-outputs] button', { hasText: 'Save' }).first().click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('ocr-sample.txt');

  const saved = fs.readFileSync((await file.path())!, 'utf8');
  expect(saved).toContain('TOOLBENCH');
  expect(saved).toContain('4711');
  expect(saved).toBe(await page.locator(report).inputValue());
});

test('reads a batch of images, one text file each', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/tools/image-ocr`);
  await runOcr(page, [
    {
      name: 'first.png',
      mimeType: 'image/png',
      buffer: fs.readFileSync(fixture('ocr-sample.png')),
    },
    {
      name: 'second.png',
      mimeType: 'image/png',
      buffer: fs.readFileSync(fixture('ocr-sample.png')),
    },
  ]);

  await expect(page.locator('[data-outputs] li')).toHaveCount(2);
  await expect(page.locator('[data-outputs] li').first()).toContainText('first.txt');
  await expect(page.locator('[data-outputs] li').nth(1)).toContainText('second.txt');

  // The combined report names both files.
  const text = await page.locator(report).inputValue();
  expect(text).toContain('first.png');
  expect(text).toContain('second.png');
  expect(text).toContain('TOOLBENCH');
});

test('uses the language model that was picked', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/tools/image-ocr`);
  await page.selectOption('[data-opt-key="language"]', 'deu');
  await runOcr(page, 'ocr-sample-de.png');

  const text = await page.locator(report).inputValue();
  expect(text).toContain('Rechnung');
  expect(text).toContain('Betrag');
  expect(text).toContain('4711');
});

test('only offers the languages whose models are shipped with the site', async ({
  page,
  baseURL,
}) => {
  await page.goto(`${baseURL}/tools/image-ocr`);
  const options = await page.locator('[data-opt-key="language"] option').allTextContents();
  expect(options.map((o) => o.trim())).toEqual([
    'English',
    'German',
    'French',
    'Italian',
    'Spanish',
    'Portuguese',
    'Dutch',
    'Russian',
  ]);
});

test('serves the engine and the model from this origin', async ({ page, baseURL }) => {
  const external: string[] = [];
  const local: string[] = [];
  page.on('request', (req) => {
    const url = req.url();
    if (url.startsWith('data:') || url.startsWith('blob:')) return;
    if (new URL(url).origin !== new URL(baseURL!).origin) external.push(url);
    else local.push(url);
  });

  await page.goto(`${baseURL}/tools/image-ocr`);
  await runOcr(page, 'ocr-sample.png');

  expect(external).toEqual([]);
  // The worker script, the WebAssembly core and the language model are all
  // fetched from this origin — never from a CDN.
  expect(local.some((url) => url.includes('/vendor/tesseract/worker.min.js'))).toBe(true);
  expect(local.some((url) => url.includes('/vendor/tesseract/core/'))).toBe(true);
  expect(local.some((url) => url.includes('/vendor/tesseract/lang/eng.traineddata.gz'))).toBe(true);
});

test('does the heavy work in a Web Worker', async ({ page, baseURL }) => {
  const workers: string[] = [];
  page.on('worker', (worker) => workers.push(worker.url()));

  await page.goto(`${baseURL}/tools/image-ocr`);
  await runOcr(page, 'ocr-sample.png');

  expect(workers.some((url) => url.includes('/vendor/tesseract/worker.min.js'))).toBe(true);
});

test('explains that a file which is not an image cannot be read', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/tools/image-ocr`);
  await page.setInputFiles('input[type=file]', {
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('this is a text file, not an image'),
  });
  await page.locator('[data-run]').click();

  const error = page.locator('[data-error]');
  await expect(error).toBeVisible();
  await expect(error).toContainText(/not a PNG, JPEG, WebP, GIF or BMP image/i);
  await expect(page.locator('[data-result-wrap]')).toBeHidden();
});

test('refuses an image that is too large to decode', async ({ page, baseURL }) => {
  // A valid PNG header that claims 6000×6000 pixels: the size is read from
  // the header, so the image is refused before it is ever decoded.
  const header = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(header, 0);
  header.writeUInt32BE(13, 8);
  header.write('IHDR', 12, 'ascii');
  header.writeUInt32BE(6000, 16);
  header.writeUInt32BE(6000, 20);

  await page.goto(`${baseURL}/tools/image-ocr`);
  await page.setInputFiles('input[type=file]', {
    name: 'huge.png',
    mimeType: 'image/png',
    buffer: header,
  });
  await page.locator('[data-run]').click();

  const error = page.locator('[data-error]');
  await expect(error).toBeVisible();
  await expect(error).toContainText(/too large to read/i);
  await expect(error).toContainText('6000×6000');
  await expect(page.locator('[data-result-wrap]')).toBeHidden();
});

test('stops when the run is cancelled', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/tools/image-ocr`);
  await page.setInputFiles('input[type=file]', fixture('ocr-sample.png'));
  await page.locator('[data-run]').click();

  // The engine is a few megabytes, so there is a window to cancel in.
  await expect(page.locator('[data-cancel]')).toBeVisible();
  await page.locator('[data-cancel]').click();

  await expect(page.locator('[data-progress-msg]')).toContainText('Cancelled', {
    timeout: 30_000,
  });
  await expect(page.locator('[data-result-wrap]')).toBeHidden();
  await expect(page.locator('[data-error]')).toBeHidden();
});

test('keeps the progress and error areas hidden until a run starts', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/tools/image-ocr`);
  await expect(page.locator('[data-progress-wrap]')).toBeHidden();
  await expect(page.locator('[data-error]')).toBeHidden();
  await expect(page.locator('[data-result-wrap]')).toBeHidden();
  await expect(page.locator('[data-report]')).toBeHidden();
});
