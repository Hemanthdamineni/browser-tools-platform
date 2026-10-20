import { describe, expect, it } from 'vitest';
import tool from './jsdoc-generator.tool';

type Result = { output: string; stats?: Record<string, number>; notes?: string[] };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('jsdoc-generator', () => {
  it('builds a block from a function declaration with params', async () => {
    const r = await run('function calculateTotal(items, taxRate = 0.2) {}');
    expect(r.output).toContain('@param items - ');
    expect(r.output).toContain('@param taxRate - ');
    expect(r.output).toContain('@returns ');
    expect(r.output).toContain('calculateTotal');
    expect(r.stats?.parameters).toBe(2);
  });

  it('handles async, rest and destructured params', async () => {
    const r = await run('async function fetchUser(id, ...opts) {}');
    expect(r.output).toContain('@param id');
    expect(r.output).toContain('@param opts - ');
    const d = await run('function save({ name, age }, id = 1) {}');
    expect(d.output).toContain('@param name - ');
    expect(d.output).toContain('@param id - ');
    expect((d.notes ?? []).join(' ')).toMatch(/[Dd]estructured/);
  });

  it('parses arrow const signatures and name shorthand skipping description option', async () => {
    const r = await run('const show = (msg) => console.log(msg)');
    expect(r.output).toContain('msg');
    const noDesc = await run('greet(name)');
    expect(noDesc.output).toContain('@param name');
    const r2 = await run('greet(name)', { description: false });
    expect(r2.output).not.toContain('Describe');
  });

  it('rejects junk and empty input', async () => {
    await expect(run('just some text without parens')).rejects.toThrow(/function signature/i);
    await expect(run('   ')).rejects.toThrow(/paste a function signature/i);
  });
});
