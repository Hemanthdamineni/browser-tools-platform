import { test, expect } from '@playwright/test';

/**
 * HEIC → JPG: the decoder is a large WebAssembly build, so this checks the
 * parts that are cheap to assert in a browser — the page must not reach out
 * to a third party, the options must behave, and a file that is not HEIC has
 * to fail with a readable message instead of a broken result.
 *
 * A real HEIC fixture is deliberately not committed (its licence cannot be
 * confirmed), so the happy path is covered by the unit tests.
 */

test('loads the tool page without touching a third party', async ({ page, baseURL }) => {
  const external: string[] = [];
  page.on('request', (req) => {
    const origin = new URL(req.url()).origin;
    if (origin !== new URL(baseURL!).origin && !req.url().startsWith('data:')) {
      external.push(req.url());
    }
  });

  await page.goto(`${baseURL}/tools/heic-to-jpg`, { waitUntil: 'networkidle' });
  await expect(page.locator('[data-file-workbench]')).toBeVisible();
  expect(external).toEqual([]);
});

test('keeps the Cancel and Reset buttons hidden until a run starts', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/tools/heic-to-jpg`);
  await expect(page.locator('[data-cancel]')).toBeHidden();
  await expect(page.locator('[data-reset]')).toBeHidden();
  await expect(page.locator('[data-progress-wrap]')).toBeHidden();
});

test('only offers the JPEG background while the output format is JPEG', async ({ page, baseURL }) => {
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
