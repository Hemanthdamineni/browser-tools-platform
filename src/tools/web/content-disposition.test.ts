import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './content-disposition.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('content-disposition', () => {
  it('builds ASCII and RFC 5987 Unicode filename parameters', () => {
    const result = run('', { mode: 'build', disposition: 'attachment', filename: 'résumé 2025.pdf' });
    expect(result.output).toContain('attachment; filename="resume 2025.pdf"; filename*=UTF-8\'\'r%C3%A9sum%C3%A9%202025.pdf');
    expect(result.stats?.['unicode filename']).toBe('yes');
  });

  it('builds inline headers and safely quotes punctuation', () => {
    const result = run('', { mode: 'build', disposition: 'inline', filename: 'report "final".pdf' });
    expect(result.output).toContain('inline; filename="report _final_.pdf"');
    expect(result.filename).toBe('content-disposition.txt');
  });

  it('parses disposition type, quoted filename and filename*', () => {
    const result = run('attachment; filename="report.pdf"; filename*=UTF-8\'\'report%20final.pdf');
    expect(rows(result)).toContainEqual(['attachment', 'filename', 'report.pdf', '']);
    expect(rows(result)).toContainEqual(['attachment', 'filename*', "UTF-8''report%20final.pdf", '']);
  });

  it('handles multiple headers and invalid lines', () => {
    const result = run('inline; filename=x.html\nbad header\nattachment; filename="a.txt"');
    expect(result.stats).toMatchObject({ headers: 3, invalid: 1 });
    expect(rows(result).some((row) => row[0] === 'Line 2' && row[3] === 'Invalid header')).toBe(true);
  });

  it('rejects unsafe generated input', () => {
    expect(() => run('', { mode: 'build', filename: '' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', filename: 'bad\nname.txt' })).toThrow(ToolError);
    expect(() => run('', { mode: 'build', disposition: 'form-data' })).toThrow(ToolError);
  });

  it('returns guidance for blank parsing input', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });
});
