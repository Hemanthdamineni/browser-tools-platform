import { describe, it, expect } from 'vitest';
import tool from './objectid.tool';
import { ToolError } from '@/lib/types';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as {
    output: string;
    render?: string;
    stats?: Record<string, string | number>;
  };

function fields(text: string, options: Record<string, string | number | boolean> = {}) {
  const parsed = JSON.parse(run(text, options).output) as { headers: string[]; rows: string[][] };
  const map: Record<string, string> = {};
  for (const [k, v] of parsed.rows) map[k!] = v!;
  return map;
}

describe('objectid', () => {
  it('decodes the classic 507f1f77bcf86cd799439011', () => {
    const f = fields('507f1f77bcf86cd799439011');
    expect(f['Timestamp (ISO UTC)']).toBe('2012-10-17T21:13:27.000Z');
    expect(f['Unix time (seconds)']).toBe('1350508407');
    expect(f['Random value (5 bytes)']).toBe('bcf86cd799');
    expect(f['Counter (3 bytes, hex)']).toBe('439011');
    expect(f['Counter (decimal)']).toBe('4427793');
  });

  it('accepts uppercase and trims whitespace', () => {
    const f = fields('  507F1F77BCF86CD799439011  ');
    expect(f['Unix time (seconds)']).toBe('1350508407');
  });

  it('throws on the wrong length', () => {
    expect(() => run('xyz')).toThrow(ToolError);
    expect(() => run('507f1f77bcf86cd79943901')).toThrow(/24 hex/i);
  });

  it('throws on non-hex characters', () => {
    expect(() => run('507f1f77bcf86cd79943901g')).toThrow(/0-9 and a-f/i);
  });

  it('empty input in decode mode → empty output', () => {
    expect(run('').output).toBe('');
    expect(run('   ').output).toBe('');
  });

  it('generates a structurally valid ObjectId', () => {
    const r = run('', { mode: 'generate' });
    expect(r.output).toMatch(/^[0-9a-f]{24}$/);
    expect(r.render).toBe('code');
    const secs = parseInt(r.output.slice(0, 8), 16);
    const nowSecs = Math.floor(Date.now() / 1000);
    expect(Math.abs(nowSecs - secs)).toBeLessThan(5);
  });

  it('generates a different id each call', () => {
    const a = run('', { mode: 'generate' }).output;
    const b = run('', { mode: 'generate' }).output;
    expect(a).not.toBe(b);
  });

  it('round-trips: a generated id decodes cleanly', () => {
    const id = run('', { mode: 'generate' }).output;
    const f = fields(id, { mode: 'decode' });
    expect(f['Random value (5 bytes)']).toMatch(/^[0-9a-f]{10}$/);
    expect(Number(f['Unix time (seconds)'])).toBeGreaterThan(1_700_000_000);
  });
});
