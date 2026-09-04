import { describe, it, expect } from 'vitest';
import tool from './editorconfig.tool';

const run = (text = '', options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }).output;

describe('editorconfig', () => {
  it('defaults produce the canonical file', () => {
    const out = run();
    expect(out).toContain('root = true');
    expect(out).toContain('[*]');
    expect(out).toContain('indent_style = space');
    expect(out).toContain('indent_size = 2');
    expect(out).toContain('[*.md]');
    expect(out).toContain('trim_trailing_whitespace = false');
  });

  it('tab style omits indent_size', () => {
    const out = run('', { indentStyle: 'tab' });
    expect(out).toContain('indent_style = tab');
    expect(out).not.toMatch(/indent_size/);
  });

  it('respects end-of-line, charset and boolean toggles', () => {
    const out = run('', {
      endOfLine: 'crlf',
      charset: 'latin1',
      trimTrailingWhitespace: false,
      insertFinalNewline: false,
    });
    expect(out).toContain('end_of_line = crlf');
    expect(out).toContain('charset = latin1');
    expect(out).toContain('trim_trailing_whitespace = false');
    expect(out).toContain('insert_final_newline = false');
  });

  it('includes max_line_length only when > 0', () => {
    expect(run('', { maxLineLength: 100 })).toContain('max_line_length = 100');
    expect(run()).not.toContain('max_line_length');
  });
});
