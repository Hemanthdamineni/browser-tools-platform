import { describe, it, expect } from 'vitest';
import tool from './online-notepad.tool';

describe('online-notepad', () => {
  it('returns info text when run without panel', async () => {
    const res = await tool.run({ text: '', options: { defaultFormat: 'md' } });
    expect(res.render).toBe('text');
    expect(res.output).toContain('Online Notepad');
    expect(res.output).toContain('IndexedDB');
    expect(res.output).toContain('panel');
  });

  it('handles empty input', async () => {
    const res = await tool.run({ text: '', options: { defaultFormat: 'txt' } });
    expect(res.render).toBe('text');
  });
});