import { describe, expect, it } from 'vitest';
import tool from './glob-tester.tool';

type Result = { output: string; render?: string; stats?: Record<string, number>; notes?: string[] };
type Table = { headers: string[]; rows: string[][] };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;
const table = (r: Result): Table => JSON.parse(r.output) as Table;
const matched = (r: Result): string[] =>
  table(r)
    .rows.filter((x) => x[1] === '✓')
    .map((x) => x[0]!);

describe('glob-tester', () => {
  it('matches recursively with ** and anchors to the segment', async () => {
    const r = await run('src/index.ts\nsrc/lib/util.ts\ntests/app.test.ts\nREADME.md', {
      pattern: 'src/**/*.ts',
    });
    expect(matched(r)).toEqual(['src/index.ts', 'src/lib/util.ts']);
    expect(r.stats?.matched).toBe(2);
    expect(r.stats?.total).toBe(4);
  });

  it('matches ** at any depth including root', async () => {
    const r = await run('a.ts\nsrc/a.ts\nsrc/x/y/z.ts\nb.txt', { pattern: '**/*.ts' });
    expect(matched(r)).toEqual(['a.ts', 'src/a.ts', 'src/x/y/z.ts']);
  });

  it('handles brace alternation', async () => {
    const r = await run('a.ts\nb.js\nc.txt\nx/d.ts', { pattern: '**/*.{ts,js}' });
    expect(matched(r)).toEqual(['a.ts', 'b.js', 'x/d.ts']);
  });

  it('handles single-char ? and character classes', async () => {
    const r = await run('a/b.txt\na/bb.txt\nf1.log\nf9.log\nfa.log', { pattern: '**/?[0-9].log' });
    expect(matched(r)).toEqual(['f1.log', 'f9.log']);
  });

  it('flags asterisk not crossing segments', async () => {
    const r = await run('a/b.txt\nab.txt', { pattern: '*.txt' });
    expect(matched(r)).toEqual(['ab.txt']);
  });

  it('is case-insensitive by default and honors the caseSensitive option', async () => {
    const loose = await run('src/App.tsx\nsrc/app.tsx', { pattern: 'src/app.tsx' });
    expect(matched(loose)).toEqual(['src/App.tsx', 'src/app.tsx']);
    const strict = await run('src/App.tsx\nsrc/app.tsx', {
      pattern: 'src/app.tsx',
      caseSensitive: true,
    });
    expect(matched(strict)).toEqual(['src/app.tsx']);
  });

  it('applies case sensitivity to literals inside brace alternation', async () => {
    const paths = 'src/App.tsx\nsrc/app.tsx';
    const loose = await run(paths, { pattern: 'src/{App,Other}.tsx' });
    expect(matched(loose)).toEqual(['src/App.tsx', 'src/app.tsx']);
    const strict = await run(paths, { pattern: 'src/{App,Other}.tsx', caseSensitive: true });
    expect(matched(strict)).toEqual(['src/App.tsx']);
  });

  it('normalizes leading ./ and / prefixes', async () => {
    const r = await run('./a/b.txt\n/c.txt\nb.txt', { pattern: 'a/**' });
    expect(matched(r)).toEqual(['a/b.txt']);
  });

  it('errors on missing pattern and empty paths', async () => {
    await expect(run('a.ts', { pattern: '' })).rejects.toThrow(/pattern/i);
    await expect(run('', { pattern: '*.ts' })).rejects.toThrow(/one file path/i);
  });

  it('reports stats and notes', async () => {
    const r = await run('a.ts\nb.txt', { pattern: '*.ts' });
    expect(r.notes?.join(' ')).toMatch(/1 of 2/);
  });

  it('expands a brace empty alternative to the bare prefix', async () => {
    const r = await run('x/readme.ts\nx/readme.\nx/readme\nx/a.txt', { pattern: 'x/*.{ts,}' });
    expect(matched(r)).toEqual(['x/readme.ts', 'x/readme.']);
  });
});
