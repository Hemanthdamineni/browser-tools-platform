import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolError } from '@/lib/types';
import tool, {
  backgroundRgb,
  flattenAlpha,
  hasTransparency,
  outputQuality,
  targetMime,
  uniqueStem,
} from './heic-to-jpg.tool';
import { decodeHeic } from './heic-codec';
import { blobPixels, installImageMock, makeFile, type MockHandle } from './image-mock';

// The WASM decoder cannot run under jsdom, so only `decodeHeic` is replaced.
// Everything else — the batch loop, alpha handling and the canvas encoding —
// is the real implementation.
vi.mock('./heic-codec', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./heic-codec')>();
  return { ...actual, decodeHeic: vi.fn() };
});

const decodeMock = vi.mocked(decodeHeic);

/** A decoded image the mocked decoder hands back. */
function decoded(
  width: number,
  height: number,
  pixels: number[] = [10, 20, 30, 255],
): Awaited<ReturnType<typeof decodeHeic>> {
  return {
    width,
    height,
    data: new Uint8ClampedArray(pixels),
  };
}

let mock: MockHandle | undefined;
beforeEach(() => {
  mock = installImageMock({ pixelOutput: true });
  decodeMock.mockReset();
});
afterEach(() => {
  mock?.restore();
  mock = undefined;
});

describe('targetMime', () => {
  it('accepts the supported output formats', () => {
    expect(targetMime('jpeg')).toBe('image/jpeg');
    expect(targetMime('png')).toBe('image/png');
    expect(targetMime('webp')).toBe('image/webp');
  });
  it('defaults to JPEG', () => {
    expect(targetMime(undefined)).toBe('image/jpeg');
  });
  it('rejects an unsupported format', () => {
    expect(() => targetMime('avif')).toThrow(/not a supported output format/i);
    expect(() => targetMime('avif')).toThrow(ToolError);
  });
});

describe('backgroundRgb', () => {
  it('parses 3- and 6-digit hex colours', () => {
    expect(backgroundRgb('#ff0000')).toEqual([255, 0, 0]);
    expect(backgroundRgb('#0f0')).toEqual([0, 255, 0]);
  });
  it('rejects anything that is not a hex colour', () => {
    expect(() => backgroundRgb('blue')).toThrow(/hex colour/i);
  });
});

describe('outputQuality', () => {
  it('turns a percentage into a ratio', () => {
    expect(outputQuality(90)).toBeCloseTo(0.9);
    expect(outputQuality(10)).toBeCloseTo(0.1);
  });
  it('clamps out-of-range values', () => {
    expect(outputQuality(0)).toBeCloseTo(0.1);
    expect(outputQuality(1000)).toBeCloseTo(1);
  });
  it('falls back to 90% for nonsense', () => {
    expect(outputQuality('abc')).toBeCloseTo(0.9);
  });
});

describe('hasTransparency', () => {
  it('spots a semi-transparent pixel', () => {
    expect(hasTransparency(new Uint8ClampedArray([1, 2, 3, 128]))).toBe(true);
  });
  it('reports fully opaque data as opaque', () => {
    expect(hasTransparency(new Uint8ClampedArray([1, 2, 3, 255]))).toBe(false);
  });
  it('reports an empty buffer as opaque', () => {
    expect(hasTransparency(new Uint8ClampedArray(0))).toBe(false);
  });
});

describe('flattenAlpha', () => {
  it('blends a semi-transparent pixel onto the background', () => {
    const out = flattenAlpha(new Uint8ClampedArray([255, 0, 0, 128]), [255, 255, 255]);
    expect([...out]).toEqual([255, 127, 127, 255]);
  });
  it('leaves opaque pixels alone', () => {
    const out = flattenAlpha(new Uint8ClampedArray([10, 20, 30, 255]), [0, 0, 0]);
    expect([...out]).toEqual([10, 20, 30, 255]);
  });
  it('returns the same buffer when nothing is transparent', () => {
    const data = new Uint8ClampedArray([10, 20, 30, 255]);
    expect(flattenAlpha(data, [0, 0, 0])).toBe(data);
  });
  it('does not modify the input buffer', () => {
    const data = new Uint8ClampedArray([255, 0, 0, 128]);
    flattenAlpha(data, [0, 0, 0]);
    expect([...data]).toEqual([255, 0, 0, 128]);
  });
  it('makes a fully transparent pixel take the background colour', () => {
    const out = flattenAlpha(new Uint8ClampedArray([255, 0, 0, 0]), [0, 128, 255]);
    expect([...out]).toEqual([0, 128, 255, 255]);
  });
});

