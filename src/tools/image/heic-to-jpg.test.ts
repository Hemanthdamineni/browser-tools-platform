import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolError } from '@/lib/types';
import tool, {
  MAX_FILE_BYTES,
  MAX_PIXELS,
  checkHeicFile,
  compositeOntoBackground,
  fitWithin,
  isHeicLike,
  outputFilename,
  primaryIndex,
  resolveFormat,
  resolveQuality,
} from './heic-to-jpg.tool';
import type { FileRunResult, OptionValues } from '@/lib/types';

/* -------------------------------------------------------------------------- */
/*  Browser mocks                                                             */
/*                                                                           */
/*  The real decoder is a ~700 KB WebAssembly module that needs WebAssembly,  */
/*  OffscreenCanvas and a worker — none of which jsdom has. We mock the        */
/*  decoder module and OffscreenCanvas so the whole `run()` pipeline           */
/*  (decode → composite → resize → encode) is covered, and record every       */
/*  canvas call so the assertions are about real behaviour, not smoke.        */
/* -------------------------------------------------------------------------- */

const state = vi.hoisted(() => ({
  /** How many still images the fake container reports. */
  imageCount: 1,
  /** Byte size the fake encoder produces, so file-size warnings can be driven. */
  outputBytes: 8,
  /** Make the fake encoder report a different MIME type than requested. */
  forceMimeMismatch: false,
  convertCalls: [] as { type: string; quality: number | undefined }[],
  canvasSizes: [] as { width: number; height: number }[],
  /** RGBA written via `putImageData`, one entry per source canvas. */
  puts: [] as Uint8ClampedArray[],
  drawArgs: [] as number[][],
}));

vi.mock('libheif-js/libheif-wasm/libheif-bundle.mjs', () => ({
  default: async () => ({
    HeifDecoder: class {
      decode() {
        const makeImage = (primary: boolean) => ({
          get_width: () => 4,
          get_height: () => 2,
          has_alpha_channel: () => true,
          is_primary: () => primary,
          free: () => {},
          display: (target: { data: Uint8ClampedArray }, callback: (result: unknown) => void) => {
            target.data.fill(0);
            target.data[0] = 255; // pixel 0: semi-transparent red
            target.data[3] = 128;
            target.data[7] = 255; // pixel 1: opaque black
            callback(target);
          },
        });
        return Array.from({ length: state.imageCount }, (_, i) => makeImage(i === 0));
      }
    },
  }),
}));

class FakeOffscreenCanvas {
  readonly width: number;
  readonly height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    state.canvasSizes.push({ width, height });
  }

  getContext() {
    return {
      createImageData: (w: number, h: number) => ({
        width: w,
        height: h,
        data: new Uint8ClampedArray(w * h * 4),
      }),
      putImageData: (image: { data: Uint8ClampedArray }) => {
        state.puts.push(image.data);
      },
      drawImage: (_source: unknown, ...args: number[]) => {
        state.drawArgs.push(args);
      },
    };
  }

  convertToBlob(options: { type: string; quality?: number }) {
    state.convertCalls.push({ type: options.type, quality: options.quality });
    const type = state.forceMimeMismatch ? 'image/png' : options.type;
    return Promise.resolve(new Blob([new Uint8Array(state.outputBytes)], { type }));
  }
}

