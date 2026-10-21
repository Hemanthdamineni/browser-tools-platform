import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

/**
 * HEIC → JPG: the decoder is a large WebAssembly build, so these tests cover
 * the parts that only a real browser can prove — the WASM really decodes a
 * HEIC file, the binary is served from this origin, and a file that cannot be
 * decoded fails with a readable message instead of a broken result.
 *
 * `e2e/fixtures/sample.heic` is a synthetic 24×24 red-to-blue gradient and
 * `e2e/fixtures/alpha.heic` a 24×24 image whose left half is transparent —
 * both encoded with libheif's own `heif-enc` (no third-party imagery).
 * `e2e/fixtures/rotated.heic` is a 40×24 gradient with an `irot` property
 * (90° counter-clockwise) added, so the decoder has to rotate it to 24×40.
 * Regenerate the first two with:
 *   magick -size 24x24 gradient:'#ff0000-#0000ff' -depth 8 PNG24:src.png
 *   heif-enc -q 90 src.png e2e/fixtures/sample.heic
 *   magick -size 24x24 xc:none -fill red -draw "rectangle 12,0 23,23" PNG32:a.png
 *   heif-enc -q 90 a.png e2e/fixtures/alpha.heic
 */

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

/** Read the width/height out of a JPEG's first SOF marker. */
function jpegSize(bytes: Buffer): { width: number; height: number } {
  let at = 2;
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) {
      at += 1;
      continue;
    }
    const marker = bytes[at + 1]!;
    const length = bytes.readUInt16BE(at + 2);
    const isSof =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      return { height: bytes.readUInt16BE(at + 5), width: bytes.readUInt16BE(at + 7) };
    }
    at += 2 + length;
  }
  throw new Error('No JPEG SOF marker found.');
}

/** Read the width/height out of a PNG's IHDR chunk. */
function pngSize(bytes: Buffer): { width: number; height: number } {
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/** Download the first output of the last run and return its bytes. */
async function saveFirstOutput(page: import('@playwright/test').Page): Promise<Buffer> {
  const download = page.waitForEvent('download');
  await page.locator('[data-outputs] button', { hasText: 'Save' }).first().click();
  const file = await download;
  const path = await file.path();
  return fs.readFileSync(path!);
}

/** Decode an encoded image in the browser and read one RGBA pixel. */
async function pixelAt(
  page: import('@playwright/test').Page,
  mime: string,
  bytes: Buffer,
  x: number,
  y: number,
): Promise<number[]> {
  return page.evaluate(
    async ({ mime, data, x, y }) => {
      const img = new Image();
      img.src = `data:${mime};base64,${data}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No 2D context.');
      ctx.drawImage(img, 0, 0);
      const pixel = ctx.getImageData(x, y, 1, 1).data;
      return [pixel[0] ?? 0, pixel[1] ?? 0, pixel[2] ?? 0, pixel[3] ?? 0];
    },
    { mime, data: bytes.toString('base64'), x, y },
  );
}

test('converts a HEIC photo to JPG in the browser', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/tools/heic-to-jpg`);
  await page.setInputFiles('input[type=file]', fixture('sample.heic'));
  await page.locator('[data-run]').click();

  await expect(page.locator('[data-result-wrap]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-error]')).toBeHidden();
  await expect(page.locator('[data-outputs] li')).toHaveCount(1);
  await expect(page.locator('[data-outputs] li').first()).toContainText('sample.jpg');

  const bytes = await saveFirstOutput(page);
  // A real JPEG: SOI marker, then a frame header with the decoded size.
  expect(bytes[0]).toBe(0xff);
  expect(bytes[1]).toBe(0xd8);
  expect(jpegSize(bytes)).toEqual({ width: 24, height: 24 });
});

test('serves the decoder from this origin and never contacts a third party', async ({
  page,
  baseURL,
}) => {
  const external: string[] = [];
  const local: string[] = [];
  page.on('request', (req) => {
    const url = req.url();
    if (url.startsWith('data:') || url.startsWith('blob:')) return;
    if (new URL(url).origin !== new URL(baseURL!).origin) external.push(url);
    else local.push(url);
  });

  await page.goto(`${baseURL}/tools/heic-to-jpg`);
  await page.setInputFiles('input[type=file]', fixture('sample.heic'));
  await page.locator('[data-run]').click();
  await expect(page.locator('[data-result-wrap]')).toBeVisible({ timeout: 30_000 });

  expect(external).toEqual([]);
  // The WebAssembly binary is fetched from our own origin, not a CDN.
  expect(local.some((url) => url.includes('/vendor/libheif/libheif.wasm'))).toBe(true);
});

test('converts a HEIC photo to PNG', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/tools/heic-to-jpg`);
  await page.selectOption('[data-opt-key="to"]', 'png');
  await page.setInputFiles('input[type=file]', fixture('sample.heic'));
  await page.locator('[data-run]').click();

  await expect(page.locator('[data-result-wrap]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-outputs] li').first()).toContainText('sample.png');

  const bytes = await saveFirstOutput(page);
  expect(bytes.subarray(0, 8)).toEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
  expect(pngSize(bytes)).toEqual({ width: 24, height: 24 });
});

test('converts a batch of files, one output per file', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/tools/heic-to-jpg`);
  await page.setInputFiles('input[type=file]', [
    { name: 'first.heic', mimeType: 'image/heic', buffer: fs.readFileSync(fixture('sample.heic')) },
    {
      name: 'second.heic',
      mimeType: 'image/heic',
      buffer: fs.readFileSync(fixture('sample.heic')),
    },
  ]);
  await page.locator('[data-run]').click();

  await expect(page.locator('[data-result-wrap]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-outputs] li')).toHaveCount(2);
  await expect(page.locator('[data-outputs] li').first()).toContainText('first.jpg');
  await expect(page.locator('[data-outputs] li').nth(1)).toContainText('second.jpg');
});

