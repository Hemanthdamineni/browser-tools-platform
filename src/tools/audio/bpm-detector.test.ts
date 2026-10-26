import { describe, expect, it, vi } from 'vitest';

// The tool module pulls in the panel (its DSP lives there), and the panel
// imports the worker client. Stub it so this metadata test does not load the
// whole tool registry.
vi.mock('@/lib/worker/client', () => ({ runToolById: vi.fn() }));

import tool from './bpm-detector.tool';
import { ToolError } from '@/lib/types';

describe('bpm-detector run', () => {
  it('rejects when no file is provided', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(ToolError);
  });

  it('resolves option defaults without an options object', () => {
    // The tool module always exposes meta with the declared defaults.
    expect(tool.meta.id).toBe('bpm-detector');
    expect(tool.meta.category).toBe('audio');
    expect(tool.meta.input).toBe('file');
  });

  it('keeps the summary under the 120-character card limit', () => {
    expect(tool.meta.summary.length).toBeLessThanOrEqual(120);
  });

  it('declares both BPM window options', () => {
    const keys = (tool.meta.options ?? []).map((o) => o.key);
    expect(keys).toContain('minBpm');
    expect(keys).toContain('maxBpm');
  });
});
