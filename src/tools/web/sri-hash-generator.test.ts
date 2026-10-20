import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './sri-hash-generator.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('sri-hash-generator', () => {
  it('generates an integrity-only sha384 hash', async () => {
    const result = await run('console.log("hi")', { algorithm: 'sha384', element: 'none' });
    expect(result.output).toMatch(/^sha384-[A-Za-z0-9+/]+=*$/);
    expect(result.filename).toBe('sri.txt');
  });

  it('generates a script snippet with crossorigin', async () => {
    const result = await run('boot()', { algorithm: 'sha256', element: 'script' });
    expect(result.output).toContain('integrity="sha256-');
    expect(result.output).toContain('crossorigin="anonymous"');
  });

  it('generates a style link snippet', async () => {
    const result = await run('.a{}', { algorithm: 'sha512', element: 'link' });
    expect(result.output).toContain('rel="stylesheet"');
    expect(result.output).toContain('integrity="sha512-');
  });

  it('is deterministic for the same input', async () => {
    const a = await run('hello sha384', { algorithm: 'sha384', element: 'none' });
    const b = await run('hello sha384', { algorithm: 'sha384', element: 'none' });
    expect(a.output).toBe(b.output);
  });

  it('rejects unsupported algorithms', async () => {
    await expect(run('x', { algorithm: 'md5' })).rejects.toThrow(ToolError);
  });

  it('shows guidance for blank input', async () => {
    const result = await run('', { algorithm: 'sha384', element: 'none' });
    expect(result.notes?.[0]).toContain('Paste');
  });
});
