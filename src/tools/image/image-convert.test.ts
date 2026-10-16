import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToolError } from '@/lib/types';
import tool, { backgroundColor, convertMime, imageOutputType } from './image-convert.tool';
import { installImageMock, makeFile, type MockHandle } from './image-mock';

let mock: MockHandle | undefined;
afterEach(() => {
  mock?.restore();
  mock = undefined;
});

describe('imageOutputType', () => {
  it('returns the canvas MIME type unchanged', () => {
    expect(imageOutputType('image/webp')).toBe('image/webp');
  });
});

describe('convertMime', () => {
  it('accepts the supported formats', () => {
    expect(convertMime('png')).toBe('image/png');
    expect(convertMime('jpeg')).toBe('image/jpeg');
    expect(convertMime('webp')).toBe('image/webp');
    expect(convertMime('avif')).toBe('image/avif');
  });
  it('rejects an unsupported format', () => {
    expect(() => convertMime('gif')).toThrow(/not a supported output format/i);
  });
});

describe('backgroundColor', () => {
  it('parses 3- and 6-digit hex colours', () => {
    expect(backgroundColor('#ff0000')).toBe('rgb(255, 0, 0)');
    expect(backgroundColor('#0f0')).toBe('rgb(0, 255, 0)');
  });
  it('rejects anything that is not a hex colour', () => {
    expect(() => backgroundColor('blue')).toThrow(ToolError);
    expect(() => backgroundColor('blue')).toThrow(/hex colour/i);
  });
});

describe('image-convert run', () => {
  it('rejects an empty selection', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose an image file/i);
  });

  it('rejects non-image files before decoding', async () => {
    const file = new File(['x'], 'note.txt', { type: 'text/plain' });
    await expect(tool.run({ files: [file], options: {} })).rejects.toThrow(/not an image/i);
  });

  it('reports a friendly error when createImageBitmap is unavailable', async () => {
    await expect(tool.run({ files: [makeFile('image.png')], options: {} })).rejects.toThrow(/createImageBitmap/i);
  });

  it('reports a friendly error for undecodable bytes', async () => {
    mock = installImageMock({ failDecode: true });
    await expect(tool.run({ files: [makeFile('bad.png')], options: {} })).rejects.toThrow(/could not be decoded/i);
  });

  it('converts to WebP by default, keeping transparency', async () => {
    mock = installImageMock();
    const result = await tool.run({ files: [makeFile('photo.png')], options: {} });
    expect(result.outputs[0]!.filename).toBe('photo.webp');
    expect(result.outputs[0]!.blob.type).toBe('image/webp');
    expect(mock.canvases[0]!.fills).toHaveLength(0);
  });

  it('converts to PNG with alpha intact', async () => {
    mock = installImageMock();
    const result = await tool.run({ files: [makeFile('photo.jpg', 'image/jpeg')], options: { to: 'png' } });
    expect(result.outputs[0]!.blob.type).toBe('image/png');
    expect(mock.canvases[0]!.fills).toHaveLength(0);
  });

  it('flattens transparency onto white for JPEG by default', async () => {
    mock = installImageMock({ width: 30, height: 10 });
    const result = await tool.run({ files: [makeFile('logo.png')], options: { to: 'jpeg' } });
    expect(result.outputs[0]!.filename).toBe('logo.jpg');
    expect(result.outputs[0]!.blob.type).toBe('image/jpeg');
    expect(mock.canvases[0]!.fills).toEqual([{ x: 0, y: 0, w: 30, h: 10, style: 'rgb(255, 255, 255)' }]);
  });

  it('flattens JPEG onto the requested background colour', async () => {
    mock = installImageMock();
    await tool.run({ files: [makeFile('logo.png')], options: { to: 'jpeg', background: '#123456' } });
    expect(mock.canvases[0]!.fills[0]!.style).toBe('rgb(18, 52, 86)');
  });

  it('rejects an invalid JPEG background colour', async () => {
    mock = installImageMock();
    await expect(tool.run({ files: [makeFile('logo.png')], options: { to: 'jpeg', background: 'nope' } })).rejects.toThrow(
      /hex colour/i,
    );
  });

  it('rejects an unsupported target format', async () => {
    mock = installImageMock();
    await expect(tool.run({ files: [makeFile('a.png')], options: { to: 'gif' } })).rejects.toThrow(/supported output format/i);
  });

  it('converts to AVIF when the browser supports it', async () => {
    mock = installImageMock();
    const result = await tool.run({ files: [makeFile('photo.png')], options: { to: 'avif' } });
    expect(result.outputs[0]!.filename).toBe('photo.avif');
    expect(result.outputs[0]!.blob.type).toBe('image/avif');
  });

  it('reports a friendly error when the browser cannot encode the format', async () => {
    mock = installImageMock({ supports: ['image/png', 'image/jpeg', 'image/webp'] });
    await expect(tool.run({ files: [makeFile('photo.png')], options: { to: 'avif' } })).rejects.toThrow(/cannot encode AVIF/i);
  });

  it('passes the chosen quality to the encoder', async () => {
    mock = installImageMock();
    await tool.run({ files: [makeFile('photo.png')], options: { to: 'webp', quality: 55 } });
    expect(mock.canvases[0]!.encodes[0]!.quality).toBeCloseTo(0.55);
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

  it('converts every file in batch mode and reports progress', async () => {
    mock = installImageMock();
    const onProgress = vi.fn();
    const result = await tool.run({
      files: [makeFile('a.png'), makeFile('b.jpg', 'image/jpeg')],
      options: { to: 'png' },
      onProgress,
    });
    expect(result.outputs.map((o) => o.filename)).toEqual(['a.png', 'b.png']);
    expect(result.stats?.files).toBe(2);
    expect(onProgress).toHaveBeenCalledWith(1, 'Done');
  });

  it('cancels when the signal is already aborted', async () => {
    mock = installImageMock();
    await expect(tool.run({ files: [makeFile('a.png')], options: {}, signal: AbortSignal.abort() })).rejects.toThrow(
      /cancelled/i,
    );
  });

  it('rejects an oversized image with a friendly error', async () => {
    mock = installImageMock({ width: 20_000, height: 20_000 });
    await expect(tool.run({ files: [makeFile('huge.png')], options: {} })).rejects.toThrow(/too large/i);
  });
});
