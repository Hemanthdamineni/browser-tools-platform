import { describe, it, expect } from 'vitest';
import { zipSync } from 'fflate';
import tool from './zip-inspect.tool';
const file = (bytes: Uint8Array, name = 'input.zip') => new File([bytes as unknown as BlobPart], name);
describe('zip-inspect', () => {
  it('reports a table with path, sizes and crc32', async () => {
    const zip = zipSync({ 'a.txt': new TextEncoder().encode('hello world'), 'b.txt': new TextEncoder().encode('x') });
    const r = await tool.run({ files: [file(zip)], options: {} });
    expect(r.report?.render).toBe('table');
    expect(r.outputs).toHaveLength(0);
    const parsed = JSON.parse(r.report!.output) as { headers: string[]; rows: string[][] };
    expect(parsed.headers).toEqual(['Path', 'Size', 'Compressed', 'Ratio', 'CRC32', 'Modified']);
    expect(parsed.rows.map((row) => row[0]!).sort()).toEqual(['a.txt', 'b.txt']);
    expect(parsed.rows[0]![1]).toMatch(/B/);
    expect(r.stats?.entries).toBe(2);
  });
  it('rejects a non-zip file', async () => {
    await expect(tool.run({ files: [new File(['garbage'], 'x.zip')], options: {} })).rejects.toThrow(/ZIP/i);
  });
});