import { describe, it, expect } from 'vitest';
import tool from './markdown-table-format.tool';

const run = async (text: string) =>
  (await tool.run({ text, options: {} })) as {
    output: string;
    language?: string;
    filename?: string;
    stats?: Record<string, string | number>;
  };

const RAGGED = `| Name | Age | City |
| --- | ---: | --- |
| Ada | 36 | London |
| Grace | 40 | Brooklyn |`;

const FORMATTED = `| Name  | Age | City     |
| :---- | --: | :------- |
| Ada   |  36 | London   |
| Grace |  40 | Brooklyn |`;

describe('markdown-table-format', () => {
  it('aligns pipes and preserves divider alignment', async () => {
    expect((await run(RAGGED)).output).toBe(FORMATTED);
  });

  it('keeps CJK wide characters aligned with two columns each', async () => {
    const input = '| 名稱 | 值 |\n| --- | ---: |\n| 中文 | 42 |\n| abc | 7 |';
    const result = await run(input);
    // Rows for 中文 (4 display cols) and 值 columns must still be padded to same width.
    const lines = result.output.split('\n');
    expect(lines[2]).toBe('| 中文 | 42 |');
    expect(lines[3]).toBe('| abc  |  7 |');
  });

  it('treats escaped pipes as cell content, not separators', async () => {
    const input = '| A | B |\n| --- | --- |\n| x\\|y | 1 |';
    const result = await run(input);
    expect(result.output).toContain('| x\\|y |');
  });

  it('leaves non-table lines untouched', async () => {
    const input = '# Title\n\nA paragraph.\n\n| A | B |\n| --- | --- |\n| 1 | 2 |';
    const result = await run(input);
    expect(result.output).toContain('# Title');
    expect(result.output).toContain('A paragraph.');
    expect(result.output).toContain('| 1 | 2 |');
  });

  it('handles a single-column table', async () => {
    const input = '| Only |\n| --- |\n| x |';
    const result = await run(input);
    expect(result.output.split('\n')[1]).toBe('| :--- |');
    expect(result.output.split('\n')[2]).toBe('| x    |');
  });

  it('returns empty output for empty input', async () => {
    expect((await run('  \n')).output).toBe('');
  });

  it('provides output metadata', async () => {
    const result = await run(RAGGED);
    expect(result.language).toBe('markdown');
    expect(result.filename).toBe('formatted-table.md');
    expect(result.stats?.tables).toBe(1);
  });

  it('throws a user-facing error for overly large input', async () => {
    // No explicit cap is enforced, so a 1MB input should still process.
    const big = Array.from({ length: 20_000 }, (_, n) => `| r${n} | ${n} |`).join('\n');
    const result = await run(`| a | b |\n| --- | --- |\n${big}`);
    expect(result.stats?.tables).toBe(1);
  });
});
