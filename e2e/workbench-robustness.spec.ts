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

test('a file name is rendered as text, never as markup', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/tools/audio-to-wav`);
  const fileInput = page.locator('[data-file-workbench] input[type="file"]');
  await fileInput.setInputFiles({
    name: '<img src=x onerror=alert(1)>.wav',
    mimeType: 'audio/wav',
    buffer: Buffer.from('RIFF'),
  });
  const list = page.locator('[data-file-list]');
  await expect(list).toContainText('<img src=x onerror=alert(1)>.wav');
  // The injected markup must not have become an element.
  expect(await list.locator('img').count()).toBe(0);
});

/**
 * A minimal ID3v2.3 file whose TIT2 frame carries a single text frame. The
 * frame data is one encoding byte (0x00 = latin-1) followed by the title bytes,
 * so the whole title flows verbatim into the tool's `stats` output.
 */
function id3v2File(title: string): Buffer {
  const header = Buffer.alloc(10);
  header.write('ID3', 0, 'latin1');
  header[3] = 3; // version 2.3
  header[4] = 0;
  header[5] = 0;

  const frameData = Buffer.concat([Buffer.from([0]), Buffer.from(title, 'latin1')]);
  const frame = Buffer.alloc(10 + frameData.length);
  frame.write('TIT2', 0, 'latin1');
  frame.writeUInt32BE(frameData.length, 4); // frame size (be32)
  frame[8] = 0; // flags
  frame[9] = 0;
  frameData.copy(frame, 10);

  const bodyLen = frame.length;
  header.writeUInt32BE(bodyLen, 6); // tag size is < 128 here, so be32 === syncsafe
  const out = Buffer.concat([header, frame]);
  return out;
}

test('result stats are rendered as a key/value list', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/tools/id3-tag-reader`);
  const fileInput = page.locator('[data-file-workbench] input[type="file"]');
  await fileInput.setInputFiles({
    name: 'holiday.mp3',
    mimeType: 'audio/mpeg',
    buffer: id3v2File('Holiday'),
  });
  await page.locator('[data-run]').click();
  await expect(page.locator('[data-result-wrap]')).toBeVisible({ timeout: 15_000 });

  // The reader reports several facts (version, frame count, ID3v1 presence and
  // the decoded title), all of which belong in the stats strip.
  const stats = page.locator('[data-stats]');
  await expect(stats).not.toBeHidden();
  await expect(stats).toContainText('Title:');
  await expect(stats).toContainText('Holiday');
  await expect(stats).toContainText('frames:');
});

test('a hostile stats value is rendered as text, never as markup', async ({ page, baseURL }) => {
  // A title flows verbatim into `stats.Title`, so it is the one place a user can
  // inject markup through the results path. The workbench must escape it.
  const title = '<img src=x onerror=alert(1)>';
  await page.goto(`${baseURL}/tools/id3-tag-reader`);
  const fileInput = page.locator('[data-file-workbench] input[type="file"]');
  await fileInput.setInputFiles({
    name: 'hostile.mp3',
    mimeType: 'audio/mpeg',
    buffer: id3v2File(title),
  });
  await page.locator('[data-run]').click();
  await expect(page.locator('[data-result-wrap]')).toBeVisible({ timeout: 15_000 });

  const stats = page.locator('[data-stats]');
  await expect(stats).toContainText(title);
  // The injected markup must not have become an element.
  expect(await stats.locator('img').count()).toBe(0);
});
