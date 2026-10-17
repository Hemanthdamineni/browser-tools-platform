import { afterEach, describe, expect, it, vi } from 'vitest';
import tool, { flipScale, normalizeRotation, outputSize } from './image-rotate.tool';
import { installImageMock, makeFile, type MockHandle } from './image-mock';

let mock: MockHandle | undefined;
afterEach(() => {
  mock?.restore();
  mock = undefined;
});

const png = (name = 'photo.png') => makeFile(name, 'image/png');
const jpg = (name = 'photo.jpg') => makeFile(name, 'image/jpeg');

describe('normalizeRotation', () => {
  it('accepts numbers and numeric strings', () => {
    expect(normalizeRotation(0)).toBe(0);
    expect(normalizeRotation('90')).toBe(90);
    expect(normalizeRotation(180)).toBe(180);
    expect(normalizeRotation('270')).toBe(270);
  });

  it('normalises out-of-range multiples of 90 into [0, 360)', () => {
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(450)).toBe(90);
    expect(normalizeRotation(360)).toBe(0);
    expect(normalizeRotation('720')).toBe(0);
  });

  it('rejects non-multiples and non-numbers with a ToolError', () => {
    expect(() => normalizeRotation(45)).toThrow(/multiple of 90/i);
    expect(() => normalizeRotation('abc')).toThrow(/not a number/i);
    expect(() => normalizeRotation(undefined)).toThrow(/not a number/i);
    expect(() => normalizeRotation(Number.NaN)).toThrow(/not a number/i);
  });
});

describe('outputSize', () => {
  it('swaps dimensions for 90/270 degree rotation', () => {
    expect(outputSize(200, 100, '90')).toEqual({ w: 100, h: 200 });
    expect(outputSize(200, 100, 270)).toEqual({ w: 100, h: 200 });
  });

  it('keeps dimensions for 0/180 rotation', () => {
    expect(outputSize(200, 100, 0)).toEqual({ w: 200, h: 100 });
    expect(outputSize(200, 100, '180')).toEqual({ w: 200, h: 100 });
  });

  it('round-trips: two quarter turns restore the original dimensions', () => {
    const first = outputSize(400, 300, '90');
    const second = outputSize(first.w, first.h, '90');
    expect(second).toEqual({ w: 400, h: 300 });
  });

  it('round-trips: 180 + 180 is the identity', () => {
    const first = outputSize(123, 45, '180');
    expect(outputSize(first.w, first.h, '180')).toEqual({ w: 123, h: 45 });
  });
});

describe('flipScale', () => {
  it('maps each flip option to a scale about the centre', () => {
    expect(flipScale('none')).toEqual({ x: 1, y: 1 });
    expect(flipScale('horizontal')).toEqual({ x: -1, y: 1 });
    expect(flipScale('vertical')).toEqual({ x: 1, y: -1 });
    expect(flipScale('both')).toEqual({ x: -1, y: -1 });
    expect(flipScale(undefined)).toEqual({ x: 1, y: 1 });
  });

  it('round-trips: flipping twice is the identity', () => {
    for (const flip of ['horizontal', 'vertical', 'both'] as const) {
      const once = flipScale(flip);
      const twice = { x: once.x * once.x, y: once.y * once.y };
      expect(twice).toEqual({ x: 1, y: 1 });
    }
  });
});

