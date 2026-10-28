import { describe, it, expect } from 'vitest';
import tool from './upgrade-text-stats.tool';

describe('upgrade-text-stats', () => {
  const sample = 'The quick brown fox jumps over the lazy dog. The dog sleeps peacefully.';

  it('counts basic metrics', async () => {
    const res = await tool.run({ text: sample, options: { showDetails: false, platform: 'all' } });
    expect(res.render).toBe('table');
    const parsed = JSON.parse(res.output);
    expect(parsed.headers).toEqual(['Metric', 'Value']);
    const rows = Object.fromEntries(parsed.rows);
    expect(parseInt(rows['Characters'])).toBeGreaterThan(0);
    expect(parseInt(rows['Words'])).toBeGreaterThan(0);
    expect(parseInt(rows['Sentences'])).toBe(2);
  });

  it('includes readability scores when showDetails is true', async () => {
    const longText = sample.repeat(10);
    const res = await tool.run({ text: longText, options: { showDetails: true, platform: 'all' } });
    const parsed = JSON.parse(res.output);
    const rows = Object.fromEntries(parsed.rows);
    expect(rows['Flesch Reading Ease']).toBeDefined();
    expect(rows['Flesch-Kincaid Grade']).toBeDefined();
    expect(rows['Gunning Fog Index']).toBeDefined();
    expect(rows['SMOG Index']).toBeDefined();
    expect(rows['Automated Readability Index (ARI)']).toBeDefined();
    expect(rows['Coleman-Liau Index']).toBeDefined();
  });

  it('shows platform limits', async () => {
    const res = await tool.run({ text: sample, options: { showDetails: true, platform: 'x' } });
    const parsed = JSON.parse(res.output);
    const rows = parsed.rows;
    const platformRows = rows.filter((r: string[]) => r[0] === 'X / Twitter');
    expect(platformRows.length).toBe(1);
    expect(platformRows[0][1]).toContain('/280');
  });

  it('flags over-limit text for X', async () => {
    const longText = 'a'.repeat(300);
    const res = await tool.run({ text: longText, options: { showDetails: true, platform: 'x' } });
    const parsed = JSON.parse(res.output);
    const rows = parsed.rows;
    const platformRow = rows.find((r: string[]) => r[0] === 'X / Twitter');
    expect(platformRow).toBeDefined();
    expect(platformRow![3]).toContain('OVER');
  });

  it('handles empty input', async () => {
    const res = await tool.run({ text: '', options: { showDetails: true, platform: 'all' } });
    expect(res.render).toBe('table');
  });

  it('marks scores as approximate for short text', async () => {
    const res = await tool.run({ text: 'Hi.', options: { showDetails: true, platform: 'all' } });
    const parsed = JSON.parse(res.output);
    const rows = Object.fromEntries(parsed.rows);
    expect(rows['⚠ Note']).toContain('approximate');
  });
});