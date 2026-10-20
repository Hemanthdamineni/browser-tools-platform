import { describe, expect, it } from 'vitest';
import tool from './repr-digest.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('repr-digest', () => {
  it('builds a SHA-256 structured-field digest', async () => {
    const result = await run('Hello, world!');
    expect(result.output).toMatch(/^sha-256=:[A-Za-z0-9+/]{43}=:$/);
    expect(result.filename).toBe('repr-digest.txt');
  });

  it('verifies a digest generated for the same text', async () => {
    const built = await run('Hello, world!');
    const result = await run('Hello, world!', { mode: 'analyze', digest: built.output });
    expect(rows(result)[0]?.[2]).toBe('Match');
    expect(result.stats).toMatchObject({ match: 'yes', algorithm: 'sha-256' });
  });

  it('detects mismatched and malformed digests', async () => {
    const built = await run('Hello');
    expect(rows(await run('Other', { mode: 'analyze', digest: built.output }))[0]?.[2]).toBe(
      'Mismatch',
    );
    expect(rows(await run('Hello', { mode: 'analyze', digest: 'sha-256=:bad=:' }))[0]?.[2]).toBe(
      'Invalid',
    );
  });

  it('handles empty text and missing expected digest', async () => {
    const built = await run('');
    expect(built.output).toMatch(/^sha-256=:[A-Za-z0-9+/]{43}=:$/);
    expect((await run('Hello', { mode: 'analyze' })).notes?.[0]).toContain('expected');
  });

  it('hashes UTF-8 representation bytes', async () => {
    const result = await run('café');
    expect(result.stats?.bytes).toBe(5);
  });

  it('documents representation and authenticity limits', async () => {
    const built = await run('x');
    const result = await run('x', { mode: 'analyze', digest: built.output });
    expect(result.notes?.[0]).toContain('does not authenticate');
  });
});
