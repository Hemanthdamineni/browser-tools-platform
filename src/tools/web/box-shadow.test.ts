import { describe, it, expect } from 'vitest';
import tool from './box-shadow.tool';

const run = async (text = '', options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })).output;

describe('box-shadow', async () => {
  it('default is a single 0 4 12 0 rgba(0,0,0,0.15) shadow', async () => {
    expect(await run()).toBe('box-shadow: 0px 4px 12px 0px rgba(0,0,0,0.15);');
  });

  it('inset shadows start with "inset "', async () => {
    expect((await run('', { inset: true })).startsWith('box-shadow: inset ')).toBe(true);
  });

  it('three layers produce three shadows with scaled geometry/alpha', async () => {
    const out = await run('', { layers: 3 });
    expect((out.match(/rgba\(/g) ?? []).length).toBe(3);
    expect(out).toContain('0px 1.3333px 4px 0px rgba(0, 0, 0, 0.05)');
    expect(out).toContain('0px 4px 12px 0px rgba(0,0,0,0.15)');
  });

  it('respects offset and spread inputs', async () => {
    expect(await run('', { offsetX: 2, offsetY: 2, blur: 0, spread: 1 })).toBe(
      'box-shadow: 2px 2px 0px 1px rgba(0,0,0,0.15);',
    );
  });

  it('passes through non-rgba colours untouched', async () => {
    expect(await run('', { color: '#ff0000' })).toBe('box-shadow: 0px 4px 12px 0px #ff0000;');
  });

  it('input text is ignored', async () => {
    expect(await run('ignore me')).toBe(await run());
  });
});
