import { describe, it, expect } from 'vitest';
import tool from './audio-trim.tool';
import { ToolError } from '@/lib/types';

describe('audio-trim run', () => {
  it('rejects when no file is provided', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(ToolError);
  });
});
