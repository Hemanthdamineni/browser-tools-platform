import { describe, it, expect } from 'vitest';
import tool, { applyGain } from './audio-gain.tool';
import { ToolError } from '@/lib/types';

describe('audio-gain - applyGain', () => {
  it('applies gain linearly with hard clipping', () => {
    const ch = new Float32Array([0.2, 0.5, 0.8]);
    const { data, clipped } = applyGain(ch, 2.0, true);
    expect(data[0]).toBeCloseTo(0.4);
    expect(data[1]).toBeCloseTo(1.0);
    expect(data[2]).toBeCloseTo(1.0); // clamped from 1.6 to 1.0
    expect(clipped).toBe(true);
  });

  it('reports no clipping when within range', () => {
    const ch = new Float32Array([0.1, -0.2, 0.3]);
    const { data, clipped } = applyGain(ch, 1.5, true);
    expect(clipped).toBe(false);
    expect(data[2]).toBeCloseTo(0.45);
  });

  it('uses tanh soft saturation when hardClip is false', () => {
    const ch = new Float32Array([2.0]);
    const { data } = applyGain(ch, 2.0, false);
    expect(data[0]).toBeCloseTo(Math.tanh(4.0));
    expect(data[0]).toBeLessThan(1.0);
  });
});

describe('audio-gain run', () => {
  it('rejects when no file is provided', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(ToolError);
  });
});
