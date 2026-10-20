import { describe, expect, it } from 'vitest';
import tool from './ascii-table.tool';

type Result = { output: string; render?: string; language?: string; stats?: Record<string, number>; notes?: string[] };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('ascii-table', () => {
  it('renders a bordered grid with a header divider', async () => {
    const r = await run('name,role\nAda,Analyst\nGrace,Engineer');
    expect(r.output).toContain('+-------+----------+');
    expect(r.output).toMatch(/name\s*\| role/);
    expect(r.output).toMatch(/Ada\s*\| Analyst/);
    expect(r.output).toMatch(/Grace\s*\| Engineer/);
    expect(r.stats?.rows).toBe(3);
    expect(r.stats?.columns).toBe(2);
  });

  it('auto-detects tab and semicolon delimiters', async () => {
    const t = await run('a\tb\n1\t2');
    expect(t.output).toContain('a');
    expect(t.output).toMatch(/1\s*\| 2/);
    const s = await run('a;b\n3;4');
    expect(s.output).toMatch(/3\s*\| 4/);
  });

  it('parses quoted fields with embedded delimiters and newlines', async () => {
    const r = await run('name,note\nAda,"a, nice\nperson"');
    expect(r.output).toContain('a, nice');
    expect(r.output).toContain('person');
  });

  it('respects alignment choices', async () => {
    const right = await run('a,b\n1,22\n333,4', { align: 'right', header: false });
    const line = right.output.split('\n').find((l) => l.includes('1'))!;
    expect(line.indexOf('1')).toBeGreaterThan(0);
  });

  it('supports disabling the header divider', async () => {
    const r = await run('a,b\n1,2', { header: false });
    const divCount = (r.output.match(/^\+/gm) ?? []).length;
    expect(divCount).toBe(2);
  });

  it('ragged rows are padded to the widest row', async () => {
    const r = await run('a,b,c\n1,2');
    expect(r.stats?.columns).toBe(3);
    expect(r.output).toContain('| 1 | 2 |   |');
  });

  it('rejects empty input', async () => {
    await expect(run('   ')).rejects.toThrow(/paste csv/i);
  });
});
