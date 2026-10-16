import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './text-inspector.tool';

type Result = { output: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const report = (result: Result) => JSON.parse(result.output) as { rows: string[][] };

describe('text-inspector', () => {
  it('finds zero-width, non-breaking and combining characters with code-point positions', () => {
    const result = run('a\u00a0😀e\u0301\u200b');
    expect(report(result).rows).toEqual([
      ['1', '2', 'U+00A0', 'Unusual space', 'Unusual space', '" "'],
      ['1', '5', 'U+0301', 'Combining mark', 'Combining mark', '"́"'],
      ['1', '6', 'U+200B', 'Format / invisible', 'zero-width space', '"​"'],
    ]);
    expect(result.stats?.['Code points']).toBe('6');
  });

  it('reports BOM in summary and does not duplicate it in findings', () => {
    const result = run('\ufeffHello');
    expect(result.stats?.['Leading BOM']).toContain('present');
    expect(report(result).rows).toEqual([]);
  });

  it('counts mixed line endings and resets character columns', () => {
    const result = run('one\r\ntwo\nthree\rfour\u200b');
    expect(result.stats).toMatchObject({
      'CRLF line endings': '1',
      'LF line endings': '1',
      'CR line endings': '1',
      'Line-ending style': 'Mixed (CRLF, LF, CR)',
    });
    expect(report(result).rows[0]?.slice(0, 3)).toEqual(['4', '5', 'U+200B']);
  });

  it('can list every non-ASCII character while leaving ASCII whitespace out', () => {
    const result = run('A é\nB', { showAllNonAscii: true });
    expect(report(result).rows).toEqual([['1', '3', 'U+00E9', 'Non-ASCII', 'é', '"é"']]);
  });

  it('caps displayed rows but preserves total findings and summary', () => {
    const result = run('\u200b'.repeat(15), { maxFindings: 10 });
    expect(report(result).rows).toHaveLength(10);
    expect(result.stats?.['Reported character findings']).toBe('15');
    expect(result.notes?.some((note) => note.includes('5 more'))).toBe(true);
  });

  it('handles empty text and validates option bounds', () => {
    expect(run('').stats?.['Code points']).toBe('0');
    expect(() => run('x', { maxFindings: 9 })).toThrow(ToolError);
    expect(() => run('x', { maxFindings: 10.5 })).toThrow(ToolError);
  });
});
