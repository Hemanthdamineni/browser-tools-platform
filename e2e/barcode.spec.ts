import { test, expect } from '@playwright/test';
import fs from 'node:fs';

/**
 * Barcode generator: a text tool that must render an SVG <img> for every
 * symbology, validate numeric payloads and surface friendly errors — all with
 * zero network egress.
 */

test('renders a scannable SVG for the default Code 128 example', async ({ page, baseURL }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    const url = r.url();
    if (!url.startsWith(`${baseURL}/`) && !url.startsWith('data:') && !url.startsWith('blob:')) {
      external.push(url);
    }
  });

  await page.goto(`${baseURL}/tools/barcode`);
  await page.locator('[data-example]').first().click();
  await expect(page.locator('[data-result-wrap]')).toBeVisible();
  await expect(page.locator('[data-error]')).toBeHidden();
  const img = page.locator('[data-output] img');
  await expect(img).toBeVisible();
  await expect(img).toHaveAttribute('src', /^data:image\/svg\+xml;base64,/);
  expect(external).toEqual([]);
});

test('generates EAN-13 and auto-appends the check digit', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/tools/barcode`);
  await page.selectOption('[data-opt-key="symbology"]', 'ean13');
  await page.fill('[data-input]', '400638133393');
  await page.locator('[data-run]').click();
  await expect(page.locator('[data-error]')).toBeHidden();
  const img = page.locator('[data-output] img');
  await expect(img).toBeVisible();
  // The human-readable text (13 digits incl. computed check digit) is in the SVG.
  const src = (await img.getAttribute('src'))!;
  const svg = Buffer.from(src.split(',')[1]!, 'base64').toString('utf8');
  expect(svg).toContain('<text');
  expect(svg).toContain('4');
  await expect(page.locator('[data-stats]')).toContainText('4006381333931');
});

test('shows a friendly error for an invalid numeric payload', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/tools/barcode`);
  await page.selectOption('[data-opt-key="symbology"]', 'ean13');
  await page.fill('[data-input]', 'not-a-number');
  await page.locator('[data-run]').click();
  await expect(page.locator('[data-error]')).toBeVisible();
  await expect(page.locator('[data-error]')).toContainText(/not a valid/i);
});

test('can hide the human-readable text', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/tools/barcode`);
  await page.fill('[data-input]', 'HELLO-123');
  await page.uncheck('[data-opt-key="showText"]');
  await page.locator('[data-run]').click();
  await expect(page.locator('[data-error]')).toBeHidden();
  const img = page.locator('[data-output] img');
  await expect(img).toBeVisible();
  const src = (await img.getAttribute('src'))!;
  const svg = Buffer.from(src.split(',')[1]!, 'base64').toString('utf8');
  expect(svg).not.toContain('<text');
});

test('renders a square 2D DataMatrix as a path image', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/tools/barcode`);
  await page.selectOption('[data-opt-key="symbology"]', 'datamatrix');
  await page.fill('[data-input]', 'LOT-8842-A');
  await page.locator('[data-run]').click();
  await expect(page.locator('[data-error]')).toBeHidden();
  const img = page.locator('[data-output] img');
  await expect(img).toBeVisible();
  const src = (await img.getAttribute('src'))!;
  const svg = Buffer.from(src.split(',')[1]!, 'base64').toString('utf8');
  expect(svg).toContain('<path');
  expect(svg).not.toContain('<text');
  const w = svg.match(/width="(\d+)"/)![1];
  expect(svg).toContain(`viewBox="0 0 ${w} ${w}"`);
  await expect(page.locator('[data-stats]')).toContainText(/modules/i);
});

test('exports a real raster PNG from an SVG result', async ({ page, baseURL, browserName }) => {
  test.skip(browserName !== 'chromium', 'programmatic image download is exercised on Chromium');
  await page.goto(`${baseURL}/tools/barcode`);
  await page.fill('[data-input]', 'PNG-EXPORT-1');
  await page.locator('[data-run]').click();
  await expect(page.locator('[data-output] img')).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download PNG' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('code128-barcode.png');
  const file = await download.path();
  const buf = fs.readFileSync(file!);
  expect([...buf.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]); // PNG magic
  expect(buf.length).toBeGreaterThan(200);
});
