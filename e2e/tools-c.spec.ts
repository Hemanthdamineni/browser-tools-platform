import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

for (const [id, files] of [
  ['image-resize', ['tiny.png']],
  ['audio-info', ['tone.wav']],
  ['pdf-metadata', ['one-page.pdf']],
] as const) {
  test(`${id} processes a local fixture without network requests`, async ({ page, baseURL }) => {
    const externalRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (!url.startsWith(`${baseURL}/`) && !url.startsWith('data:') && !url.startsWith('blob:')) {
        externalRequests.push(url);
      }
    });

    await page.goto(`${baseURL}/tools/${id}`);
    const fileInput = page.locator('[data-file-workbench] input[type="file"]');
    await fileInput.setInputFiles(files.map(fixture));
    await page.locator('[data-run]').click();
    await expect(page.locator('[data-result-wrap]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-error]')).toBeHidden();
    const result = page.locator('[data-report], [data-outputs]').filter({ visible: true });
    await expect(result.first()).toBeVisible();
    expect(externalRequests).toEqual([]);
  });
}
