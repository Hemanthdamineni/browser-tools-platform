import { describe, it, expect } from 'vitest';
import { canvasFor, decodeImage, drawToBlob, readPixels } from './image';
import { ToolError } from './types';

// jsdom has no OffscreenCanvas / createImageBitmap, so the guarded paths are
// fully testable here; the pixel paths are exercised by the e2e suite.
const supported = typeof OffscreenCanvas !== 'undefined';

describe('canvasFor', () => {
  it('throws a ToolError when OffscreenCanvas is unsupported', () => {
    if (supported) return; // environment has it; guard test still valid
    expect(() => canvasFor(10, 10)).toThrow(ToolError);
    expect(() => canvasFor(10, 10)).toThrow(/support/i);
  });
});

describe('decodeImage', () => {
  it('throws a ToolError when createImageBitmap is unsupported', async () => {
    if (typeof createImageBitmap === 'function') return;
    await expect(decodeImage(new Blob())).rejects.toThrow(ToolError);
    await expect(decodeImage(new Blob())).rejects.toThrow(/support/i);
  });
});

describe('drawToBlob', () => {
  it('rejects with a ToolError when the canvas API is unavailable', async () => {
    if (supported) return;
    const fake = { width: 4, height: 4 } as unknown as ImageBitmap;
    await expect(drawToBlob(fake)).rejects.toThrow(ToolError);
  });
});

describe('readPixels', () => {
  it('rejects with a ToolError when the canvas API is unavailable', () => {
    if (supported) return;
    const fake = { width: 4, height: 4 } as unknown as ImageBitmap;
    expect(() => readPixels(fake)).toThrow(ToolError);
  });
});
