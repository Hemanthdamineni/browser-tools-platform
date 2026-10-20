import { describe, it, expect } from 'vitest';

import tool from './unicode-styles.tool';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as {
    output: string;
    render?: string;
    stats?: Record<string, string | number>;
  };

// Explicit escapes so expectations never depend on hand-typed styled glyphs.
const FW = 'Ｍｅｅｔ　ａｔ　１０：３０';
const MONO = '\u{1d5a4}=\u{1d5c6}\u{1d5bc}\u{1d7e4}';

describe('unicode-styles', () => {
  it('converts ASCII to full-width and back', async () => {
    const encoded = await run('Meet at 10:30', { style: 'fullwidth' });
    expect(encoded.output).toBe(FW);
    expect(encoded.stats?.['characters changed']).toBe(13);
    const decoded = await run(FW, { conversion: 'decode', style: 'fullwidth' });
    expect(decoded.output).toBe('Meet at 10:30');
  });

  it('circles letters, digits and zero', async () => {
    expect((await run('Plan B2', { style: 'circled' })).output).toBe('Ⓟⓛⓐⓝ Ⓑ②');
    expect((await run('0', { style: 'circled' })).output).toBe('⓪'); // ⓪
  });

  it('squares uppercase letters and leaves unsupported chars unchanged', async () => {
    expect((await run('AB: x', { style: 'squared' })).output).toBe('\u{1f130}\u{1f131}: x');
  });

  it('maps to bold math sans-serif', async () => {
    expect((await run('E=mc2', { style: 'monospace' })).output).toBe(MONO);
  });

  it('decodes each style back to ASCII', async () => {
    expect((await run('ｈｅｌｌｏ', { conversion: 'decode', style: 'fullwidth' })).output).toBe(
      'hello',
    );
    expect((await run('Ⓗⓘ', { conversion: 'decode', style: 'circled' })).output).toBe('Hi');
    expect(
      (await run('\u{1f130}\u{1f13a}', { conversion: 'decode', style: 'squared' })).output,
    ).toBe('AK');
    expect(
      (await run('\u{1d5c6}\u{1d5ba}\u{1d5cd}', { conversion: 'decode', style: 'monospace' }))
        .output,
    ).toBe('mat');
  });

  it('round-trips a sentence through each style', async () => {
    for (const style of ['fullwidth', 'circled', 'squared', 'monospace']) {
      const encoded = await run('Hello World 123', { style });
      const decoded = await run(encoded.output, { conversion: 'decode', style });
      expect(decoded.output).toBe('Hello World 123');
    }
  });

  it('leaves unsupported emoji and non-ASCII unchanged', async () => {
    expect((await run('é🙂', { style: 'circled' })).output).toBe('é🙂');
  });

  it('returns empty output for empty input', async () => {
    expect((await run('')).output).toBe('');
  });

  it('reports character stats and code render', async () => {
    const result = await run('Hi', { style: 'circled' });
    expect(result.stats?.['characters changed']).toBe(2);
    expect(result.stats?.['characters total']).toBe(2);
    expect(result.render).toBe('code');
  });
});
