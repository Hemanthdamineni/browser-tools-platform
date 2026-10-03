import { describe, expect, it } from 'vitest';
import { sanitizeZipEntryNames } from './files';

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
