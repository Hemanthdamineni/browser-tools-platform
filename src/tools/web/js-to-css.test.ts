import { describe, expect, it } from 'vitest';
import tool from './js-to-css.tool';

type Result = { output: string; stats?: Record<string, number>; notes?: string[] };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('js-to-css', () => {
  it('converts camelCase to kebab-case and numbers to px', async () => {
    const r = await run('{ color: "#fff", fontSize: 12 }');
    expect(r.output).toContain('color: #fff;');
    expect(r.output).toContain('font-size: 12px;');
  });

  it('keeps unitless properties bare', async () => {
    const r = await run('{ opacity: 0.5, lineHeight: 1.4, zIndex: 10 }');
    expect(r.output).toContain('opacity: 0.5;');
    expect(r.output).toContain('line-height: 1.4;');
    expect(r.output).toContain('z-index: 10;');
  });

  it('handles vendor-prefixed camelCase keys', async () => {
    const r = await run('{ WebkitTransform: "scale(1)" }');
    expect(r.output).toContain('-webkit-transform: scale(1);');
  });

  it('converts nested objects to rules', async () => {
    const r = await run('{ "a:hover": { color: "red" }, ".btn": { padding: 0 } }');
    expect(r.output).toContain('a:hover {');
    expect(r.output).toContain('color: red;');
    expect(r.output).toContain('.btn {');
    expect(r.output).toContain('padding: 0;');
  });

  it('drops booleans and null values', async () => {
    const r = await run('{ display: false, margin: null, color: "red" }');
    expect(r.output).not.toContain('display');
    expect(r.output).toContain('color: red;');
    expect((r.notes ?? []).join(' ')).toMatch(/[Dd]ropped/);
  });

  it('parses quoted keys and single quotes', async () => {
    const r = await run("{ 'font-family': 'Arial' }");
    expect(r.output).toContain('font-family: Arial;');
  });

  it('rejects non-object, unbalanced and missing input', async () => {
    await expect(run('42')).rejects.toThrow(/object/i);
    await expect(run('{ color: "red" ')).rejects.toThrow(/balanced/i);
    await expect(run('   ')).rejects.toThrow(/paste a js style object/i);
  });
});
