import { describe, it, expect } from 'vitest';
import tool from './whitespace-visualizer.tool';

const run = async (text: string, mode = 'visualize') =>
  (await tool.run({ text, options: { mode } })) as {
    output: string;
    stats?: Record<string, string | number>;
  };

describe('whitespace-visualizer', () => {
  it('labels spaces, tabs, LF, CR and CRLF', async () => {
    const result = await run('a b\tc\nd\re\r\nf');
    expect(result.output).toBe(
      'a[SPACE U+0020]b[TAB U+0009]c[LF U+000A]d[CR U+000D]e[CRLF U+000D]f',
    );
    expect(result.stats?.['invisible characters shown']).toBe(5);
  });

  it('labels Unicode spaces, zero-width characters and unknown controls', async () => {
    expect((await run('x y​z\u0001')).output).toBe(
      'x[NBSP U+00A0]y[ZERO-WIDTH SPACE U+200B]z[CONTROL U+0001]',
    );
  });

  it('preserves visible Unicode including emoji and combining sequences', async () => {
    expect((await run('🙂é')).output).toBe('🙂é');
  });

  it('converts NBSP and removes selected formatting marks in clean mode', async () => {
    const result = await run('a b​c⁠d﻿e', 'clean');
    expect(result.output).toBe('a bcde');
    expect(result.stats?.['NBSP converted']).toBe(1);
    expect(result.stats?.['zero-width formatting removed']).toBe(3);
  });

  it('preserves zero-width joiners in clean mode for emoji shaping', async () => {
    expect((await run('👩‍💻​!', 'clean')).output).toBe('👩‍💻!');
  });

  it('returns empty output for empty input', async () => {
    expect((await run('')).output).toBe('');
  });
});
