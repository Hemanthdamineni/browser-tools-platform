import { describe, it, expect } from 'vitest';
import tool from './typing-test.tool';

describe('typing-test', () => {
  it('generates target text for time-based mode', async () => {
    const res = await tool.run({
      text: '',
      options: { mode: 'time-60', punctuation: false, numbers: false },
    });
    expect(res.render).toBe('text');
    expect(res.output).toContain('Target text');
    expect(res.output).toContain('words');
  });

  it('generates target text for word-based mode', async () => {
    const res = await tool.run({
      text: '',
      options: { mode: 'words-50', punctuation: false, numbers: false },
    });
    expect(res.render).toBe('text');
    expect(res.output).toContain('Target text');
  });

  it('calculates results when typed text is provided', async () => {
    const targetText = 'the quick brown fox';
    const res = await tool.run({
      text: targetText,
      options: { mode: 'words-10', punctuation: false, numbers: false },
    });
    expect(res.render).toBe('table');
    const parsed = JSON.parse(res.output);
    expect(parsed.headers).toEqual(['Metric', 'Value']);
    expect(parsed.rows.some((r: string[]) => r[0] === 'Gross WPM')).toBe(true);
    expect(parsed.rows.some((r: string[]) => r[0] === 'Net WPM')).toBe(true);
    expect(parsed.rows.some((r: string[]) => r[0] === 'Accuracy')).toBe(true);
  });

  it('handles empty input', async () => {
    const res = await tool.run({
      text: '',
      options: { mode: 'time-30', punctuation: false, numbers: false },
    });
    expect(res.render).toBe('text');
    expect(res.output).toContain('Target text');
  });
});
