import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './csv-sanitize.tool';

type Output = { output: string; render?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Output;

describe('csv-sanitize', () => {
  it('prefixes formula-trigger cells and leaves ordinary values alone', () => {
    const out = run('name,value\nAda,=1+1\nLinus,-1\nTuring,@SUM(A1:A2)');
    expect(out.output).toBe("name,value\r\nAda,'=1+1\r\nLinus,'-1\r\nTuring,'@SUM(A1:A2)");
    expect(out.stats).toMatchObject({ 'risky cells': 3, 'cells protected': 3 });
  });

  it('parses quoted delimiters, escaped quotes, and newlines', () => {
    const input = 'name,note\r\nAda,"line 1, line 2"\r\nLinus,"say ""hi"""\r\nGrace,"=SUM(\nA1:A2)"';
    const out = run(input);
    expect(out.output).toBe('name,note\r\nAda,"line 1, line 2"\r\nLinus,"say ""hi"""\r\nGrace,"\'=SUM(\nA1:A2)"');
    expect(out.stats?.rows).toBe(4);
  });

  it('supports alternate delimiters', () => {
    expect(run('x;y\n=1;ok', { delimiter: 'semicolon' }).output).toBe("x;y\r\n'=1;ok");
    expect(run('x\tvalue\n1\t+2', { delimiter: 'tab' }).output).toBe("x\tvalue\r\n1\t'+2");
  });

  it('detects after leading whitespace by default and can disable that behavior', () => {
    expect(run('"  =1+1"').output).toBe('"\'  =1+1"');
    expect(run('"  =1+1"', { trimLeadingWhitespace: false }).output).toBe('"  =1+1"');
  });

  it('reports risky coordinates without changing input', () => {
    const out = run('safe,=1\n+2,plain', { mode: 'report' });
    expect(out.render).toBe('table');
    expect(JSON.parse(out.output)).toEqual({
      headers: ['Row', 'Column', 'Cell value'],
      rows: [['1', '2', '=1'], ['2', '1', '+2']],
    });
    expect(out.stats?.['risky cells']).toBe(2);
  });

  it('returns an empty result for empty input and a useful clean report', () => {
    expect(run('').output).toBe('');
    const report = run('name,value\nAda,ok', { mode: 'report' });
    expect(JSON.parse(report.output)).toEqual({ headers: ['Row', 'Column', 'Cell value'], rows: [] });
    expect(report.notes).toContain('No formula-leading cells detected.');
  });

  it('rejects malformed CSV rather than corrupting fields', () => {
    expect(() => run('a,"not closed')).toThrow(ToolError);
    expect(() => run('a,b"c')).toThrow(/quote inside an unquoted/i);
    expect(() => run('a,"closed"x')).toThrow(/after a closing/i);
    expect(() => run('a,b', { delimiter: 'bad' })).toThrow(/delimiter/i);
    expect(() => run('a,b', { mode: 'bad' })).toThrow(/action/i);
  });
});
