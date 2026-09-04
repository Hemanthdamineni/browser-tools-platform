import { describe, it, expect } from 'vitest';
import tool from './url-parse.tool';
import { ToolError } from '@/lib/types';

interface Res {
  output: string;
  stats?: Record<string, string | number>;
}
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Res;
const table = (r: Res) => JSON.parse(r.output) as { rows: string[][] };

describe('url-parse', () => {
  it('splits an absolute URL with credentials, port, params and hash', () => {
    const t = table(run('https://a:b@ex.com:8443/p/q?x=1&x=2&y=hi#frag'));
    expect(t.rows).toContainEqual(['protocol', 'https:']);
    expect(t.rows).toContainEqual(['port', '8443']);
    expect(t.rows).toContainEqual(['origin', 'https://ex.com:8443']);
    expect(t.rows).toContainEqual(['query: x', '1']);
    expect(t.rows).toContainEqual(['query: x', '2']);
    expect(t.rows).toContainEqual(['hash', '#frag']);
  });

  it('resolves a relative URL against the base option', () => {
    const t = table(run('/a/b', { base: 'https://ex.com' }));
    expect(t.rows).toContainEqual(['href', 'https://ex.com/a/b']);
  });

  it('counts query parameters including repeats', () => {
    const r = run('https://ex.com/?x=1&x=2&y=hi');
    expect(r.stats!.params).toBe(3);
  });

  it('decodes percent-escapes in the decoded pathname row', () => {
    const t = table(run('https://ex.com/hello%20world'));
    expect(t.rows).toContainEqual(['pathname (decoded)', '/hello world']);
  });

  it('throws ToolError on invalid input', () => {
    expect(() => run('not a url')).toThrow(ToolError);
    expect(() => run('not a url')).toThrow(/valid URL/);
  });

  it('empty input gives empty output', () => {
    expect(run('').output).toBe('');
    expect(run('   ').output).toBe('');
  });
});
