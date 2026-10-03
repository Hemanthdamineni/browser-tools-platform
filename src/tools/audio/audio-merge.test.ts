import { describe, it, expect } from 'vitest';
import tool from './audio-merge.tool';
import { ToolError } from '@/lib/types';

describe('audio-merge run', () => {
  it('rejects when fewer than two files are provided', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(ToolError);
    const f1 = new File(['wav'], 'test.wav', { type: 'audio/wav' });
    await expect(tool.run({ files: [f1], options: {} })).rejects.toThrow(ToolError);
  });
});
