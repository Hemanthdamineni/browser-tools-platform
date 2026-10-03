import { describe, expect, it } from 'vitest';
import {
  MAX_FILE_COUNT,
  MAX_TOTAL_FILE_BYTES,
  readAsText,
  sanitizeZipEntryNames,
  validateFileSelection,
} from './files';

describe('sanitizeZipEntryNames', () => {
  it('normalizes unsafe names and preserves duplicate entries', () => {
    expect(
      sanitizeZipEntryNames([
        '../secret.txt',
        '/absolute.txt',
        'folder/../safe.txt',
        'safe.txt',
        'safe.txt',
      ]),
    ).toEqual(['secret.txt', 'absolute.txt', 'safe.txt', 'safe-2.txt', 'safe-3.txt']);
  });
});

describe('validateFileSelection', () => {
  it('rejects too many files and excessive total bytes', () => {
    const tooMany = Array.from(
      { length: MAX_FILE_COUNT + 1 },
      (_, i) => new File(['x'], `file-${i}.txt`),
    );
    expect(validateFileSelection(tooMany)).toMatch(/at most/i);

    const tooLarge = new File([new Uint8Array(MAX_TOTAL_FILE_BYTES + 1)], 'large.bin');
    expect(validateFileSelection([tooLarge])).toMatch(/100 MB/i);
  });

  it('accepts a normal selection', () => {
    expect(validateFileSelection([new File(['ok'], 'ok.txt')])).toBeNull();
  });
});

describe('abortable file readers', () => {
  it('rejects immediately when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(readAsText(new Blob(['text']), 'utf-8', controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});
