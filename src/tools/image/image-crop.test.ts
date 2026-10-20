import { afterEach, describe, expect, it, vi } from 'vitest';
import tool, { cropRect } from './image-crop.tool';
import { installImageMock, makeFile, type MockHandle } from './image-mock';

let mock: MockHandle | undefined;
afterEach(() => {
  mock?.restore();
  mock = undefined;
});

describe('cropRect', () => {
  it('calculates center and anchored aspect crops', () => {
    expect(cropRect(400, 200, { mode: 'aspect', aspect: '1:1', anchor: 'center' })).toEqual({
      x: 100,
      y: 0,
      w: 200,
      h: 200,
    });
    expect(cropRect(400, 200, { mode: 'aspect', aspect: '1:1', anchor: 'right' })).toEqual({
      x: 200,
      y: 0,
      w: 200,
      h: 200,
    });
  });
  it('supports every anchor corner', () => {
    expect(cropRect(400, 200, { mode: 'aspect', aspect: '1:1', anchor: 'top-left' })).toEqual({
      x: 0,
      y: 0,
      w: 200,
      h: 200,
    });
    expect(cropRect(400, 200, { mode: 'aspect', aspect: '1:1', anchor: 'bottom-right' })).toEqual({
      x: 200,
      y: 0,
      w: 200,
      h: 200,
    });
  });
  it('floors and clips explicit crop rectangles to image bounds', () => {
    expect(
      cropRect(100, 80, { mode: 'pixels', x: 10.8, y: 5.3, cropWidth: 200, cropHeight: 30.9 }),
    ).toEqual({ x: 10, y: 5, w: 90, h: 30 });
  });
  it('rejects invalid ratios and zero/outside pixel crops', () => {
    expect(() => cropRect(10, 10, { aspect: '0:1' })).toThrow(/valid aspect ratio/i);
    expect(() =>
      cropRect(10, 10, { mode: 'pixels', x: 10, y: 0, cropWidth: 1, cropHeight: 2 }),
    ).toThrow(/outside the image/i);
  });
});

describe('image-crop run', () => {
  it('rejects a selection containing no image', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose an image file/i);
  });

  it('rejects a non-image file', async () => {
    const f = new File(['x'], 'a.txt', { type: 'text/plain' });
    await expect(tool.run({ files: [f], options: {} })).rejects.toThrow(/not an image/i);
  });

  it('reports a friendly error when createImageBitmap is unavailable', async () => {
    await expect(tool.run({ files: [makeFile('a.png')], options: {} })).rejects.toThrow(
      /createImageBitmap/i,
    );
  });

  it('reports a friendly error for undecodable bytes', async () => {
    mock = installImageMock({ failDecode: true });
    await expect(tool.run({ files: [makeFile('bad.png')], options: {} })).rejects.toThrow(
      /could not be decoded/i,
    );
  });

  it('makes a square center crop by default', async () => {
    mock = installImageMock({ width: 400, height: 200 });
    const result = await tool.run({ files: [makeFile('a.png')], options: {} });
    expect(result.outputs[0]!.filename).toBe('a-crop.png');
    expect(result.outputs[0]!.blob.type).toBe('image/png');
    expect(mock.canvases[0]!.width).toBe(200);
    expect(mock.canvases[0]!.height).toBe(200);
    expect(mock.canvases[0]!.draws[0]).toMatchObject({ destW: 200, destH: 200 });
  });

  it('crops an explicit pixel rectangle', async () => {
    mock = installImageMock({ width: 100, height: 80 });
    await tool.run({
      files: [makeFile('a.png')],
      options: { mode: 'pixels', x: 10, y: 5, cropWidth: 50, cropHeight: 30 },
    });
    const draw = mock.canvases[0]!.draws[0]!.args;
    expect(draw.slice(1, 5)).toEqual([10, 5, 50, 30]);
  });

  it('keeps transparency for PNG/WebP output', async () => {
    mock = installImageMock();
    await tool.run({ files: [makeFile('a.png')], options: { format: 'webp' } });
    expect(mock.canvases[0]!.fills).toHaveLength(0);
    expect(mock.canvases[0]!.encodes[0]!.type).toBe('image/webp');
  });

  it('flattens transparency for JPEG output', async () => {
    mock = installImageMock({ width: 400, height: 200 });
    const result = await tool.run({ files: [makeFile('a.png')], options: { format: 'jpeg' } });
    expect(result.outputs[0]!.filename).toBe('a-crop.jpg');
    expect(result.outputs[0]!.blob.type).toBe('image/jpeg');
    expect(mock.canvases[0]!.fills).toEqual([{ x: 0, y: 0, w: 200, h: 200, style: '#ffffff' }]);
  });

  it('rejects an invalid aspect ratio', async () => {
    mock = installImageMock();
    await expect(
      tool.run({ files: [makeFile('a.png')], options: { aspect: 'banana' } }),
    ).rejects.toThrow(/valid aspect ratio/i);
  });

  it('rejects a zero-size pixel crop', async () => {
    mock = installImageMock();
    await expect(
      tool.run({
        files: [makeFile('a.png')],
        options: { mode: 'pixels', x: 0, y: 0, cropWidth: 0, cropHeight: 10 },
      }),
    ).rejects.toThrow(/zero size|outside the image/i);
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

  it('crops every file in batch mode and reports progress', async () => {
    mock = installImageMock({ width: 400, height: 200 });
    const onProgress = vi.fn();
    const result = await tool.run({
      files: [makeFile('a.png'), makeFile('b.png')],
      options: {},
      onProgress,
    });
    expect(result.outputs.map((o) => o.filename)).toEqual(['a-crop.png', 'b-crop.png']);
    expect(result.stats?.files).toBe(2);
    expect(onProgress).toHaveBeenCalledWith(1, 'Done');
  });

  it('cancels when the signal is already aborted', async () => {
    mock = installImageMock();
    await expect(
      tool.run({ files: [makeFile('a.png')], options: {}, signal: AbortSignal.abort() }),
    ).rejects.toThrow(/cancelled/i);
  });

  it('rejects an oversized source image', async () => {
    mock = installImageMock({ width: 20_000, height: 20_000 });
    await expect(tool.run({ files: [makeFile('huge.png')], options: {} })).rejects.toThrow(
      /too large/i,
    );
  });
});
