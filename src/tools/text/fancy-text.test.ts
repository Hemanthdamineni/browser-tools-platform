import { describe, it, expect } from 'vitest';
import tool from './fancy-text.tool';

type Res = { output: string; stats?: Record<string, string | number> };

const run = async (text: string, options: Record<string, string> = {}) =>
  (await tool.run({ text, options })) as Res;

const out = async (text: string, options: Record<string, string> = {}) =>
  (await run(text, options)).output;

const cps = (s: string) => [...s].map((c) => c.codePointAt(0));

describe('fancy-text', () => {
  it('maps bold A to U+1D400 exactly', async () => {
    expect(await out('A', { style: 'bold' })).toBe('\u{1D400}');
    expect(cps(await out('A', { style: 'bold' }))).toEqual([0x1d400]);
  });

  it('maps fraktur lowercase g to U+1D524 exactly', async () => {
    expect(await out('g', { style: 'fraktur' })).toBe('\u{1D524}');
    expect(cps(await out('g', { style: 'fraktur' }))).toEqual([0x1d524]);
  });

  it('maps fullwidth digits to U+FF10–U+FF12 exactly', async () => {
    expect(await out('012', { style: 'fullwidth' })).toBe('０１２');
    expect(cps(await out('012', { style: 'fullwidth' }))).toEqual([0xff10, 0xff11, 0xff12]);
  });

  it('covers the contiguous math families', async () => {
    expect(cps(await out('Az', { style: 'bold' }))).toEqual([0x1d400, 0x1d433]);
    expect(cps(await out('Az', { style: 'italic' }))).toEqual([0x1d434, 0x1d467]);
    expect(cps(await out('az', { style: 'monospace' }))).toEqual([0x1d68a, 0x1d6a3]);
    expect(cps(await out('9', { style: 'monospace' }))).toEqual([0x1d7ff]);
    expect(cps(await out('Az', { style: 'double-struck' }))).toEqual([0x1d538, 0x1d56b]);
    expect(cps(await out('0', { style: 'double-struck' }))).toEqual([0x1d7d8]);
  });

  it('handles the letterlike holes in script, fraktur and double-struck', async () => {
    expect(cps(await out('B', { style: 'script' }))).toEqual([0x212c]);
    expect(cps(await out('H', { style: 'script' }))).toEqual([0x210b]);
    expect(cps(await out('C', { style: 'fraktur' }))).toEqual([0x212d]);
    expect(cps(await out('R', { style: 'fraktur' }))).toEqual([0x211c]);
    expect(cps(await out('C', { style: 'double-struck' }))).toEqual([0x2102]);
    expect(cps(await out('Z', { style: 'double-struck' }))).toEqual([0x2124]);
  });

  it('maps circled letters and digits (0 wraps to U+24EA)', async () => {
    expect(cps(await out('A', { style: 'circled' }))).toEqual([0x24b6]);
    expect(cps(await out('a', { style: 'circled' }))).toEqual([0x24d0]);
    expect(cps(await out('01', { style: 'circled' }))).toEqual([0x24ea, 0x2460]);
  });

  it('maps squared, inverted and small caps', async () => {
    expect(cps(await out('A', { style: 'squared' }))).toEqual([0x1f130]);
    expect(cps(await out('A', { style: 'inverted' }))).toEqual([0x1f170]);
    expect(cps(await out('S', { style: 'small-caps' }))).toEqual([0xa731]);
    expect(cps(await out('A', { style: 'small-caps' }))).toEqual([0x1d00]);
  });

  it('leaves unmapped characters unchanged', async () => {
    expect(await out('a! b', { style: 'bold' })).toBe('\u{1D41A}! \u{1D41B}');
    expect(await out('你好 🎉', { style: 'bold' })).toBe('你好 🎉');
    // Lowercase has no squared glyph, so it stays put while A is styled.
    expect(await out('Aa', { style: 'squared' })).toBe('\u{1F130}a');
  });

  it('preserves whitespace and newlines', async () => {
    expect(await out('a\nb', { style: 'bold' })).toBe('\u{1D41A}\n\u{1D41B}');
  });

  it('appends the selected decoration to every character', async () => {
    expect(await out('A', { style: 'bold', decorations: 'underline' })).toBe('\u{1D400}\u0332');
    expect(await out('A', { style: 'bold', decorations: 'overline' })).toBe('\u{1D400}\u0305');
    expect(await out('A', { style: 'bold', decorations: 'strikethrough' })).toBe('\u{1D400}\u0336');
    // Unmapped characters are decorated too.
    expect(await out('!', { style: 'bold', decorations: 'underline' })).toBe('!\u0332');
    expect(await out('A', { style: 'bold' })).toBe('\u{1D400}');
  });

  it('defaults to bold with no decoration when options are omitted', async () => {
    expect(await out('A')).toBe('\u{1D400}');
    expect(cps(await out('A', { decorations: 'underline' }))).toEqual([0x1d400, 0x332]);
  });

  it('produces output for every style', async () => {
    for (const style of [
      'bold',
      'italic',
      'script',
      'fraktur',
      'double-struck',
      'monospace',
      'circled',
      'squared',
      'small-caps',
      'inverted',
      'fullwidth',
    ]) {
      const result = await out('A', { style });
      expect(result).not.toBe('A');
      expect(cps(result)).toEqual([expect.any(Number)]);
    }
  });

  it('reports styled and total character counts', async () => {
    const result = await run('Ab!', { style: 'bold' });
    expect(result.stats).toEqual({ 'styled characters': 2, 'characters total': 3 });
  });

  it('returns an empty string for empty input', async () => {
    expect(await out('', { style: 'bold' })).toBe('');
    expect((await run('', {})).stats).toBeUndefined();
  });
});
