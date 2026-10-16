import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './secret-scanner.tool';

type Result = { output: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;

describe('secret-scanner', () => {
  it('reports known token shapes with masked previews only', () => {
    const github = `ghp_${'a'.repeat(36)}`;
    const slack = `xoxb-${'abc123-'.repeat(3)}`;
    const out = run(`GITHUB=${github}\nSLACK=${slack}`);
    expect(out.stats?.findings).toBe(2);
    expect(out.output).not.toContain(github);
    expect(out.output).not.toContain(slack);
    expect(out.output).toContain('GitHub token');
    expect(out.output).toContain('Slack token');
  });

  it('finds secret-like assignments and avoids ordinary config values', () => {
    const secret = 'very-secret-value-123';
    const out = run(`password = "${secret}"\nregion = "eu-west-1"`);
    expect(out.stats?.findings).toBe(1);
    expect(out.output).toContain('Secret-like assignment');
    expect(out.output).not.toContain(secret);
    expect(out.output).not.toContain('eu-west-1');
  });

  it('redacts recognized values while preserving surrounding text', () => {
    const secret = `AKIA${'A'.repeat(16)}`;
    const out = run(`key=${secret}; done`, { operation: 'redact' });
    expect(out.output).toBe('key=[REDACTED]; done');
    expect(out.stats?.findings).toBe(1);
  });

  it('supports generic assignment length threshold', () => {
    expect(run('api_key="short"').stats?.findings).toBe(0);
    expect(run('api_key="1234567890"', { minLength: 8 }).stats?.findings).toBe(1);
    expect(() => run('text', { minLength: 7 })).toThrow(ToolError);
  });

  it('reports correct line and Unicode-aware column positions', () => {
    const out = run('😀 note\n  password="123456789abc"');
    const parsed = JSON.parse(out.output) as { rows: string[][] };
    expect(parsed.rows).toEqual([['Secret-like assignment', '2', '13', '12…bc (12 chars)']]);
  });

  it('detects PEM headers without including key material in reports', () => {
    const input = '-----BEGIN PRIVATE KEY-----\nnot-a-real-key\n-----END PRIVATE KEY-----';
    const report = run(input);
    expect(report.stats?.findings).toBe(1);
    expect(report.output).toContain('[private key material]');
    expect(report.output).not.toContain('not-a-real-key');
    expect(run(input, { operation: 'redact' }).output).toContain('[REDACTED]');
  });

  it('handles empty input and rejects an unknown operation', () => {
    expect(run('').stats?.findings).toBe(0);
    expect(() => run('text', { operation: 'other' })).toThrow(/operation/i);
  });
});
