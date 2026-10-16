import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToolError } from '@/lib/types';
import tool, { compressMime, compressTarget } from './image-compress.tool';
import { installImageMock, makeFile, type MockHandle } from './image-mock';

let mock: MockHandle | undefined;
afterEach(() => {
  mock?.restore();
  mock = undefined;
});

describe('compressTarget', () => {
  it('keeps the original size when maxWidth is 0', () => {
    expect(compressTarget(400, 300, 0)).toEqual({ width: 400, height: 300 });
  });
  it('downscales to the cap preserving aspect ratio', () => {
    expect(compressTarget(1000, 500, 400)).toEqual({ width: 400, height: 200 });
  });
  it('never upscales beyond the source', () => {
    expect(compressTarget(200, 100, 800)).toEqual({ width: 200, height: 100 });
  });
});

describe('compressMime', () => {
  it('maps explicit formats', () => {
    expect(compressMime('jpeg', 'image/png')).toBe('image/jpeg');
    expect(compressMime('webp', 'image/jpeg')).toBe('image/webp');
  });
  it('auto keeps JPEG as JPEG and converts everything else to WebP', () => {
    expect(compressMime('auto', 'image/jpeg')).toBe('image/jpeg');
    expect(compressMime('auto', 'image/png')).toBe('image/webp');
  });
});

describe('image-compress run', () => {
  it('rejects an empty selection', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose an image file/i);
  });

  it('rejects a non-image selection', async () => {
    const file = new File(['not image'], 'note.txt', { type: 'text/plain' });
    await expect(tool.run({ files: [file], options: {} })).rejects.toThrow(/not an image/i);
  });

  it('reports a friendly error when createImageBitmap is unavailable', async () => {
    const file = makeFile('image.png');
    await expect(tool.run({ files: [file], options: {} })).rejects.toThrow(/createImageBitmap/i);
  });

  it('reports a friendly error when the bytes cannot be decoded', async () => {
    mock = installImageMock({ failDecode: true });
    await expect(tool.run({ files: [makeFile('bad.png')], options: {} })).rejects.toThrow(/could not be decoded/i);
  });

  it('compresses a PNG to WebP by default, preserving transparency', async () => {
    mock = installImageMock({ width: 200, height: 100 });
    const result = await tool.run({ files: [makeFile('photo.png')], options: {} });
    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]!.filename).toBe('photo-min.webp');
    expect(result.outputs[0]!.blob.type).toBe('image/webp');
    // No opaque background fill for an alpha-capable format.
    expect(mock.canvases[0]!.fills).toHaveLength(0);
  });

  it('flattens transparent pixels when writing JPEG', async () => {
    mock = installImageMock({ width: 40, height: 20 });
    const result = await tool.run({ files: [makeFile('photo.png')], options: { format: 'jpeg' } });
    expect(result.outputs[0]!.blob.type).toBe('image/jpeg');
    expect(result.outputs[0]!.filename).toBe('photo-min.jpg');
    expect(mock.canvases[0]!.fills).toEqual([{ x: 0, y: 0, w: 40, h: 20, style: '#ffffff' }]);
  });

  it('keeps JPEG sources as JPEG in automatic mode', async () => {
    mock = installImageMock();
    const result = await tool.run({ files: [makeFile('photo.jpg', 'image/jpeg')], options: {} });
    expect(result.outputs[0]!.blob.type).toBe('image/jpeg');
  });

  it('honours maxWidth by drawing to the capped dimensions', async () => {
    mock = installImageMock({ width: 200, height: 100 });
    await tool.run({ files: [makeFile('photo.png')], options: { maxWidth: 50 } });
    expect(mock.canvases[0]!.width).toBe(50);
    expect(mock.canvases[0]!.height).toBe(25);
    expect(mock.canvases[0]!.draws[0]).toMatchObject({ destW: 50, destH: 25 });
  });

  it('passes the chosen quality to the encoder', async () => {
    mock = installImageMock();
    await tool.run({ files: [makeFile('photo.png')], options: { quality: 40 } });
    expect(mock.canvases[0]!.encodes[0]!.quality).toBeCloseTo(0.4);
  });

  it('keeps the original when compression would enlarge the file', async () => {
    mock = installImageMock({ encodeSize: 5000 });
    const file = makeFile('photo.png', 'image/png', 100);
    const result = await tool.run({ files: [file], options: {} });
    expect(result.outputs[0]!.filename).toBe('photo.png');
    expect(result.outputs[0]!.blob.size).toBe(100);
    expect(result.warnings?.join(' ')).toMatch(/original is kept/i);
  });

  it('warns that metadata cannot be preserved when stripping is disabled', async () => {
    mock = installImageMock();
    const result = await tool.run({ files: [makeFile('photo.png')], options: { stripMetadata: false } });
    expect(result.warnings?.join(' ')).toMatch(/metadata/i);
  });

  it('requests EXIF orientation while decoding', async () => {
    mock = installImageMock();
    await tool.run({ files: [makeFile('photo.jpg', 'image/jpeg')], options: {} });
    expect(mock.bitmaps[0]!.options).toEqual({ imageOrientation: 'from-image' });
  });

  it('falls back to a plain decode when orientation options are unsupported', async () => {
    mock = installImageMock({ rejectOrientation: true });
    const result = await tool.run({ files: [makeFile('photo.jpg', 'image/jpeg')], options: {} });
    expect(result.outputs).toHaveLength(1);
    expect(mock.bitmaps[0]!.options).toBeUndefined();
  });

  it('processes every file in batch mode and reports progress', async () => {
    mock = installImageMock();
    const onProgress = vi.fn();
    const result = await tool.run({
      files: [makeFile('a.png'), makeFile('b.png'), makeFile('c.png')],
      options: {},
      onProgress,
    });
    expect(result.outputs.map((o) => o.filename)).toEqual(['a-min.webp', 'b-min.webp', 'c-min.webp']);
    expect(result.stats?.files).toBe(3);
    expect(onProgress).toHaveBeenCalledWith(1, 'Done');
  });

  it('cancels when the signal is already aborted', async () => {
    mock = installImageMock();
    await expect(
      tool.run({ files: [makeFile('a.png')], options: {}, signal: AbortSignal.abort() }),
    ).rejects.toThrow(/cancelled/i);
  });

  it('rejects an oversized image with a friendly error instead of crashing', async () => {
    mock = installImageMock({ width: 20_000, height: 20_000 });
    await expect(tool.run({ files: [makeFile('huge.png')], options: {} })).rejects.toThrow(ToolError);
    await expect(tool.run({ files: [makeFile('huge.png')], options: {} })).rejects.toThrow(/too large/i);
  });
});
