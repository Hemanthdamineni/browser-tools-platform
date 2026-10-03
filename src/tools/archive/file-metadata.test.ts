import { describe, it, expect } from 'vitest';
import tool from './file-metadata.tool';

describe('file-metadata', () => {
  it('reports a table with name, mime, size, modified and sha256', async () => {
    const file = new File(['hello'], 'a.txt', { type: 'text/plain', lastModified: 0 });
    const result = await tool.run({ files: [file], options: {} });
    expect(result.outputs).toHaveLength(0);
    expect(result.report?.render).toBe('table');
    const parsed = JSON.parse(result.report!.output) as { headers: string[]; rows: string[][] };
    expect(parsed.headers).toEqual(['Name', 'MIME type', 'Size', 'Modified', 'SHA-256']);
    expect(parsed.rows[0]![0]).toBe('a.txt');
    expect(parsed.rows[0]![1]).toBe('text/plain');
    expect(parsed.rows[0]![4]).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );
  });

  it('can skip the SHA-256 hash and totals multiple files', async () => {
    const result = await tool.run({
      files: [
        new File(['a'], 'one.txt', { type: 'text/plain' }),
        new File(['bb'], 'two.bin', { type: 'application/octet-stream' }),
      ],
      options: { hash: false },
    });
    const parsed = JSON.parse(result.report!.output) as { rows: string[][] };
    expect(parsed.rows[0]![4]).toBe('—');
    expect(result.stats?.files).toBe(2);
    expect(result.stats?.totalBytes).toBe(3);
  });

  it('rejects an empty file list', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/at least one file/i);
  });
});
