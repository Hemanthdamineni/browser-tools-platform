import { describe, it, expect } from 'vitest';
import tool from './data-uri.tool';
import { ToolError } from '@/lib/types';

const run = (text = '', options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options });

describe('data-uri', () => {
  it('encodes SVG with charset and base64 by default', () => {
    const r = run('<svg/>', { mode: 'encode', mimeType: 'image/svg+xml' });
    expect(r.output.startsWith('data:image/svg+xml;charset=utf-8;base64,')).toBe(true);
  });

  it('round-trips text through base64', () => {
    const uri = run('héllo wörld', { mode: 'encode', charset: false }).output;
    const back = run(uri, { mode: 'decode' }).output;
    expect(back).toBe('héllo wörld');
  });

  it('decodes percent-encoded payloads without base64', () => {
    const r = run('data:text/plain,hello%20world', { mode: 'decode' });
    expect(r.output).toBe('hello world');
  });

  it('uses percent-encoding when selected', () => {
    const r = run('a b&c', { mode: 'encode', encoding: 'url' });
    expect(r.output).toBe(`data:text/plain;charset=utf-8,${encodeURIComponent('a b&c')}`);
  });

  it('notes binary payloads', () => {
    const r = run('data:application/octet-stream;base64,QUJD', { mode: 'decode' });
    expect(r.notes?.[0]).toMatch(/binary payload, 3 bytes/);
  });

  it('reports mime and encoding stats when decoding', () => {
    const r = run('data:text/plain,hi', { mode: 'decode' });
    expect(r.stats!['MIME type']).toBe('text/plain');
    expect(r.stats!.Encoding).toBe('percent');
  });

  it('throws ToolError on non-data input in decode mode', () => {
    expect(() => run('http://example.com', { mode: 'decode' })).toThrow(ToolError);
    expect(() => run('http://example.com', { mode: 'decode' })).toThrow(/Not a data: URI/);
  });

  it('empty input gives empty output in both modes', () => {
    expect(run('', { mode: 'encode' }).output).toBe('');
    expect(run('', { mode: 'decode' }).output).toBe('');
  });
});
