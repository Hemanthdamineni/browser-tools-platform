import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './web-manifest.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const parse = (result: Result) => JSON.parse(result.output) as Record<string, unknown>;

describe('web-manifest', () => {
  it('validates a well-formed manifest with recommended icons', () => {
    const result = run(JSON.stringify({
      name: 'Notes', short_name: 'Notes', start_url: '/', display: 'standalone',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    }));
    expect(result.stats).toMatchObject({ errors: 0, recommendations: 0 });
  });

  it('returns recommendations for a minimal manifest without calling it invalid JSON', () => {
    const result = run('{"name":"Notes"}');
    expect(result.stats?.errors).toBe(0);
    expect(Number(result.stats?.recommendations)).toBeGreaterThan(0);
    expect(result.notes?.join(' ')).toContain('start_url');
  });

  it('detects root type and invalid field types/display values', () => {
    const root = run('[]');
    expect(root.stats?.errors).toBe(1);
    const result = run('{"name":5,"start_url":false,"display":"tabbed"}');
    expect(Number(result.stats?.errors)).toBeGreaterThanOrEqual(3);
  });

  it('checks icon shape, required fields, dimensions, and purpose', () => {
    const result = run(JSON.stringify({
      name: 'App', short_name: 'App', start_url: '/',
      icons: [{ src: '/icon.png', sizes: 'any', type: 'image/png', purpose: 'invalid' }],
    }));
    expect(result.stats?.errors).toBe(1);
    expect(result.notes?.join(' ')).toContain('192x192');
    expect(result.notes?.join(' ')).toContain('512x512');
  });

  it('generates normalized JSON and preserves quotes safely', () => {
    const result = run('', { mode: 'generate', name: 'Notes "Plus"', shortName: 'Notes', startUrl: '/app/', scope: '/app/' });
    expect(parse(result)).toMatchObject({ name: 'Notes "Plus"', short_name: 'Notes', start_url: '/app/', scope: '/app/', display: 'standalone' });
    expect(result.filename).toBe('site.webmanifest');
  });

  it('rejects malformed JSON, unsupported modes, and missing generated fields', () => {
    expect(() => run('{bad')).toThrow(/valid JSON/i);
    expect(() => run('', { mode: 'generate', name: '', shortName: 'App' })).toThrow(ToolError);
    expect(() => run('', { mode: 'generate', display: 'tabbed' })).toThrow(ToolError);
    expect(() => run('{}', { mode: 'other' })).toThrow(ToolError);
  });
});
