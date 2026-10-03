import { describe, it, expect } from 'vitest';
import tool, { fadeEnvelope } from './audio-fade.tool';
import { ToolError } from '@/lib/types';

describe('audio-fade - fadeEnvelope', () => {
  it('computes linear envelope', () => {
    expect(fadeEnvelope(0, 'linear')).toBe(0);
    expect(fadeEnvelope(0.5, 'linear')).toBe(0.5);
    expect(fadeEnvelope(1, 'linear')).toBe(1);
  });

  it('computes exponential envelope (t^2)', () => {
    expect(fadeEnvelope(0.5, 'exponential')).toBe(0.25);
  });

  it('computes logarithmic envelope (sqrt(t))', () => {
    expect(fadeEnvelope(0.25, 'logarithmic')).toBe(0.5);
  });

  it('clamps bounds between 0 and 1', () => {
    expect(fadeEnvelope(-0.5, 'linear')).toBe(0);
    expect(fadeEnvelope(1.5, 'linear')).toBe(1);
  });
});

describe('audio-fade run', () => {
  it('rejects when no file is provided', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(ToolError);
  });
});
