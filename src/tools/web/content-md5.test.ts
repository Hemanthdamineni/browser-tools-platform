import { describe, expect, it } from 'vitest';
import tool from './content-md5.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
  warnings?: string[];
};
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('content-md5', () => {
  it('builds the standard Base64 MD5 digest', async () => {
    const result = await run('Hello, world!');
    expect(result.output).toBe('bNNVbesNpUvKBgtMOUeYOQ==');
    expect(result.filename).toBe('content-md5.txt');
  });

  it('verifies a matching digest', async () => {
    const result = await run('Hello, world!', {
      mode: 'analyze',
      digest: 'bNNVbesNpUvKBgtMOUeYOQ==',
    });
    expect(rows(result)[0]?.[2]).toBe('Match');
    expect(result.stats).toMatchObject({ match: 'yes', algorithm: 'MD5' });
  });

  it('detects mismatched and malformed digests', async () => {
    expect(
      rows(await run('Hello', { mode: 'analyze', digest: 'bNNVbesNpUvKBgtMOUeYOQ==' }))[0]?.[2],
    ).toBe('Mismatch');
    expect(rows(await run('Hello', { mode: 'analyze', digest: 'not-base64' }))[0]?.[2]).toBe(
      'Invalid',
    );
  });

  it('handles empty text and missing expected digest', async () => {
    const built = await run('');
    expect(built.output).toBe('1B2M2Y8AsgTpgAmY7PhCfg==');
    expect((await run('Hello', { mode: 'analyze' })).notes?.[0]).toContain('expected');
  });

  it('hashes UTF-8 text bytes', async () => {
    const result = await run('café');
    expect(result.stats?.bytes).toBe(5);
    expect(result.output).toBe('BxF/5KHr1USWXcGVcxg9og==');
  });

  it('documents legacy security limits', async () => {
    const result = await run('x', { mode: 'analyze', digest: 'ndTkYSaMgDT1yFZOFVxnpg==' });
    expect(result.notes?.[0]).toContain('legacy checksum');
  });

  it('flags the deprecated header in the UI', async () => {
    const built = await run('Hello, world!');
    expect(built.warnings?.[0]).toContain('deprecated');
    const verified = await run('Hello, world!', {
      mode: 'analyze',
      digest: 'bNNVbesNpUvKBgtMOUeYOQ==',
    });
    expect(verified.warnings?.[0]).toContain('RFC 7231');
  });
});