describe('image-rotate run', () => {
  it('rotates by 0° by default and names the output after the source', async () => {
    mock = installImageMock({ width: 4, height: 2 });
    const result = await tool.run({ files: [png()], options: {} });

    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]!.filename).toBe('photo-rotated.png');
    expect(result.outputs[0]!.blob.type).toBe('image/png');

    const canvas = mock.canvases[0]!;
    expect(canvas.width).toBe(4);
    expect(canvas.height).toBe(2);
    const draw = canvas.draws[0]!;
    expect(draw.transform!.rotate).toBe(0);
    expect(draw.transform!.scale).toEqual([1, 1]);
    // Drawn about the centre: top-left is (-w/2, -h/2).
    expect(draw.args.slice(1)).toEqual([-2, -1]);
  });

  it('swaps the canvas and rotates clockwise for 90°', async () => {
    mock = installImageMock({ width: 4, height: 2 });
    const result = await tool.run({ files: [png()], options: { rotate: '90' } });

    expect(result.outputs[0]!.filename).toBe('photo-rotated.png');
    const canvas = mock.canvases[0]!;
    expect(canvas.width).toBe(2);
    expect(canvas.height).toBe(4);
    expect(canvas.draws[0]!.transform!.rotate).toBeCloseTo(Math.PI / 2);
    expect(canvas.draws[0]!.transform!.translate).toEqual([1, 2]);
  });

  it('handles 180° and 270° rotation', async () => {
    mock = installImageMock({ width: 4, height: 2 });
    await tool.run({ files: [png('a.png')], options: { rotate: '180' } });
    expect(mock.canvases[0]!.draws[0]!.transform!.rotate).toBeCloseTo(Math.PI);
    expect(mock.canvases[0]!.width).toBe(4);
    expect(mock.canvases[0]!.height).toBe(2);
    mock.restore();

    mock = installImageMock({ width: 4, height: 2 });
    await tool.run({ files: [png('a.png')], options: { rotate: '270' } });
    expect(mock.canvases[0]!.draws[0]!.transform!.rotate).toBeCloseTo((3 * Math.PI) / 2);
    expect(mock.canvases[0]!.width).toBe(2);
    expect(mock.canvases[0]!.height).toBe(4);
  });

  it('applies each flip option as a centre scale', async () => {
    for (const [flip, expected] of [
      ['none', [1, 1]],
      ['horizontal', [-1, 1]],
      ['vertical', [1, -1]],
      ['both', [-1, -1]],
    ] as const) {
      mock = installImageMock();
      await tool.run({ files: [png('a.png')], options: { flip } });
      expect(mock.canvases[0]!.draws[0]!.transform!.scale).toEqual(expected);
      mock.restore();
    }
  });

  it('supports every output format option', async () => {
    for (const [format, ext, mime] of [
      ['png', 'png', 'image/png'],
      ['jpeg', 'jpg', 'image/jpeg'],
      ['webp', 'webp', 'image/webp'],
    ] as const) {
      mock = installImageMock();
      const result = await tool.run({ files: [png('photo.png')], options: { rotate: '90', format } });
      expect(result.outputs[0]!.filename).toBe(`photo-rotated.${ext}`);
      expect(result.outputs[0]!.blob.type).toBe(mime);
      mock.restore();
    }
  });

  it('keeps the source format when "original" is selected', async () => {
    mock = installImageMock();
    const result = await tool.run({ files: [jpg('pic.jpg')], options: { format: 'original' } });
    expect(result.outputs[0]!.filename).toBe('pic-rotated.jpg');
    expect(result.outputs[0]!.blob.type).toBe('image/jpeg');
  });

  it('flattens transparency onto white for JPEG output', async () => {
    mock = installImageMock({ width: 4, height: 2 });
    await tool.run({ files: [png('a.png')], options: { rotate: '90', format: 'jpeg' } });
    expect(mock.canvases[0]!.fills).toEqual([{ x: 0, y: 0, w: 2, h: 4, style: '#ffffff' }]);
  });

  it.each(['png', 'webp'] as const)('keeps alpha and does not flatten for %s output', async (format) => {
    mock = installImageMock({ width: 4, height: 2 });
    await tool.run({ files: [png('a.png')], options: { format } });
    expect(mock.canvases[0]!.fills).toHaveLength(0);
  });

  it('requests EXIF orientation while decoding', async () => {
    mock = installImageMock();
    await tool.run({ files: [jpg('photo.jpg')], options: {} });
    expect(mock.bitmaps[0]!.options).toEqual({ imageOrientation: 'from-image' });
  });

  it('falls back to a plain decode when orientation options are unsupported', async () => {
    mock = installImageMock({ rejectOrientation: true });
    const result = await tool.run({ files: [jpg('photo.jpg')], options: {} });
    expect(result.outputs).toHaveLength(1);
    expect(mock.bitmaps[0]!.options).toBeUndefined();
  });

  it('processes every file in batch mode, preserving order and reporting progress', async () => {
    mock = installImageMock();
    const onProgress = vi.fn();
    const result = await tool.run({
      files: [png('a.png'), png('b.png'), png('c.png')],
      options: { rotate: '90' },
      onProgress,
    });
    expect(result.outputs.map((o) => o.filename)).toEqual([
      'a-rotated.png',
      'b-rotated.png',
      'c-rotated.png',
    ]);
    expect(result.stats).toMatchObject({ files: 3 });
    expect(onProgress).toHaveBeenCalledWith(1, 'Done');
    expect(onProgress).toHaveBeenCalledWith(0, 'Rotating a.png');
  });

  it('keeps Unicode filenames intact', async () => {
    mock = installImageMock();
    const result = await tool.run({ files: [png('фото-日本語.png')], options: {} });
    expect(result.outputs[0]!.filename).toBe('фото-日本語-rotated.png');
  });

  it('closes each decoded bitmap', async () => {
    mock = installImageMock();
    await tool.run({ files: [png('a.png'), png('b.png')], options: {} });
    expect(mock.bitmaps.map((b) => b.closed)).toEqual([true, true]);
  });

  it('rejects an empty selection', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose an image file/i);
  });

  it('rejects a non-image file', async () => {
    const txt = new File(['x'], 'a.txt', { type: 'text/plain' });
    await expect(tool.run({ files: [txt], options: {} })).rejects.toThrow(/not an image/i);
  });

  it('rejects an invalid rotation angle before touching pixels', async () => {
    mock = installImageMock();
    await expect(tool.run({ files: [png()], options: { rotate: '45' } })).rejects.toThrow(
      /multiple of 90/i,
    );
    expect(mock.bitmaps).toHaveLength(0);
  });

  it('surfaces a friendly error when the image cannot be decoded', async () => {
    mock = installImageMock({ failDecode: true });
    await expect(tool.run({ files: [makeFile('bad.png')], options: {} })).rejects.toThrow(
      /could not be decoded/i,
    );
  });

  it('surfaces a friendly error when the browser cannot encode the target format', async () => {
    mock = installImageMock({ supports: ['image/png'] });
    await expect(tool.run({ files: [png()], options: { format: 'webp' } })).rejects.toThrow(
      /cannot encode webp/i,
    );
  });

  it('honours an aborted signal', async () => {
    mock = installImageMock();
    await expect(
      tool.run({ files: [png()], options: {}, signal: AbortSignal.abort() }),
    ).rejects.toThrow(/cancel/i);
  });

  it('rejects an oversized source image with a friendly error instead of crashing', async () => {
    mock = installImageMock({ width: 20_000, height: 20_000 });
    await expect(tool.run({ files: [makeFile('huge.png')], options: {} })).rejects.toThrow(
      /too large/i,
    );
  });
});