beforeEach(() => {
  state.imageCount = 1;
  state.outputBytes = 8;
  state.forceMimeMismatch = false;
  state.convertCalls = [];
  state.canvasSizes = [];
  state.puts = [];
  state.drawArgs = [];
  vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const heicFile = (name = 'IMG_0001.heic', bytes = 16) =>
  new File([new Uint8Array(bytes)], name, { type: 'image/heic' });

async function runOnce(
  options: OptionValues = {},
  files: File[] = [heicFile()],
  signal?: AbortSignal,
): Promise<FileRunResult> {
  return tool.run({ files, options, signal });
}

/* -------------------------------------------------------------------------- */
/*  resolveFormat                                                             */
/* -------------------------------------------------------------------------- */

describe('resolveFormat', () => {
  it('maps every offered format to its MIME type and extension', () => {
    expect(resolveFormat('jpeg')).toEqual({ mime: 'image/jpeg', extension: 'jpg' });
    expect(resolveFormat('png')).toEqual({ mime: 'image/png', extension: 'png' });
    expect(resolveFormat('webp')).toEqual({ mime: 'image/webp', extension: 'webp' });
  });

  it('treats "jpg" as JPEG and ignores case and surrounding whitespace', () => {
    expect(resolveFormat('jpg')).toEqual({ mime: 'image/jpeg', extension: 'jpg' });
    expect(resolveFormat('  WEBP ')).toEqual({ mime: 'image/webp', extension: 'webp' });
  });

  it('defaults to JPEG when no value is supplied', () => {
    expect(resolveFormat(undefined)).toEqual({ mime: 'image/jpeg', extension: 'jpg' });
  });

  it('rejects an unknown format with a ToolError', () => {
    expect(() => resolveFormat('gif')).toThrow(ToolError);
    expect(() => resolveFormat('gif')).toThrow(/not a supported output format/i);
  });
});

/* -------------------------------------------------------------------------- */
/*  resolveQuality                                                            */
/* -------------------------------------------------------------------------- */

describe('resolveQuality', () => {
  it('converts a percentage to the canvas 0–1 range', () => {
    expect(resolveQuality(90, 'image/jpeg')).toBe(0.9);
    expect(resolveQuality(50, 'image/webp')).toBe(0.5);
    expect(resolveQuality(33, 'image/jpeg')).toBe(0.33);
  });

  it('returns undefined for lossless PNG', () => {
    expect(resolveQuality(90, 'image/png')).toBeUndefined();
  });

  it('clamps out-of-range and non-finite values', () => {
    expect(resolveQuality(250, 'image/jpeg')).toBe(1);
    expect(resolveQuality(0, 'image/jpeg')).toBe(0.01);
    expect(resolveQuality(Number.NaN, 'image/jpeg')).toBe(0.9);
    expect(resolveQuality('not a number', 'image/jpeg')).toBe(0.9);
  });
});

/* -------------------------------------------------------------------------- */
/*  fitWithin                                                                 */
/* -------------------------------------------------------------------------- */

describe('fitWithin', () => {
  it('scales the longest edge down to the limit, preserving aspect ratio', () => {
    expect(fitWithin(4000, 3000, 2000)).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin(1000, 500, 400)).toEqual({ width: 400, height: 200 });
  });

  it('keeps the original size when the limit is 0 or missing', () => {
    expect(fitWithin(4000, 3000, 0)).toEqual({ width: 4000, height: 3000 });
    expect(fitWithin(4000, 3000, undefined)).toEqual({ width: 4000, height: 3000 });
  });

  it('never upscales an image smaller than the limit', () => {
    expect(fitWithin(500, 400, 2000)).toEqual({ width: 500, height: 400 });
  });

  it('never produces a zero dimension', () => {
    expect(fitWithin(10_000, 1, 2)).toEqual({ width: 2, height: 1 });
  });

  it('rejects invalid source dimensions', () => {
    expect(() => fitWithin(Number.NaN, 100, 0)).toThrow(/invalid dimensions/i);
    expect(() => fitWithin(100, 0, 0)).toThrow(/invalid dimensions/i);
  });
});

/* -------------------------------------------------------------------------- */
/*  outputFilename                                                            */
/* -------------------------------------------------------------------------- */

describe('outputFilename', () => {
  it('replaces the extension and keeps the stem', () => {
    expect(outputFilename('IMG_1234.HEIC', 'jpg')).toBe('IMG_1234.jpg');
    expect(outputFilename('archive.name.heic', 'jpg')).toBe('archive.name.jpg');
    expect(outputFilename('photo', 'webp')).toBe('photo.webp');
  });

  it('keeps Unicode names intact', () => {
    expect(outputFilename('旅行 写真.HEIC', 'png')).toBe('旅行 写真.png');
    expect(outputFilename('Фото-2024.heif', 'jpg')).toBe('Фото-2024.jpg');
  });

  it('falls back to "image" for names that are only an extension', () => {
    expect(outputFilename('.heic', 'jpg')).toBe('image.jpg');
    expect(outputFilename('   ', 'jpg')).toBe('image.jpg');
  });
});

/* -------------------------------------------------------------------------- */
/*  isHeicLike / checkHeicFile                                                */
/* -------------------------------------------------------------------------- */

describe('isHeicLike', () => {
  it('accepts HEIC/HEIF extensions regardless of case', () => {
    expect(isHeicLike({ name: 'a.heic', type: '' })).toBe(true);
    expect(isHeicLike({ name: 'a.HEIF', type: '' })).toBe(true);
  });

  it('accepts HEIC/HEIF MIME types for extension-less files', () => {
    expect(isHeicLike({ name: 'burst', type: 'image/heic' })).toBe(true);
    expect(isHeicLike({ name: 'burst', type: 'IMAGE/HEIF' })).toBe(true);
    expect(isHeicLike({ name: 'burst', type: 'image/heic-sequence' })).toBe(true);
  });

  it('rejects other images and unrelated files', () => {
    expect(isHeicLike({ name: 'a.jpg', type: 'image/jpeg' })).toBe(false);
    expect(isHeicLike({ name: 'notes.txt', type: 'text/plain' })).toBe(false);
    expect(isHeicLike({ name: 'no-extension', type: '' })).toBe(false);
  });
});

describe('checkHeicFile', () => {
  it('accepts a normal HEIC file', () => {
    expect(() => checkHeicFile({ name: 'a.heic', type: 'image/heic', size: 1024 })).not.toThrow();
  });

  it('rejects an empty file', () => {
    expect(() => checkHeicFile({ name: 'a.heic', type: 'image/heic', size: 0 })).toThrow(/empty/i);
  });

  it('rejects a non-HEIC file with a clear message', () => {
    expect(() => checkHeicFile({ name: 'a.jpg', type: 'image/jpeg', size: 1024 })).toThrow(
      /not a HEIC or HEIF image/i,
    );
  });

  it('rejects a file that exceeds the size limit', () => {
    expect(() =>
      checkHeicFile({ name: 'big.heic', type: 'image/heic', size: MAX_FILE_BYTES + 1 }),
    ).toThrow(/too large/i);
    expect(() =>
      checkHeicFile({ name: 'edge.heic', type: 'image/heic', size: MAX_FILE_BYTES }),
    ).not.toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/*  primaryIndex / compositeOntoBackground                                    */
/* -------------------------------------------------------------------------- */

describe('primaryIndex', () => {
  it('picks the flagged primary image', () => {
    expect(primaryIndex([false, true, false])).toBe(1);
    expect(primaryIndex([true, false])).toBe(0);
  });

  it('falls back to the first image when none is flagged', () => {
    expect(primaryIndex([])).toBe(0);
    expect(primaryIndex([false, false])).toBe(0);
  });
});

describe('compositeOntoBackground', () => {
  it('leaves fully opaque pixels untouched', () => {
    const pixels = new Uint8ClampedArray([10, 20, 30, 255]);
    compositeOntoBackground(pixels, [255, 255, 255]);
    expect([...pixels]).toEqual([10, 20, 30, 255]);
  });

  it('replaces fully transparent pixels with the background', () => {
    const pixels = new Uint8ClampedArray([10, 20, 30, 0]);
    compositeOntoBackground(pixels, [12, 34, 56]);
    expect([...pixels]).toEqual([12, 34, 56, 255]);
  });

  it('blends semi-transparent pixels over the background', () => {
    const overWhite = new Uint8ClampedArray([255, 0, 0, 128]);
    compositeOntoBackground(overWhite, [255, 255, 255]);
    expect([...overWhite]).toEqual([255, 127, 127, 255]);

    const overBlack = new Uint8ClampedArray([0, 0, 0, 64]);
    compositeOntoBackground(overBlack, [255, 255, 255]);
    expect([...overBlack]).toEqual([191, 191, 191, 255]);
  });
});

/* -------------------------------------------------------------------------- */
/*  run() — guards that must fire before the decoder loads                     */
/* -------------------------------------------------------------------------- */

describe('heic-to-jpg run guards', () => {
  it('rejects an empty selection', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(
      /choose at least one HEIC or HEIF file/i,
    );
  });

  it('rejects a non-HEIC file', async () => {
    const jpeg = new File([new Uint8Array(8)], 'photo.jpg', { type: 'image/jpeg' });
    await expect(tool.run({ files: [jpeg], options: {} })).rejects.toThrow(/not a HEIC or HEIF/i);
  });

  it('rejects an oversized file before decoding', async () => {
    const huge = { name: 'huge.heic', type: 'image/heic', size: MAX_FILE_BYTES * 2 } as unknown as File;
    await expect(tool.run({ files: [huge], options: {} })).rejects.toThrow(/too large/i);
  });

  it('rejects an unsupported output format', async () => {
    await expect(runOnce({ format: 'gif' })).rejects.toThrow(/not a supported output format/i);
  });

  it('honours an already-aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(runOnce({}, [heicFile()], controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});

/* -------------------------------------------------------------------------- */
/*  run() — full pipeline through the mocked decoder + canvas                  */
/* -------------------------------------------------------------------------- */

describe('heic-to-jpg run pipeline', () => {
  it('encodes JPEG by default and flattens transparency onto the background', async () => {
    const result = await runOnce();

    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]!.filename).toBe('IMG_0001.jpg');
    expect(state.convertCalls).toEqual([{ type: 'image/jpeg', quality: 0.9 }]);
    // Pixel 0 (semi-transparent red) blended onto white; pixel 1 left opaque.
    expect([...state.puts[0]!.slice(0, 8)]).toEqual([255, 127, 127, 255, 0, 0, 0, 255]);
    expect(result.stats).toMatchObject({ files: 1, format: 'image/jpeg', originalBytes: 16, outputBytes: 8 });
    expect(result.notes?.join(' ')).toMatch(/flattened onto #ffffff/i);
  });

  it('encodes PNG losslessly and preserves the alpha channel', async () => {
    const result = await runOnce({ format: 'png' });

    expect(result.outputs[0]!.filename).toBe('IMG_0001.png');
    expect(state.convertCalls).toEqual([{ type: 'image/png', quality: undefined }]);
    expect([...state.puts[0]!.slice(0, 8)]).toEqual([255, 0, 0, 128, 0, 0, 0, 255]);
    expect(result.notes?.join(' ')).not.toMatch(/flattened/i);
  });

  it('encodes WebP with the requested quality and preserves alpha', async () => {
    const result = await runOnce({ format: 'webp', quality: 50 });

    expect(result.outputs[0]!.filename).toBe('IMG_0001.webp');
    expect(state.convertCalls).toEqual([{ type: 'image/webp', quality: 0.5 }]);
    expect(state.puts[0]![3]).toBe(128);
  });

  it('honours a custom JPEG background colour', async () => {
    await runOnce({ format: 'jpeg', background: '#000000' });
    expect([...state.puts[0]!.slice(0, 4)]).toEqual([128, 0, 0, 255]);
  });

  it('falls back to white when the background is not a valid colour', async () => {
    await runOnce({ format: 'jpeg', background: 'not-a-colour' });
    expect([...state.puts[0]!.slice(0, 4)]).toEqual([255, 127, 127, 255]);
  });

  it('scales down to the maximum dimension', async () => {
    const result = await runOnce({ maxDimension: 2 });

    // Source canvas keeps the decoded size; the output canvas gets the scaled size.
    expect(state.canvasSizes).toEqual([
      { width: 4, height: 2 },
      { width: 2, height: 1 },
    ]);
    expect(state.drawArgs).toEqual([[0, 0, 2, 1]]);
    expect(result.outputs[0]!.filename).toBe('IMG_0001.jpg');
  });

  it('converts every selected file and keeps Unicode filenames', async () => {
    const result = await runOnce({ format: 'png' }, [
      heicFile('旅行 写真.HEIC'),
      heicFile('Фото-2024.HEIC'),
    ]);

    expect(result.outputs.map((o) => o.filename)).toEqual(['旅行 写真.png', 'Фото-2024.png']);
    expect(result.stats).toMatchObject({ files: 2, originalBytes: 32, outputBytes: 16 });
    expect(state.convertCalls).toHaveLength(2);
  });

  it('warns when the output is larger than the original file', async () => {
    state.outputBytes = 64;
    const result = await runOnce();

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings![0]).toMatch(/larger than the original/i);
  });

  it('warns when a container holds more than one image', async () => {
    state.imageCount = 3;
    const result = await runOnce();

    expect(result.warnings?.join(' ')).toMatch(/3 images found — converted the primary image only/i);
  });

  it('reports a clear error when the decoder cannot read the file', async () => {
    state.imageCount = 0;
    await expect(runOnce()).rejects.toThrow(/could not be decoded as HEIC\/HEIF/i);
  });

  it('reports a clear error when the browser cannot encode the format', async () => {
    state.forceMimeMismatch = true;
    await expect(runOnce({ format: 'jpeg' })).rejects.toThrow(/cannot encode JPEG/i);
  });

  it('reports progress ending at 100%', async () => {
    const seen: { fraction: number; message?: string }[] = [];
    await tool.run({
      files: [heicFile(), heicFile('second.heic')],
      options: {},
      onProgress: (fraction, message) => seen.push({ fraction, message }),
    });

    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((s) => s.fraction >= 0 && s.fraction <= 1)).toBe(true);
    expect(seen.at(-1)).toEqual({ fraction: 1, message: 'Done' });
    expect(seen.some((s) => /Converting IMG_0001\.heic/.test(s.message ?? ''))).toBe(true);
  });

  it('exposes a 50 megapixel safety ceiling', () => {
    expect(MAX_PIXELS).toBe(50_000_000);
  });
});
