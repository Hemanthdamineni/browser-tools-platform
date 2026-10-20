import { describe, expect, it } from 'vitest';
import tool from './csv-to-yaml.tool';

type Result = { output: string; language?: string; stats?: Record<string, number> };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('csv-to-yaml', () => {
  it('converts a simple numeric-laden table', async () => {
    const r = await run('name,price,stock,live\nTea,12.5,3,true\nCoffee,8,0,false');
    expect(r.output).toContain('- name: Tea');
    expect(r.output).toContain('  price: 12.5');
    expect(r.output).toContain('  stock: 3');
    expect(r.output).toContain('  live: true');
    expect(r.output).toContain('  price: 8');
    expect(r.language).toBe('yaml');
    expect(r.stats?.records).toBe(2);
  });

  it('quotes header keys and strips ambiguity, keeps quoted cells strings', async () => {
    const r = await run('"key",value\nalpha,1\nbeta,"12.5"');
    expect(r.output).toContain('- key: alpha');
    expect(r.output).toContain('  value: "12.5"');
    expect(r.output).toContain('  value: 1');
  });

  it('emits null for empty and quoted-empty cells', async () => {
    const r = await run('a,b\na,\n2,""');
    expect(r.output).toContain('- a: a');
    expect(r.output).toContain('  b: null');
    expect(r.output).toContain('- a: 2');
    expect(r.output).toContain('  b: ""');
  });

  it('quotes words that YAML would misread', async () => {
    const r = await run('n\nyes\n1.5\n#x\n"a: b"');
    expect(r.output).toContain('- n: "yes"');
    expect(r.output).toContain('- n: 1.5');
    expect(r.output).toContain('- n: "#x"');
    expect(r.output).toContain('- n: "a: b"');
  });

  it('handles quoted commas and newlines via RFC 4180', async () => {
    const r = await run('quote,note\n"He said ""hi"", ok","line1\nline2"');
    expect(r.output).toContain('quote: "He said \\"hi\\", ok"');
    expect(r.output).toContain('note: "line1\\nline2"');
  });

  it('produces numbered keys when the header is off', async () => {
    const r = await run('a,b\nc,d', { header: false });
    expect(r.output).toContain('- column_1: a');
    expect(r.output).toContain('  column_2: b');
    expect(r.output).toContain('- column_1: c');
    expect(r.output).toContain('  column_2: d');
  });

  it('deduplicates blank and duplicate headers', async () => {
    const r = await run('name,,name\na,b,c');
    expect(r.output).toContain('name: a');
    expect(r.output).toContain('column_2: b');
    expect(r.output).toContain('name_2: c');
  });

  it('detects delimiter and rejects empty input', async () => {
    const r = await run('a;b\n1;2', { delimiter: ';' });
    expect(r.output).toContain('- a: 1');
    expect(r.output).toContain('  b: 2');
    await expect(run('   ')).rejects.toThrow(/csv/i);
  });

  it('rejects header-only CSV', async () => {
    await expect(run('name,age')).rejects.toThrow(/data rows/i);
  });
});
