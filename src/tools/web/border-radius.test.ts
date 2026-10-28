import { describe, it, expect } from 'vitest';
import tool from './border-radius.tool';

const run = async (options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text: '', options })).output;

describe('border-radius', () => {
  it('collapses four equal corners to a single value', async () => {
    expect(await run()).toBe('border-radius: 12px;');
  });

  it('emits one value for a pill and preserves the unit', async () => {
    expect(
      await run({ topLeft: 9999, topRight: 9999, bottomRight: 9999, bottomLeft: 9999 }),
    ).toBe('border-radius: 9999px;');
    expect(
      await run({ unit: '%', topLeft: 50, topRight: 50, bottomRight: 50, bottomLeft: 50 }),
    ).toBe('border-radius: 50%;');
  });

  it('collapses matching opposite pairs to two values', async () => {
    expect(await run({ topLeft: 8, topRight: 0, bottomRight: 8, bottomLeft: 0 })).toBe(
      'border-radius: 8px 0;',
    );
  });

  it('collapses matching bottom corners to three values', async () => {
    expect(await run({ topLeft: 8, topRight: 0, bottomRight: 4, bottomLeft: 0 })).toBe(
      'border-radius: 8px 0 4px;',
    );
  });

  it('adds the elliptical half only when a vertical radius is set', async () => {
    expect(await run({ ellipse: true })).toBe('border-radius: 12px;');
    expect(
      await run({
        ellipse: true,
        topLeft: 20,
        topRight: 20,
        bottomRight: 20,
        bottomLeft: 20,
        verticalTopLeft: 40,
        verticalTopRight: 40,
        verticalBottomRight: 40,
        verticalBottomLeft: 40,
      }),
    ).toBe('border-radius: 20px / 40px;');
  });

  it('clamps negative radii to zero', async () => {
    expect(await run({ topLeft: -5, topRight: -5, bottomRight: -5, bottomLeft: -5 })).toBe(
      'border-radius: 0;',
    );
  });
});