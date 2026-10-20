import { describe, expect, it } from 'vitest';
import tool from './css-to-js.tool';

type Result = { output: string; stats?: Record<string, number>; notes?: string[] };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('css-to-js', () => {
  it('converts a declaration list to a flat object with camelCase keys', async () => {
    const r = await run('color: red;\nfont-size: 12px;\nbackground-color: #fff;');
    expect(r.output).toContain('color: "red"');
    expect(r.output).toContain('fontSize: "12px"');
    expect(r.output).toContain('backgroundColor: "#fff"');
    expect(r.stats?.properties).toBe(3);
  });

  it('keeps-kebab when camelCase is off', async () => {
    const r = await run('font-size: 12px;', { camelCase: false });
    expect(r.output).toContain('"font-size": "12px"');
  });

  it('converts rule blocks to nested selector objects', async () => {
    const r = await run('a:hover { color: red; text-decoration: none; }');
    expect(r.output).toContain('"a:hover":');
    expect(r.output).toContain('color: "red"');
    expect(r.output).toContain('textDecoration: "none"');
    expect(r.stats?.rules).toBe(1);
  });

  it('handles vendor prefixes and custom properties', async () => {
    const r = await run('-webkit-transform: scale(1); --accent: red;');
    expect(r.output).toContain('WebkitTransform: "scale(1)"');
    expect(r.output).toContain('"--accent": "red"');
  });

  it('strips comments and ignores stray text without a colon', async () => {
    const r = await run('/* c */ color: red; just-some-text-here; margin: 0;');
    expect(r.output).not.toContain('/*');
    expect(r.output).not.toContain('just-some-text-here');
    expect(r.output).toContain('margin: "0"');
  });

  it('escapes quotes in values', async () => {
    const r = await run('content: "hi there";');
    expect(r.output).toContain('content: "\\"hi there\\""');
    expect(r.output.startsWith('{')).toBe(true);
    expect(r.output.endsWith('}')).toBe(true);
  });

  it('rejects unbalanced braces and empty input', async () => {
    await expect(run('div { color: red')).rejects.toThrow(/balanced/i);
    await expect(run('   ')).rejects.toThrow(/paste some css/i);
  });
});