test('explains that a file which is not HEIC cannot be converted', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/tools/heic-to-jpg`);
  await page.setInputFiles('input[type=file]', {
    name: 'not-a-photo.heic',
    mimeType: 'image/heic',
    buffer: Buffer.from('this is not a HEIC file, it is just some text'),
  });
  await page.locator('[data-run]').click();

  const error = page.locator('[data-error]');
  await expect(error).toBeVisible();
  await expect(error).toContainText(/not a HEIC or HEIF image/i);
  await expect(page.locator('[data-result-wrap]')).toBeHidden();
});

test('explains that a corrupt HEIC cannot be decoded', async ({ page, baseURL }) => {
  // A valid `ftyp` box followed by rubbish: the container is right, the
  // bitstream is not.
  const header = Buffer.alloc(16);
  header.writeUInt32BE(16, 0);
  header.write('ftyp', 4, 'ascii');
  header.write('heic', 8, 'ascii');
  header.writeUInt32BE(0x2000, 12);

  await page.goto(`${baseURL}/tools/heic-to-jpg`);
  await page.setInputFiles('input[type=file]', {
    name: 'corrupt.heic',
    mimeType: 'image/heic',
    buffer: Buffer.concat([header, Buffer.alloc(64, 0x5a)]),
  });
  await page.locator('[data-run]').click();

  const error = page.locator('[data-error]');
  await expect(error).toBeVisible({ timeout: 30_000 });
  await expect(error).toContainText(/could not be decoded/i);
  await expect(page.locator('[data-result-wrap]')).toBeHidden();
});

test('applies the rotation stored in the file', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/tools/heic-to-jpg`);
  await page.selectOption('[data-opt-key="to"]', 'png');
  await page.setInputFiles('input[type=file]', fixture('rotated.heic'));
  await page.locator('[data-run]').click();

  await expect(page.locator('[data-result-wrap]')).toBeVisible({ timeout: 30_000 });
  // The report lists the decoded size, which is the rotated one.
  await expect(page.locator('[data-report]')).toContainText('24×40');

  const bytes = await saveFirstOutput(page);
  expect(pngSize(bytes)).toEqual({ width: 24, height: 40 });
});

test('keeps the alpha channel when the output format supports it', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/tools/heic-to-jpg`);
  await page.selectOption('[data-opt-key="to"]', 'png');
  await page.setInputFiles('input[type=file]', fixture('alpha.heic'));
  await page.locator('[data-run]').click();

  await expect(page.locator('[data-result-wrap]')).toBeVisible({ timeout: 30_000 });
  const bytes = await saveFirstOutput(page);
  expect(bytes.subarray(0, 8)).toEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );

  // The left half of the fixture is transparent, the right half is red.
  const transparent = await pixelAt(page, 'image/png', bytes, 2, 12);
  expect(transparent[3]).toBeLessThan(8);
  const opaque = await pixelAt(page, 'image/png', bytes, 20, 12);
  expect(opaque[3]).toBe(255);
  expect(opaque[0]).toBeGreaterThan(200);
  expect(opaque[1]).toBeLessThan(60);
});

test('flattens transparency onto the chosen background for JPEG', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/tools/heic-to-jpg`);
  await page.fill('[data-opt-key="background"]', '#000000');
  await page.setInputFiles('input[type=file]', fixture('alpha.heic'));
  await page.locator('[data-run]').click();

  await expect(page.locator('[data-result-wrap]')).toBeVisible({ timeout: 30_000 });
  const bytes = await saveFirstOutput(page);

  // The transparent half is now the background colour, the other half red.
  const background = await pixelAt(page, 'image/jpeg', bytes, 2, 12);
  expect(background[0]).toBeLessThan(30);
  expect(background[1]).toBeLessThan(30);
  expect(background[2]).toBeLessThan(30);
  const opaque = await pixelAt(page, 'image/jpeg', bytes, 20, 12);
  expect(opaque[0]).toBeGreaterThan(180);
  expect(opaque[1]).toBeLessThan(80);
});

test('runs the decoder in a Web Worker so the page stays responsive', async ({ page, baseURL }) => {
  const workers: string[] = [];
  page.on('worker', (worker) => workers.push(worker.url()));

  await page.goto(`${baseURL}/tools/heic-to-jpg`);
  await page.setInputFiles('input[type=file]', fixture('sample.heic'));
  await page.locator('[data-run]').click();
  await expect(page.locator('[data-result-wrap]')).toBeVisible({ timeout: 30_000 });

  expect(workers.length).toBeGreaterThan(0);
  expect(workers.some((url) => url.includes('worker'))).toBe(true);
});

test('keeps the progress and error areas hidden until a run starts', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/tools/heic-to-jpg`);
  await expect(page.locator('[data-progress-wrap]')).toBeHidden();
  await expect(page.locator('[data-error]')).toBeHidden();
  await expect(page.locator('[data-result-wrap]')).toBeHidden();
});

test('only offers the JPEG background while the output format is JPEG', async ({
  page,
  baseURL,
}) => {
  await page.goto(`${baseURL}/tools/heic-to-jpg`);
  const background = page.locator('[data-option-wrap="background"]');
  await expect(background).toBeVisible();
  await page.selectOption('[data-opt-key="to"]', 'png');
  await expect(background).toBeHidden();
  await page.selectOption('[data-opt-key="to"]', 'webp');
  await expect(background).toBeHidden();
  await page.selectOption('[data-opt-key="to"]', 'jpeg');
  await expect(background).toBeVisible();
});
