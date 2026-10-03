import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

test('reset hides prior results and leaves a clean workbench', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/tools/audio-to-wav`);
  const fileInput = page.locator('[data-file-workbench] input[type="file"]');
  await fileInput.setInputFiles(fixture('tone.wav'));
  await page.locator('[data-run]').click();
  await expect(page.locator('[data-result-wrap]')).toBeVisible({ timeout: 15_000 });

  await page.locator('[data-reset]').click();
  await expect(page.locator('[data-result-wrap]')).toBeHidden();
  await expect(page.locator('[data-error]')).toBeHidden();
  await expect(page.locator('[data-progress-wrap]')).toBeHidden();
  await expect(page.locator('[data-file-list]')).toBeEmpty();
  await expect(page.locator('[data-run]')).toBeDisabled();
});

test('an in-flight run cannot publish a result after cancel and reset', async ({
  page,
  baseURL,
}) => {
  await page.goto(`${baseURL}/tools/audio-to-wav`);
  const fileInput = page.locator('[data-file-workbench] input[type="file"]');
  await fileInput.setInputFiles(fixture('tone.wav'));
  await page.locator('[data-run]').click();
  await page.locator('[data-cancel]').click();
  await page.locator('[data-reset]').click();
  // Give any late worker message a chance to land, then assert nothing stale reappears.
  await page.waitForTimeout(1_000);
  await expect(page.locator('[data-result-wrap]')).toBeHidden();
  await expect(page.locator('[data-error]')).toBeHidden();
});
