import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './link-header.tool';

type Result = {
  output: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('link-header', () => {
  it('builds a preload Link header with parameters', () => {
    const result = run('', {
      mode: 'build',
      uri: '/fonts/app.woff2',
      relation: 'preload',
      as: 'font',
      type: 'font/woff2',
      crossorigin: 'anonymous',
    });
    expect(result.output).toBe(
      '</fonts/app.woff2>; rel="preload"; as="font"; type="font/woff2"; crossorigin="anonymous"',
    );
    expect(result.filename).toBe('link-header.txt');
  });

  it('parses comma-separated links without splitting quoted values', () => {
    const result = run(
      '<https://example.com>; rel="canonical", </next>; rel="next"; title="Next, page"',
    );
    expect(result.stats).toMatchObject({ links: 2, invalid: 0, review: 0 });
    expect(rows(result)).toContainEqual(['https://example.com', 'rel', 'canonical', '']);
    expect(rows(result)).toContainEqual(['/next', 'title', 'Next, page', '']);
  });

  it('flags missing and duplicate relation tokens', () => {
    const result = run('</asset>; rel="preload preload"\n</other>; as="script"');
    expect(result.stats?.review).toBe(2);
    expect(rows(result)[0]?.[3]).toContain('Duplicate relation token');
    expect(rows(result).some((row) => row[3]?.includes('Missing rel'))).toBe(true);
  });

  it('handles malformed values and invalid generated options', () => {
    const result = run('not a link');
    expect(result.stats?.invalid).toBe(1);
    expect(() => run('', { mode: 'build', uri: '<bad>' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', relation: 'bad relation' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', crossorigin: 'bad' })).toThrow(ToolError);
  });

  it('rejects unsafe type and as parameters', () => {
    expect(() => run('', { mode: 'build', as: 'script;bad' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', type: 'text/html;bad' })).toThrow(ToolError);
  });

  it('returns guidance for blank parsing input', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });
});
