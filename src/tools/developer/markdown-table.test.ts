import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './markdown-table.tool';

type Result = { output: string; stats?: Record<string, string | number> };
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;

describe('markdown-table', () => {
  it('aligns cells and preserves parsed right alignment', () => {
    const result = run('| Name | Count |\n|---|---:|\n| pears | 3 |\n| apple | 120 |');
    expect(result.output).toBe(
      '| Name  | Count |\n| :----- | -----: |\n| pears | 3     |\n| apple | 120   |',
    );
    expect(result.stats).toMatchObject({ rows: 3, columns: 2 });
  });

  it('keeps escaped pipes and inline-code pipes in their original cells', () => {
    const out = run('| Expression | Note |\n|---|---|\n| `a|b` | escaped \\| stays |').output;
    expect(out).toContain('`a|b`');
    expect(out).toContain('escaped \\| stays');
  });

  it('pads ragged rows and expands for rows wider than the header', () => {
    const out = run('A | B\n--- | ---\nx\ny | z | extra').output;
    expect(out.split('\n')).toHaveLength(4);
    expect(out).toContain('extra');
    expect(out.split('\n')[0]).toContain('A ');
  });

  it('preserves alignment when disabling column alignment', () => {
    const out = run('| a | b |\n|:---|---:|\n| x | y |', { align: false }).output;
    expect(out).toBe('| a | b |\n| :--- | ---: |\n| x | y |');
  });

  it('supports zero cell padding and Unicode display content', () => {
    const out = run('| 値 | x |\n|---|---|\n| emoji 👋 | z |', { padding: 0 }).output;
    expect(out.split('\n')[0]).toContain('|値');
    expect(out).toContain('emoji 👋');
  });

  it('returns empty for blank input and validates size/options', () => {
    expect(run(' \n ').output).toBe('');
    expect(() => run('| a |\n|---|', { padding: 5 })).toThrow(ToolError);
    expect(() => run(`|${Array(201).fill('x').join('|')}|`)).toThrow(ToolError);
    expect(() => run(Array(5001).fill('| x |').join('\n'))).toThrow(ToolError);
  });
});
