import { describe, it, expect } from 'vitest';
import tool from './uuid-namespace.tool';
import { ToolError } from '@/lib/types';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as {
    output: string;
    render?: string;
    stats?: Record<string, string | number>;
  };

const DNS_UUID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

describe('uuid-namespace', () => {
  it('matches the known v5 DNS vector for "python.org"', async () => {
    const r = await run('python.org', { version: 'v5', namespace: 'dns' });
    expect(r.output).toBe('886313e1-3b8a-5372-9b90-0c9aee199e5d');
    expect(r.render).toBe('code');
    expect(r.stats?.algorithm).toBe('SHA-1');
  });

  it('matches the known v3 DNS vector for "python.org" (pure-JS MD5)', async () => {
    const r = await run('python.org', { version: 'v3', namespace: 'dns' });
    expect(r.output).toBe('6fa459ea-ee8a-3ca4-894e-db77e160355e');
    expect(r.stats?.algorithm).toBe('MD5');
  });

  it('sets the version and variant nibbles correctly', async () => {
    const v5 = (await run('anything', { version: 'v5' })).output;
    const v3 = (await run('anything', { version: 'v3' })).output;
    expect(v5[14]).toBe('5');
    expect(v3[14]).toBe('3');
    expect('89ab').toContain(v5[19]!);
    expect('89ab').toContain(v3[19]!);
  });

  it('is deterministic', async () => {
    const a = (await run('same-name', { version: 'v5', namespace: 'url' })).output;
    const b = (await run('same-name', { version: 'v5', namespace: 'url' })).output;
    expect(a).toBe(b);
  });

  it('produces a different id per standard namespace', async () => {
    const ids = await Promise.all(
      ['dns', 'url', 'oid', 'x500'].map(
        async (namespace) => (await run('example', { namespace })).output,
      ),
    );
    expect(new Set(ids).size).toBe(4);
  });

  it('custom namespace equal to the DNS UUID reproduces the DNS result', async () => {
    const viaSelect = (await run('python.org', { version: 'v5', namespace: 'dns' })).output;
    const viaCustom = (
      await run('python.org', { version: 'v5', namespace: 'custom', customNamespace: DNS_UUID })
    ).output;
    expect(viaCustom).toBe(viaSelect);
  });

  it('empty input → empty output', async () => {
    expect((await run('')).output).toBe('');
  });

  it('rejects an invalid custom namespace UUID', async () => {
    await expect(
      run('name', { namespace: 'custom', customNamespace: 'not-a-uuid' }),
    ).rejects.toThrow(ToolError);
    await expect(run('name', { namespace: 'custom', customNamespace: '' })).rejects.toThrow(
      /custom namespace/i,
    );
  });
});
