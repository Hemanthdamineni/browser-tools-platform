import { describe, it, expect } from 'vitest';
import tool from './audio-info.tool';
import { ToolError } from '@/lib/types';

describe('audio-info run', () => {
  it('rejects when no file is provided', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(ToolError);
  });
});
