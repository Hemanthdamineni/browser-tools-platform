import { describe, it, expect } from 'vitest';
import tool, { reverseChannel } from './audio-reverse.tool';
import { ToolError } from '@/lib/types';

describe('audio-reverse - reverseChannel', () => {
  it('reverses channel samples without mutating input', () => {
    const orig = new Float32Array([1, 2, 3, 4]);
    const rev = reverseChannel(orig);
    expect(Array.from(rev)).toEqual([4, 3, 2, 1]);
    expect(Array.from(orig)).toEqual([1, 2, 3, 4]);
  });
});

describe('audio-reverse run', () => {
  it('rejects when no file is provided', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(ToolError);
  });
});
