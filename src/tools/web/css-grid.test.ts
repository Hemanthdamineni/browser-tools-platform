import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './css-grid.tool';

type Result = { output: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (options: Record<string, string | number | boolean> = {}) => tool.run({ text: '', options }) as Result;

describe('css-grid', () => {
  it('generates a basic grid rule with track and alignment declarations', () => {
    const result = run({ columns: 'repeat(3, 1fr)', rows: 'auto 1fr', gap: '1rem', selector: '.cards', justifyItems: 'center', alignItems: 'start' });
    expect(result.output).toContain('.cards {');
    expect(result.output).toContain('grid-template-columns: repeat(3, 1fr);');
    expect(result.output).toContain('grid-template-rows: auto 1fr;');
    expect(result.output).toContain('justify-items: center;');
    expect(result.output).toContain('align-items: start;');
  });

  it('generates and validates named rectangular areas', () => {
    const result = run({ columns: '240px 1fr', rows: 'auto 1fr auto', areas: 'header header\nsidebar main\nfooter footer', selector: '.dashboard' });
    expect(result.output).toContain('grid-template-areas:');
    expect(result.output).toContain('"header header"');
    expect(result.output).toContain('"sidebar main"');
    expect(result.stats?.['named areas']).toBe(4);
    expect(result.notes?.[0]).toContain('4 named area');
  });

  it('supports dot empty cells and explicit gap overrides', () => {
    const result = run({ areas: 'header header\n. main', gap: '8px', columnGap: '16px', rowGap: '24px' });
    expect(result.output).toContain('". main"');
    expect(result.output).toContain('column-gap: 16px;');
    expect(result.output).toContain('row-gap: 24px;');
  });

  it('rejects non-rectangular areas and ragged matrices', () => {
    expect(() => run({ areas: 'header main\n. header' })).toThrow(/rectangle/i);
    expect(() => run({ areas: 'header main\nfooter' })).toThrow(/same number/i);
  });

  it('rejects unsafe track values and selector injection', () => {
    expect(() => run({ columns: '1fr; color:red' })).toThrow(ToolError);
    expect(() => run({ rows: 'url(javascript:alert(1))' })).toThrow(ToolError);
    expect(() => run({ selector: '.layout { color:red }' })).toThrow(ToolError);
  });

  it('rejects invalid alignment and empty required tracks', () => {
    expect(() => run({ justifyItems: 'space-between' })).toThrow(ToolError);
    expect(() => run({ columns: '' })).toThrow(ToolError);
    expect(() => run({ rows: '' })).toThrow(ToolError);
  });
});
