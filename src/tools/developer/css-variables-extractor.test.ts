import { describe, expect, it } from 'vitest';
import tool from './css-variables-extractor.tool';

type Result = {
  output: string;
  render?: string;
  language?: string;
  stats?: Record<string, number>;
  notes?: string[];
};
interface Table {
  headers: string[];
  rows: string[][];
}
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;
const table = (r: Result): Table => JSON.parse(r.output) as Table;

describe('css-variables-extractor', () => {
  it('extracts name, value and scope into a table', async () => {
    const r = await run(':root {\n  --brand: #2563eb;\n  --radius: 8px;\n}');
    const t = table(r);
    expect(t.headers).toEqual(['Variable', 'Value', 'Scope']);
    expect(t.rows).toEqual([
      ['--brand', '#2563eb', ':root'],
      ['--radius', '8px', ':root'],
    ]);
  });

  it('reports theme scopes and groups duplicates', async () => {
    const r = await run(':root { --brand: #2563eb; }\n.theme-dark { --brand: #60a5fa; }');
    const t = table(r);
    expect(t.rows).toEqual([
      ['--brand', '#2563eb', ':root'],
      ['--brand', '#60a5fa', '.theme-dark'],
    ]);
    expect(r.stats).toEqual(expect.objectContaining({ variables: 1, declarations: 2 }));
  });

  it('tracks nested at-rule scopes', async () => {
    const r = await run('@media (prefers-color-scheme: dark) {\n  :root { --bg: #000; }\n}');
    expect(table(r).rows[0]).toEqual([
      '--bg',
      '#000',
      '@media (prefers-color-scheme: dark) > :root',
    ]);
  });

  it('ignores comments, strings and non-variable declarations', async () => {
    const css = [
      '/* --fake: red; */',
      ':root {',
      '  color: red;',
      '  --real: "quoted --notavar";',
      '  --nested: var(--real, 10px);',
      '}',
    ].join('\n');
    const t = table(await run(css));
    expect(t.rows.map((r2) => r2[0])).toEqual(['--real', '--nested']);
    expect(t.rows[0]![1]).toBe('"quoted --notavar"');
    expect(t.rows[1]![1]).toBe('var(--real, 10px)');
  });

  it('handles a final declaration without a trailing semicolon', async () => {
    const t = table(await run(':root { --a: 1px; --b: 2px }'));
    expect(t.rows.map((r2) => r2[0])).toEqual(['--a', '--b']);
  });

  it('emits JSON, JavaScript and SCSS forms', async () => {
    const css = ':root { --brand: #2563eb; --radius: 8px; }';
    const json = await run(css, { output: 'json' });
    expect(JSON.parse(json.output)).toEqual({ '--brand': '#2563eb', '--radius': '8px' });
    const js = await run(css, { output: 'js' });
    expect(js.output.startsWith('export const cssVariables = {')).toBe(true);
    const scss = await run(css, { output: 'scss' });
    expect(scss.output).toContain('$brand: #2563eb;');
    expect(scss.output).toContain('$radius: 8px;');
  });

  it('collapses overrides to the last value in SCSS output', async () => {
    const scss = await run(':root { --brand: #111; }\n.dark { --brand: #222; }', {
      output: 'scss',
    });
    expect(scss.output).toContain('$brand: #222;');
  });

  it('rejects empty input and stylesheets without variables', async () => {
    await expect(run('   ')).rejects.toThrow(/paste a stylesheet/i);
    await expect(run(':root { color: red; }')).rejects.toThrow(/no css custom properties/i);
  });
});