describe('uniqueStem', () => {
  it('keeps the first name', () => {
    const used = new Set<string>();
    expect(uniqueStem('photo', used)).toBe('photo');
  });
  it('suffixes a colliding name', () => {
    const used = new Set<string>();
    uniqueStem('photo', used);
    expect(uniqueStem('photo', used)).toBe('photo-2');
    expect(uniqueStem('photo', used)).toBe('photo-3');
  });
  it('does not collide with a name that already ends in -2', () => {
    const used = new Set<string>();
    uniqueStem('photo', used);
    uniqueStem('photo', used);
    expect(uniqueStem('photo-2', used)).toBe('photo-2-2');
  });
});

describe('heic-to-jpg run', () => {
  it('rejects an empty selection', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/choose a heic image/i);
  });

  it('rejects an unsupported output format before decoding', async () => {
    await expect(
      tool.run({ files: [makeFile('a.heic', 'image/heic')], options: { to: 'avif' } }),
    ).rejects.toThrow(/not a supported output format/i);
    expect(decodeMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid JPEG background colour', async () => {
    await expect(
      tool.run({ files: [makeFile('a.heic', 'image/heic')], options: { background: 'nope' } }),
    ).rejects.toThrow(/hex colour/i);
  });

  it('converts a HEIC to JPEG by default', async () => {
    decodeMock.mockResolvedValue(
      decoded(2, 2, [1, 2, 3, 255, 4, 5, 6, 255, 7, 8, 9, 255, 1, 1, 1, 255]),
    );
    const result = await tool.run({ files: [makeFile('photo.heic', 'image/heic')], options: {} });
    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]!.filename).toBe('photo.jpg');
    expect(result.outputs[0]!.blob.type).toBe('image/jpeg');
    expect(mock!.canvases[0]!.encodes[0]!.type).toBe('image/jpeg');
    expect(result.stats?.converted).toBe(1);
  });

  it('converts to PNG on request', async () => {
    decodeMock.mockResolvedValue(decoded(1, 1));
    const result = await tool.run({
      files: [makeFile('photo.heic', 'image/heic')],
      options: { to: 'png' },
    });
    expect(result.outputs[0]!.filename).toBe('photo.png');
    expect(result.outputs[0]!.blob.type).toBe('image/png');
  });

  it('converts to WebP on request', async () => {
    decodeMock.mockResolvedValue(decoded(1, 1));
    const result = await tool.run({
      files: [makeFile('photo.heic', 'image/heic')],
      options: { to: 'webp' },
    });
    expect(result.outputs[0]!.filename).toBe('photo.webp');
    expect(result.outputs[0]!.blob.type).toBe('image/webp');
  });

  it('passes the chosen quality to the encoder', async () => {
    decodeMock.mockResolvedValue(decoded(1, 1));
    await tool.run({ files: [makeFile('photo.heic', 'image/heic')], options: { quality: 55 } });
    expect(mock!.canvases[0]!.encodes[0]!.quality).toBeCloseTo(0.55);
  });

  it('hands the decoded bytes to the decoder', async () => {
    decodeMock.mockResolvedValue(decoded(1, 1));
    const file = new File([new Uint8Array([1, 2, 3, 4])], 'photo.heic', { type: 'image/heic' });
    await tool.run({ files: [file], options: {} });
    expect(decodeMock).toHaveBeenCalledTimes(1);
    const bytes = decodeMock.mock.calls[0]![0] as Uint8Array;
    expect([...bytes]).toEqual([1, 2, 3, 4]);
  });

  it('keeps the alpha channel for PNG', async () => {
    decodeMock.mockResolvedValue(decoded(1, 1, [255, 0, 0, 128]));
    await tool.run({ files: [makeFile('logo.heic', 'image/heic')], options: { to: 'png' } });
    expect([...mock!.canvases[0]!.pixels]).toEqual([255, 0, 0, 128]);
  });

  it('keeps the alpha channel for WebP', async () => {
    decodeMock.mockResolvedValue(decoded(1, 1, [255, 0, 0, 128]));
    await tool.run({ files: [makeFile('logo.heic', 'image/heic')], options: { to: 'webp' } });
    expect([...mock!.canvases[0]!.pixels]).toEqual([255, 0, 0, 128]);
  });

  it('flattens transparency onto white for JPEG', async () => {
    decodeMock.mockResolvedValue(decoded(1, 1, [255, 0, 0, 128]));
    await tool.run({ files: [makeFile('logo.heic', 'image/heic')], options: { to: 'jpeg' } });
    expect([...mock!.canvases[0]!.pixels]).toEqual([255, 127, 127, 255]);
  });

  it('flattens JPEG onto the requested background colour', async () => {
    decodeMock.mockResolvedValue(decoded(1, 1, [255, 0, 0, 128]));
    await tool.run({
      files: [makeFile('logo.heic', 'image/heic')],
      options: { to: 'jpeg', background: '#000000' },
    });
    expect([...mock!.canvases[0]!.pixels]).toEqual([128, 0, 0, 255]);
  });

  it('keeps the pixels of an opaque image untouched for PNG', async () => {
    decodeMock.mockResolvedValue(decoded(2, 1, [10, 20, 30, 255, 40, 50, 60, 255]));
    const result = await tool.run({
      files: [makeFile('photo.heic', 'image/heic')],
      options: { to: 'png' },
    });
    // The encoded blob carries exactly the pixels the decoder produced.
    const pixels = await blobPixels(result.outputs[0]!.blob);
    expect([...pixels]).toEqual([10, 20, 30, 255, 40, 50, 60, 255]);
  });

  it('notes when transparency was flattened', async () => {
    decodeMock.mockResolvedValue(decoded(1, 1, [255, 0, 0, 128]));
    const result = await tool.run({
      files: [makeFile('logo.heic', 'image/heic')],
      options: { to: 'jpeg' },
    });
    expect(result.notes?.join(' ')).toMatch(/transparency/i);
  });

  it('does not mention flattening when the image is opaque', async () => {
    decodeMock.mockResolvedValue(decoded(1, 1, [255, 0, 0, 255]));
    const result = await tool.run({
      files: [makeFile('logo.heic', 'image/heic')],
      options: { to: 'jpeg' },
    });
    expect(result.notes?.join(' ') ?? '').not.toMatch(/transparency/i);
  });

  it('keeps Unicode file names', async () => {
    decodeMock.mockResolvedValue(decoded(1, 1));
    const result = await tool.run({
      files: [makeFile('照片 🌇.heic', 'image/heic')],
      options: {},
    });
    expect(result.outputs[0]!.filename).toBe('照片 🌇.jpg');
  });

  it('gives two files with the same name different outputs', async () => {
    decodeMock.mockResolvedValue(decoded(1, 1));
    const result = await tool.run({
      files: [makeFile('photo.heic', 'image/heic'), makeFile('photo.heif', 'image/heif')],
      options: {},
    });
    expect(result.outputs.map((o) => o.filename)).toEqual(['photo.jpg', 'photo-2.jpg']);
  });

  it('reports one clear error per file and keeps the good ones', async () => {
    decodeMock
      .mockResolvedValueOnce(decoded(1, 1))
      .mockRejectedValueOnce(new ToolError('That file is not a HEIC or HEIF image.'));
    const result = await tool.run({
      files: [makeFile('good.heic', 'image/heic'), makeFile('bad.heic', 'image/heic')],
      options: {},
    });
    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]!.filename).toBe('good.jpg');
    expect(result.warnings?.join(' ')).toMatch(/not a HEIC or HEIF image/i);
    expect(result.stats?.failed).toBe(1);

    const report = JSON.parse(result.report!.output) as {
      headers: string[];
      rows: string[][];
    };
    expect(report.headers).toEqual(['File', 'Output', 'Dimensions', 'Status']);
    expect(report.rows).toHaveLength(2);
    expect(report.rows[1]![0]).toBe('bad.heic');
    expect(report.rows[1]![3]).toMatch(/Failed/);
  });

  it('fails loudly when every file fails', async () => {
    decodeMock.mockRejectedValue(new ToolError('That file is not a HEIC or HEIF image.'));
    await expect(
      tool.run({ files: [makeFile('bad.heic', 'image/heic')], options: {} }),
    ).rejects.toThrow(/not a HEIC or HEIF image/i);
  });

  it('reports a file that is too large to decode', async () => {
    const big = new File([new Uint8Array(1)], 'huge.heic', { type: 'image/heic' });
    Object.defineProperty(big, 'size', { value: 65 * 1024 * 1024 });
    await expect(tool.run({ files: [big], options: {} })).rejects.toThrow(/too large/i);
    expect(decodeMock).not.toHaveBeenCalled();
  });

  it('accepts a file that is exactly at the size limit', async () => {
    decodeMock.mockResolvedValue(decoded(1, 1));
    const edge = new File([new Uint8Array(1)], 'edge.heic', { type: 'image/heic' });
    Object.defineProperty(edge, 'size', { value: 64 * 1024 * 1024 });
    const result = await tool.run({ files: [edge], options: {} });
    expect(result.outputs).toHaveLength(1);
  });

  it('rejects an image with an unusable size', async () => {
    decodeMock.mockResolvedValue(decoded(20_000, 20_000));
    await expect(
      tool.run({ files: [makeFile('huge.heic', 'image/heic')], options: {} }),
    ).rejects.toThrow(/too large/i);
  });

  it('cancels when the signal is already aborted', async () => {
    decodeMock.mockResolvedValue(decoded(1, 1));
    await expect(
      tool.run({
        files: [makeFile('a.heic', 'image/heic')],
        options: {},
        signal: AbortSignal.abort(),
      }),
    ).rejects.toThrow(/cancelled/i);
  });

  it('stops the batch when the run is cancelled', async () => {
    const controller = new AbortController();
    decodeMock.mockImplementation(async () => {
      controller.abort();
      return decoded(1, 1);
    });
    await expect(
      tool.run({
        files: [makeFile('a.heic', 'image/heic'), makeFile('b.heic', 'image/heic')],
        options: {},
        signal: controller.signal,
      }),
    ).rejects.toThrow(/cancelled/i);
    expect(decodeMock).toHaveBeenCalledTimes(1);
  });

  it('reports progress while decoding a batch', async () => {
    decodeMock.mockResolvedValue(decoded(1, 1));
    const onProgress = vi.fn();
    const result = await tool.run({
      files: [makeFile('a.heic', 'image/heic'), makeFile('b.heic', 'image/heic')],
      options: {},
      onProgress,
    });
    expect(result.outputs).toHaveLength(2);
    expect(onProgress).toHaveBeenCalledWith(0, expect.stringMatching(/decoder/i));
    expect(onProgress).toHaveBeenCalledWith(1, 'Done');
  });

  it('reports the number of files and the size saved', async () => {
    decodeMock.mockResolvedValue(decoded(1, 1));
    const result = await tool.run({
      files: [makeFile('a.heic', 'image/heic'), makeFile('b.heic', 'image/heic')],
      options: {},
    });
    expect(result.stats?.files).toBe(2);
    expect(result.stats?.converted).toBe(2);
    expect(result.stats?.failed).toBe(0);
    expect(result.stats?.originalBytes).toBe(400);
    expect(result.stats?.format).toBe('image/jpeg');
  });
});
