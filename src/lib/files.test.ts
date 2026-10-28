import { describe, expect, it } from 'vitest';
import {
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
  it('accepts any file selection without artificial limits', () => {
    const tooMany = Array.from(
      { length: 100 },
      (_, i) => new File(['x'], `file-${i}.txt`),
    );
    expect(validateFileSelection(tooMany)).toBeNull();

    const tooLarge = new File([new Uint8Array(1024 * 1024 * 1024)], 'large.bin');
    expect(validateFileSelection([tooLarge])).toBeNull();
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