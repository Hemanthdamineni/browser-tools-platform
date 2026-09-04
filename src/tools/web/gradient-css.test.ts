import { describe, it, expect } from 'vitest';
import tool from './gradient-css.tool';
import { ToolError } from '@/lib/types';

const run = (text = '', options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }).output;

describe('gradient-css', () => {
  it('defaults to a 90° linear gradient with the spec stops', () => {
    const out = run();
    expect(out).toContain('linear-gradient(90deg, #4f46e5 0%, #ec4899 100%)');
    expect(out).toContain('background-color: #4f46e5;');
  });

  it('radial gradients use the chosen shape', () => {
    expect(run('', { type: 'radial' })).toContain('radial-gradient(ellipse,');
    expect(run('', { type: 'radial', shape: 'circle' })).toContain('radial-gradient(circle,');
  });

  it('conic gradients use from-angle syntax', () => {
    expect(run('', { type: 'conic', angle: 45 })).toContain('conic-gradient(from 45deg,');
  });

  it('accepts rgb/hsl/named colours and stops without positions', () => {
    const out = run('', { stops: 'red\nrgb(0,128,0)\n#00f 100%' });
    expect(out).toContain('linear-gradient(90deg, red, rgb(0,128,0), #00f 100%)');
  });

  it('throws ToolError on a bad colour token', () => {
    expect(() => run('', { stops: '#4f46e5\nnotacolor 50%' })).toThrow(ToolError);
    expect(() => run('', { stops: '#4f46e5\nnotacolor 50%' })).toThrow(/is not a colour/);
  });

  it('throws ToolError with fewer than two valid stops', () => {
    expect(() => run('', { stops: '#4f46e5' })).toThrow(ToolError);
    expect(() => run('', { stops: '#4f46e5' })).toThrow(/at least two colour stops/);
  });
});
