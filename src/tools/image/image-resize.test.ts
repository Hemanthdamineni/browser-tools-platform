import { afterEach, describe, it, expect, vi } from 'vitest';
import { ToolError } from '@/lib/types';
import tool, { computeTargetSize } from './image-resize.tool';
import { installImageMock, makeFile, type MockHandle } from './image-mock';

let mock: MockHandle | undefined;
afterEach(() => {
  mock?.restore();
  mock = undefined;
});

describe('computeTargetSize', () => {
  it('fits 4000×2000 within 800×600 preserving aspect', () => {
    expect(computeTargetSize(4000, 2000, { mode: 'fit', width: 800, height: 600 })).toEqual({ w: 800, h: 400 });
  });
  it('scales percent 50 of 100×100 to 50×50', () => {
    expect(computeTargetSize(100, 100, { mode: 'percent', percent: 50 })).toEqual({ w: 50, h: 50 });
  });
  it('max-width of 400×300 without upscale stays 400×300', () => {
    expect(computeTargetSize(400, 300, { mode: 'max-width', width: 800 })).toEqual({ w: 400, h: 300 });
  });
  it('max-width downscales when the limit is smaller', () => {
    expect(computeTargetSize(1000, 500, { mode: 'max-width', width: 400 })).toEqual({ w: 400, h: 200 });
  });
  it('exact ignores aspect ratio', () => {
    expect(computeTargetSize(1000, 1000, { mode: 'exact', width: 300, height: 150 })).toEqual({ w: 300, h: 150 });
  });
  it('does not upscale in fill mode by default', () => {
    expect(computeTargetSize(100, 100, { mode: 'fill', width: 200, height: 100 })).toEqual({ w: 100, h: 100 });
  });
  it('never returns a zero dimension', () => {
    const r = computeTargetSize(1, 1, { mode: 'percent', percent: 1 });
    expect(r.w).toBeGreaterThanOrEqual(1);
    expect(r.h).toBeGreaterThanOrEqual(1);
  });
  it('falls back to defaults for malformed numeric options', () => {
    expect(computeTargetSize(100, 100, { mode: 'percent', percent: NaN })).toEqual({ w: 50, h: 50 });
    expect(computeTargetSize(100, 100, { mode: 'exact', width: NaN, height: NaN })).toEqual({ w: 800, h: 600 });
  });
  it('rejects invalid source dimensions', () => {
    expect(() => computeTargetSize(NaN, 100, {})).toThrow(/positive finite numbers/i);
    expect(() => computeTargetSize(100, 0, {})).toThrow(/positive finite numbers/i);
  });
});

