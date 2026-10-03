import { describe, it, expect } from 'vitest';
import tool, { transformChannels } from './audio-channels.tool';
import { ToolError } from '@/lib/types';

describe('audio-channels - transformChannels', () => {
  const l = new Float32Array([1.0, 0.5]);
  const r = new Float32Array([0.0, 0.5]);

  it('transforms stereo to mono', () => {
    const res = transformChannels([l, r], 'to-mono');
    expect(res).toHaveLength(1);
    expect(res[0]![0]).toBeCloseTo(0.5);
    expect(res[0]![1]).toBeCloseTo(0.5);
  });

  it('swaps channels', () => {
    const res = transformChannels([l, r], 'swap');
    expect(res).toHaveLength(2);
    expect(Array.from(res[0]!)).toEqual(Array.from(r));
    expect(Array.from(res[1]!)).toEqual(Array.from(l));
  });

  it('isolates left-only', () => {
    const res = transformChannels([l, r], 'left-only');
    expect(res).toHaveLength(2);
    expect(Array.from(res[0]!)).toEqual(Array.from(l));
    expect(Array.from(res[1]!)).toEqual(Array.from(l));
  });

  it('isolates right-only', () => {
    const res = transformChannels([l, r], 'right-only');
    expect(res).toHaveLength(2);
    expect(Array.from(res[0]!)).toEqual(Array.from(r));
    expect(Array.from(res[1]!)).toEqual(Array.from(r));
  });

  it('calculates mid-side decomposition', () => {
    const res = transformChannels([l, r], 'mid-side');
    expect(res).toHaveLength(2);
    expect(res[0]![0]).toBeCloseTo(0.5); // (1+0)/2
    expect(res[1]![0]).toBeCloseTo(0.5); // (1-0)/2
  });
});

describe('audio-channels run', () => {
  it('rejects when no file is provided', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(ToolError);
  });
});
