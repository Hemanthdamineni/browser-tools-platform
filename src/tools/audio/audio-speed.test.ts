import { describe, it, expect } from 'vitest';
import tool, { stretchChannel } from './audio-speed.tool';
import { ToolError } from '@/lib/types';

describe('audio-speed - stretchChannel', () => {
  it('returns a clone when rate is 1', () => {
    const orig = new Float32Array([0.1, 0.2, 0.3]);
    const res = stretchChannel(orig, 1);
    expect(res).not.toBe(orig);
    expect(Array.from(res)).toEqual(Array.from(orig));
  });

  it('shortens the channel when speed > 1', () => {
    const orig = new Float32Array(4096);
    for (let i = 0; i < orig.length; i++) orig[i] = Math.sin(i * 0.1);
    const fast = stretchChannel(orig, 2.0);
    expect(fast.length).toBeLessThan(orig.length);
  });

  it('lengthens the channel when speed < 1', () => {
    const orig = new Float32Array(4096);
    for (let i = 0; i < orig.length; i++) orig[i] = Math.sin(i * 0.1);
    const slow = stretchChannel(orig, 0.5);
    expect(slow.length).toBeGreaterThan(orig.length);
  });
});

describe('audio-speed run', () => {
  it('rejects when no file is provided', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(ToolError);
  });
});