describe('image-resize run', () => {
  it('rejects when no file is provided', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose an image file/i);
  });

  it('rejects a non-image file', async () => {
    const f = new File(['x'], 'a.txt', { type: 'text/plain' });
    await expect(tool.run({ files: [f], options: {} })).rejects.toThrow(/not an image/i);
  });

  it('reports a friendly error when createImageBitmap is unavailable', async () => {
    await expect(tool.run({ files: [makeFile('a.png')], options: {} })).rejects.toThrow(/createImageBitmap/i);
  });

  it('reports a friendly error for undecodable bytes', async () => {
    mock = installImageMock({ failDecode: true });
    await expect(tool.run({ files: [makeFile('bad.png')], options: {} })).rejects.toThrow(/could not be decoded/i);
  });

  it('keeps transparency for PNG output', async () => {
    mock = installImageMock({ width: 100, height: 100 });
    const result = await tool.run({ files: [makeFile('a.png')], options: { mode: 'percent', percent: 50 } });
    expect(result.outputs[0]!.filename).toBe('a-50x50.png');
    expect(result.outputs[0]!.blob.type).toBe('image/png');
    expect(mock.canvases[0]!.fills).toHaveLength(0);
  });

  it('flattens transparency for JPEG output and applies quality', async () => {
    mock = installImageMock({ width: 100, height: 100 });
    const result = await tool.run({
      files: [makeFile('a.png')],
      options: { mode: 'exact', width: 30, height: 20, format: 'jpeg', quality: 60 },
    });
    expect(result.outputs[0]!.filename).toBe('a-30x20.jpg');
    expect(result.outputs[0]!.blob.type).toBe('image/jpeg');
    expect(mock.canvases[0]!.fills).toEqual([{ x: 0, y: 0, w: 30, h: 20, style: '#ffffff' }]);
    expect(mock.canvases[0]!.encodes[0]!.quality).toBeCloseTo(0.6);
  });

  it('writes WebP output without flattening', async () => {
    mock = installImageMock();
    const result = await tool.run({ files: [makeFile('a.png')], options: { mode: 'percent', percent: 50, format: 'webp' } });
    expect(result.outputs[0]!.blob.type).toBe('image/webp');
    expect(mock.canvases[0]!.fills).toHaveLength(0);
  });

  it('covers and crops the source in fill mode', async () => {
    mock = installImageMock({ width: 100, height: 100 });
    const result = await tool.run({ files: [makeFile('a.png')], options: { mode: 'fill', width: 200, height: 100, upscale: true } });
    expect(result.outputs[0]!.filename).toBe('a-200x200.png');
    expect(mock.canvases[0]!.draws[0]!.args).toHaveLength(9);
    expect(mock.canvases[0]!.draws[0]).toMatchObject({ destW: 200, destH: 200 });
  });

  it('allows upscaling in fit mode when enabled', async () => {
    mock = installImageMock({ width: 100, height: 100 });
    const result = await tool.run({ files: [makeFile('a.png')], options: { mode: 'fit', width: 800, height: 600, upscale: true } });
    expect(result.outputs[0]!.filename).toBe('a-600x600.png');
  });

  it('honours max-height mode', async () => {
    mock = installImageMock({ width: 400, height: 300 });
    const result = await tool.run({ files: [makeFile('a.png')], options: { mode: 'max-height', height: 150 } });
    expect(result.outputs[0]!.filename).toBe('a-200x150.png');
  });

  it('requests EXIF orientation while decoding', async () => {
    mock = installImageMock();
    await tool.run({ files: [makeFile('a.jpg', 'image/jpeg')], options: {} });
    expect(mock.bitmaps[0]!.options).toEqual({ imageOrientation: 'from-image' });
  });

  it('falls back to a plain decode when orientation options are unsupported', async () => {
    mock = installImageMock({ rejectOrientation: true });
    const result = await tool.run({ files: [makeFile('a.jpg', 'image/jpeg')], options: {} });
    expect(result.outputs).toHaveLength(1);
    expect(mock.bitmaps[0]!.options).toBeUndefined();
  });

  it('resizes every file in batch mode and reports progress', async () => {
    mock = installImageMock({ width: 100, height: 100 });
    const onProgress = vi.fn();
    const result = await tool.run({
      files: [makeFile('a.png'), makeFile('b.png')],
      options: { mode: 'percent', percent: 50 },
      onProgress,
    });
    expect(result.outputs.map((o) => o.filename)).toEqual(['a-50x50.png', 'b-50x50.png']);
    expect(result.stats?.files).toBe(2);
    expect(onProgress).toHaveBeenCalledWith(1, 'Done');
  });

  it('cancels when the signal is already aborted', async () => {
    mock = installImageMock();
    await expect(tool.run({ files: [makeFile('a.png')], options: {}, signal: AbortSignal.abort() })).rejects.toThrow(
      /cancelled/i,
    );
  });

  it('rejects an oversized source image', async () => {
    mock = installImageMock({ width: 20_000, height: 20_000 });
    await expect(tool.run({ files: [makeFile('huge.png')], options: {} })).rejects.toThrow(/too large/i);
  });

  it('rejects an oversized target from a small source', async () => {
    mock = installImageMock({ width: 100, height: 100 });
    await expect(
      tool.run({ files: [makeFile('a.png')], options: { mode: 'exact', width: 20_000, height: 20_000 } }),
    ).rejects.toThrow(ToolError);
  });
});
