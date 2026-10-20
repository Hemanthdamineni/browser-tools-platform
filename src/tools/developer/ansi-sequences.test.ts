import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './ansi-sequences.tool';

type Result = { output: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, operation = 'strip') =>
  tool.run({ text, options: { operation } }) as Result;

describe('ansi-sequences', () => {
  it('strips SGR styling while preserving text and line endings', () => {
    expect(run('\u001b[31mERROR\u001b[0m: bad\r\nnext').output).toBe('ERROR: bad\r\nnext');
  });

  it('visualizes SGR and common cursor/control CSI sequences', () => {
    expect(run('\u001b[1;32mOK\u001b[0m\u001b[2K', 'visualize').output).toBe(
      '[SGR 1;32]OK[SGR 0][CSI 2K: erase line]',
    );
  });

  it('recognizes OSC sequences terminated with BEL or ST', () => {
    const input = '\u001b]8;;https://example.test\u0007link\u001b]8;;\u001b\\';
    expect(run(input, 'strip').output).toBe('link');
    expect(run(input, 'visualize').output).toBe('[OSC 8; … (BEL)]link[OSC 8; … (ST)]');
  });

  it('analyzes sequence offsets and raw values', () => {
    const result = run('a\u001b[31mb\u001b[0m', 'analyze');
    expect(JSON.parse(result.output)).toEqual({
      headers: ['Offset', 'Type', 'Category', 'Readable form', 'Raw sequence'],
      rows: [
        ['1', 'CSI', 'SGR styling', '[SGR 31]', '\u001b[31m'],
        ['7', 'CSI', 'SGR styling', '[SGR 0]', '\u001b[0m'],
      ],
    });
  });

  it('preserves malformed or unsupported escapes and reports them', () => {
    const text = 'a\u001b[31\nb\u001b]unterminated';
    const result = run(text);
    expect(result.output).toBe(text);
    expect(result.stats?.malformed).toBe(2);
    expect(result.notes?.[0]).toMatch(/left untouched/i);
  });

  it('handles empty and plain text and rejects unknown operations', () => {
    expect(run('').output).toBe('');
    expect(run('plain\ttext\n').output).toBe('plain\ttext\n');
    expect(() => run('text', 'unknown')).toThrow(ToolError);
  });
});
