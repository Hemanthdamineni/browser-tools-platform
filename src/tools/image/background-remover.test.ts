import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToolError } from '@/lib/types';
import tool, {
  MODEL_ID,
  MODEL_TASK,
  setMatteProducer,
  type MatteResult,
} from './background-remover.tool';
import {
  MAX_INPUT_BYTES,
  MAX_INPUT_PIXELS,
  OUTPUT_MIME,
  applyCutoff,
  assertInputBytes,
  assertInputPixels,
  composite,
  matteCoverage,
  modelProgressUpdate,
  normalizeCutoff,
  outputFilename,
  resolveBackground,
} from './background-remover.core';
import { installImageMock, makeFile, pixelAt, type MockHandle } from './image-mock';

let mock: MockHandle | undefined;

afterEach(() => {
  mock?.restore();
  mock = undefined;
  setMatteProducer(null);
});

const png = (name = 'photo.png') => makeFile(name, 'image/png');

/** Build a matte of `size`×`size` whose left half is empty and right half opaque. */
function halfMatte(size = 4): MatteResult {
  const data = new Uint8ClampedArray(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      data[y * size + x] = x >= size / 2 ? 255 : 0;
    }
  }
  return { data, width: size, height: size };
}

/** A matte whose every pixel is transparent. */
function emptyMatte(size = 4): MatteResult {
  return { data: new Uint8ClampedArray(size * size), width: size, height: size };
}

/** A matte whose every pixel is fully opaque. */
function fullMatte(size = 4): MatteResult {
  return { data: new Uint8ClampedArray(size * size).fill(255), width: size, height: size };
}

/** Install a producer that always returns `matte`. */
function useProducer(matte: MatteResult = halfMatte()) {
  const producer = vi.fn(async () => matte);
  setMatteProducer(producer);
  return producer;
}

/* -------------------------------------------------------------------------- */
/*  resolveBackground                                                          */
/* -------------------------------------------------------------------------- */

describe('resolveBackground', () => {
  it('treats "transparent" and an empty value as a transparent PNG', () => {
    expect(resolveBackground('transparent')).toEqual({ rgb: null, label: 'transparent' });
    expect(resolveBackground('TRANSPARENT')).toEqual({ rgb: null, label: 'transparent' });
    expect(resolveBackground('')).toEqual({ rgb: null, label: 'transparent' });
    expect(resolveBackground(undefined)).toEqual({ rgb: null, label: 'transparent' });
  });

  it('parses 3- and 6-digit hex colours', () => {
    expect(resolveBackground('#fff').rgb).toEqual({ r: 255, g: 255, b: 255 });
    expect(resolveBackground('#ffffff').rgb).toEqual({ r: 255, g: 255, b: 255 });
    expect(resolveBackground('#1a2b3c').rgb).toEqual({ r: 26, g: 43, b: 60 });
    expect(resolveBackground('#1A2B3C').label).toBe('#1a2b3c');
  });

  it('rejects anything that is not transparent or a hex colour', () => {
    expect(() => resolveBackground('blue')).toThrow(ToolError);
    expect(() => resolveBackground('#12345')).toThrow(/hex colour/i);
    expect(() => resolveBackground('rgb(0,0,0)')).toThrow(/hex colour/i);
  });
});

/* -------------------------------------------------------------------------- */
/*  Cutoff                                                                     */
/* -------------------------------------------------------------------------- */

describe('normalizeCutoff', () => {
  it('accepts numbers and numeric strings', () => {
    expect(normalizeCutoff(0)).toBe(0);
    expect(normalizeCutoff(64)).toBe(64);
    expect(normalizeCutoff('128')).toBe(128);
  });

  it('clamps out-of-range values', () => {
    expect(normalizeCutoff(-10)).toBe(0);
    expect(normalizeCutoff(999)).toBe(254);
  });

  it('falls back to 0 for values that are not numbers', () => {
    expect(normalizeCutoff('abc')).toBe(0);
    expect(normalizeCutoff(Number.NaN)).toBe(0);
    expect(normalizeCutoff(undefined)).toBe(0);
  });
});

describe('applyCutoff', () => {
  it('is the identity when the cutoff is zero', () => {
    for (const alpha of [0, 1, 127, 128, 254, 255]) {
      expect(applyCutoff(alpha, 0)).toBe(alpha);
    }
  });

  it('clears samples at or below the cutoff', () => {
    expect(applyCutoff(0, 64)).toBe(0);
    expect(applyCutoff(64, 64)).toBe(0);
    expect(applyCutoff(63, 64)).toBe(0);
  });

  it('keeps a fully opaque subject opaque and rescales the rest', () => {
    expect(applyCutoff(255, 64)).toBe(255);
    expect(applyCutoff(128, 64)).toBe(Math.round((64 * 255) / 191));
    expect(applyCutoff(65, 64)).toBe(Math.round((1 * 255) / 191));
  });

  it('never brightens a sample and never lowers a fully opaque one', () => {
    for (const alpha of [0, 32, 64, 100, 200, 255]) {
      const out = applyCutoff(alpha, 64);
      expect(out).toBeGreaterThanOrEqual(0);
      expect(out).toBeLessThanOrEqual(alpha);
    }
    expect(applyCutoff(255, 64)).toBe(255);
  });

  it('keeps a higher cutoff stricter', () => {
    for (const alpha of [0, 32, 100, 200, 255]) {
      expect(applyCutoff(alpha, 128)).toBeLessThanOrEqual(applyCutoff(alpha, 64));
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  Compositing                                                                */
/* -------------------------------------------------------------------------- */

describe('composite', () => {
  // Three source pixels, all the same colour.
  const source = new Uint8ClampedArray([200, 100, 50, 255, 200, 100, 50, 255, 200, 100, 50, 255]);
  // Their mattes: fully opaque, fully transparent, half transparent.
  const matte = new Uint8ClampedArray([255, 0, 128]);

  it('keeps the alpha and the colour when the background is transparent', () => {
    const out = composite(source, matte, 3, 1, null);
    expect(out).toHaveLength(12);
    expect([out[0], out[1], out[2], out[3]]).toEqual([200, 100, 50, 255]);
    expect([out[4], out[5], out[6], out[7]]).toEqual([200, 100, 50, 0]);
    expect(out[11]).toBe(128);
  });

  it('flattens onto a solid colour and makes the result opaque', () => {
    const out = composite(source, matte, 3, 1, { r: 255, g: 255, b: 255 });
    // Fully opaque source keeps its own colour.
    expect([out[0], out[1], out[2], out[3]]).toEqual([200, 100, 50, 255]);
    // Fully transparent source becomes the background colour.
    expect([out[4], out[5], out[6], out[7]]).toEqual([255, 255, 255, 255]);
    // Half transparent source is mixed with the background.
    expect(out[8]).toBe(Math.round(200 * (128 / 255) + 255 * (1 - 128 / 255)));
    expect(out[11]).toBe(255);
  });

  it('applies the cutoff before compositing', () => {
    const out = composite(source, matte, 3, 1, null, 128);
    expect(out[11]).toBe(0); // 128 would survive without the cutoff
    expect(out[3]).toBe(255);
  });

  it('round-trips: compositing onto the source colour changes nothing', () => {
    const out = composite(source, matte, 3, 1, { r: 200, g: 100, b: 50 });
    expect([out[0], out[1], out[2]]).toEqual([200, 100, 50]);
    expect([out[4], out[5], out[6]]).toEqual([200, 100, 50]);
  });
});

describe('matteCoverage', () => {
  it('reports the share of foreground pixels', () => {
    expect(matteCoverage(new Uint8ClampedArray(8))).toBe(0);
    expect(matteCoverage(new Uint8ClampedArray([255]))).toBe(1);
    expect(matteCoverage(new Uint8ClampedArray([0, 255]))).toBe(0.5);
    expect(matteCoverage(new Uint8ClampedArray(0))).toBe(0);
  });

  it('counts only the pixels the cutoff keeps', () => {
    const faint = new Uint8ClampedArray([10, 200]);
    expect(matteCoverage(faint)).toBe(1);
    expect(matteCoverage(faint, 64)).toBe(0.5);
  });
});

/* -------------------------------------------------------------------------- */
/*  Size guards                                                                */
/* -------------------------------------------------------------------------- */

describe('assertInputBytes', () => {
  it('accepts a normal file', () => {
    expect(() => assertInputBytes(1024, 'a.png')).not.toThrow();
  });

  it('rejects an empty file', () => {
    expect(() => assertInputBytes(0, 'a.png')).toThrow(/empty/i);
  });

  it('rejects a file above the byte ceiling', () => {
    expect(() => assertInputBytes(MAX_INPUT_BYTES + 1, 'a.png')).toThrow(/too large/i);
    expect(() => assertInputBytes(MAX_INPUT_BYTES, 'a.png')).not.toThrow();
  });

  it('rejects a nonsensical size', () => {
    expect(() => assertInputBytes(Number.NaN, 'a.png')).toThrow(/readable size/i);
  });
});

describe('assertInputPixels', () => {
  it('accepts an image at the pixel ceiling', () => {
    expect(() => assertInputPixels(4000, 3000)).not.toThrow();
    expect(4000 * 3000).toBe(MAX_INPUT_PIXELS);
  });

  it('rejects an image above the pixel ceiling', () => {
    expect(() => assertInputPixels(4000, 3001)).toThrow(/too large/i);
    expect(() => assertInputPixels(12000, 12000)).toThrow(/too large/i);
  });

  it('rejects an image with no measurable size', () => {
    expect(() => assertInputPixels(0, 0)).toThrow(/measurable size/i);
  });
});

/* -------------------------------------------------------------------------- */
/*  Output naming                                                              */
/* -------------------------------------------------------------------------- */

describe('outputFilename', () => {
  it('names the output after the source', () => {
    expect(outputFilename('photo.png')).toBe('photo-no-bg.png');
    expect(outputFilename('photo')).toBe('photo-no-bg.png');
    expect(outputFilename('my.photo.png')).toBe('my.photo-no-bg.png');
  });

  it('keeps Unicode names intact', () => {
    expect(outputFilename('фото-日本語.png')).toBe('фото-日本語-no-bg.png');
    expect(outputFilename('emoji-🎉.png')).toBe('emoji-🎉-no-bg.png');
  });

  it('falls back to a usable name for an empty base', () => {
    expect(outputFilename('.png')).toBe('image-no-bg.png');
    expect(outputFilename('')).toBe('image-no-bg.png');
  });
});

/* -------------------------------------------------------------------------- */
/*  Progress mapping                                                           */
/* -------------------------------------------------------------------------- */

describe('modelProgressUpdate', () => {
  it('maps the download fraction into the workbench slice', () => {
    const update = modelProgressUpdate(
      { phase: 'downloading', fraction: 0.5, loaded: 512, total: 1024, message: 'x' },
      0.05,
      0.8,
    );
    expect(update.fraction).toBeCloseTo(0.45);
  });

  it('names the byte counts while downloading', () => {
    const update = modelProgressUpdate({
      phase: 'downloading',
      fraction: 0.5,
      loaded: 3 * 1024 * 1024,
      total: 6 * 1024 * 1024,
      message: 'x',
    });
    expect(update.message).toMatch(/Downloading the model/i);
    expect(update.message).toMatch(/3 MB of 6 MB/);
  });

  it('handles an unknown total and a null fraction', () => {
    const update = modelProgressUpdate({
      phase: 'downloading',
      fraction: null,
      loaded: 1024,
      total: 0,
      message: 'x',
    });
    expect(update.fraction).toBe(0.05);
    expect(update.message).toMatch(/1 KB/);
    expect(update.message).not.toMatch(/ of /);
  });

  it('reports the ready phase', () => {
    const update = modelProgressUpdate({
      phase: 'ready',
      fraction: 1,
      loaded: 1,
      total: 1,
      message: 'x',
    });
    expect(update.message).toBe('Model ready');
    expect(update.fraction).toBeCloseTo(0.85);
  });
});

/* -------------------------------------------------------------------------- */
/*  The tool                                                                   */
/* -------------------------------------------------------------------------- */

describe('background-remover run', () => {
  it('uses the reviewed model on the shared ML runtime', () => {
    expect(MODEL_ID).toBe('Xenova/modnet');
    expect(MODEL_TASK).toBe('image-segmentation');
  });

  it('cuts out the subject and writes a transparent PNG', async () => {
    mock = installImageMock({ width: 4, height: 4, pixelOutput: true, color: [10, 20, 30, 255] });
    useProducer(halfMatte(4));

    const result = await tool.run({ files: [png()], options: {} });

    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]!.filename).toBe('photo-no-bg.png');
    expect(result.outputs[0]!.blob.type).toBe(OUTPUT_MIME);

    const pixels = new Uint8ClampedArray(await result.outputs[0]!.blob.arrayBuffer());
    // Left half is background (transparent), right half is the subject.
    expect(pixelAt(pixels, 4, 0, 0)).toEqual([10, 20, 30, 0]);
    expect(pixelAt(pixels, 4, 3, 0)).toEqual([10, 20, 30, 255]);
  });

  it('composites the subject onto a solid colour when one is picked', async () => {
    mock = installImageMock({ width: 4, height: 4, pixelOutput: true, color: [10, 20, 30, 255] });
    useProducer(halfMatte(4));

    const result = await tool.run({ files: [png()], options: { background: '#ffffff' } });

    const pixels = new Uint8ClampedArray(await result.outputs[0]!.blob.arrayBuffer());
    expect(pixelAt(pixels, 4, 0, 0)).toEqual([255, 255, 255, 255]);
    expect(pixelAt(pixels, 4, 3, 0)).toEqual([10, 20, 30, 255]);
  });

  it('applies the edge cutoff to the matte', async () => {
    mock = installImageMock({ width: 4, height: 4, pixelOutput: true, color: [10, 20, 30, 255] });
    const faint = new Uint8ClampedArray(16).fill(20);
    useProducer({ data: faint, width: 4, height: 4 });

    const result = await tool.run({ files: [png()], options: { cutoff: 64 } });
    const pixels = new Uint8ClampedArray(await result.outputs[0]!.blob.arrayBuffer());
    expect(pixelAt(pixels, 4, 0, 0)[3]).toBe(0);
  });

  it('gives the producer a canvas of the source size and forwards progress', async () => {
    mock = installImageMock({ width: 4, height: 4, color: [10, 20, 30, 255] });
    const producer = vi.fn(async (canvas: OffscreenCanvas) => {
      expect(canvas.width).toBe(4);
      expect(canvas.height).toBe(4);
      return halfMatte(4);
    });
    setMatteProducer(producer);

    const onProgress = vi.fn();
    await tool.run({ files: [png()], options: {}, onProgress });

    expect(producer).toHaveBeenCalledOnce();
    expect(onProgress).toHaveBeenCalledWith(1, 'Done');
    expect(onProgress).toHaveBeenCalledWith(
      expect.any(Number),
      expect.stringMatching(/portrait matting model/i),
    );
  });

  it('reports the model, the backend and the coverage in the stats', async () => {
    mock = installImageMock({ width: 4, height: 4, color: [10, 20, 30, 255] });
    useProducer(halfMatte(4));

    const result = await tool.run({ files: [png()], options: {} });
    expect(result.stats).toMatchObject({
      width: 4,
      height: 4,
      model: MODEL_ID,
      foregroundPercent: 50,
    });
  });

  it('warns when the model found no subject at all', async () => {
    mock = installImageMock({ width: 4, height: 4, color: [10, 20, 30, 255] });
    useProducer(emptyMatte(4));

    const result = await tool.run({ files: [png()], options: {} });
    expect(result.warnings?.join(' ')).toMatch(/no subject/i);
    expect(result.stats).toMatchObject({ foregroundPercent: 0 });
  });

  it('warns when the model kept the whole image', async () => {
    mock = installImageMock({ width: 4, height: 4, color: [10, 20, 30, 255] });
    useProducer(fullMatte(4));

    const result = await tool.run({ files: [png()], options: {} });
    expect(result.warnings?.join(' ')).toMatch(/almost the whole image/i);
  });

  it('says that the model is a portrait model in the notes', async () => {
    mock = installImageMock({ width: 4, height: 4, color: [10, 20, 30, 255] });
    useProducer(halfMatte(4));

    const result = await tool.run({ files: [png()], options: {} });
    expect(result.notes?.join(' ')).toMatch(/portrait/i);
    expect(result.notes?.join(' ')).toMatch(/device/i);
  });

  it('keeps Unicode filenames intact', async () => {
    mock = installImageMock({ width: 4, height: 4, color: [10, 20, 30, 255] });
    useProducer(halfMatte(4));

    const result = await tool.run({ files: [png('фото-日本語.png')], options: {} });
    expect(result.outputs[0]!.filename).toBe('фото-日本語-no-bg.png');
  });

  it('rejects an empty selection', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose an image file/i);
  });

  it('rejects more than one image', async () => {
    mock = installImageMock({ width: 2, height: 2 });
    await expect(tool.run({ files: [png('a.png'), png('b.png')], options: {} })).rejects.toThrow(
      /exactly one/i,
    );
  });

  it('rejects a non-image file', async () => {
    const txt = new File(['x'], 'a.txt', { type: 'text/plain' });
    await expect(tool.run({ files: [txt], options: {} })).rejects.toThrow(/not an image/i);
  });

  it('rejects an empty file', async () => {
    const empty = makeFile('empty.png', 'image/png', 0);
    await expect(tool.run({ files: [empty], options: {} })).rejects.toThrow(/empty/i);
  });

  it('rejects an oversized file with a friendly error', async () => {
    const big = { name: 'big.png', type: 'image/png', size: MAX_INPUT_BYTES + 1 } as File;
    await expect(tool.run({ files: [big], options: {} })).rejects.toThrow(/too large/i);
  });

  it('rejects an image with too many pixels', async () => {
    mock = installImageMock({ width: 4000, height: 3001 });
    await expect(tool.run({ files: [png()], options: {} })).rejects.toThrow(/too large/i);
  });

  it('rejects an invalid background colour before loading the model', async () => {
    mock = installImageMock({ width: 4, height: 4 });
    const producer = vi.fn(async () => halfMatte(4));
    setMatteProducer(producer);
    await expect(
      tool.run({ files: [png()], options: { background: 'not-a-colour' } }),
    ).rejects.toThrow(/hex colour/i);
    expect(producer).not.toHaveBeenCalled();
  });

  it('honours an aborted signal', async () => {
    mock = installImageMock({ width: 4, height: 4 });
    await expect(
      tool.run({ files: [png()], options: {}, signal: AbortSignal.abort() }),
    ).rejects.toThrow(/cancel/i);
  });

  it('turns a model failure into a friendly error', async () => {
    mock = installImageMock({ width: 4, height: 4 });
    setMatteProducer(async () => {
      throw new Error('onnx exploded');
    });
    await expect(tool.run({ files: [png()], options: {} })).rejects.toThrow(
      /could not be removed/i,
    );
  });

  it('re-throws a ToolError from the producer unchanged', async () => {
    mock = installImageMock({ width: 4, height: 4 });
    setMatteProducer(async () => {
      throw new ToolError('The model is unavailable.', 'Try again later.');
    });
    await expect(tool.run({ files: [png()], options: {} })).rejects.toThrow(
      /model is unavailable/i,
    );
  });

  it('rejects a matte that does not match the image size', async () => {
    mock = installImageMock({ width: 4, height: 4 });
    useProducer(halfMatte(8));
    await expect(tool.run({ files: [png()], options: {} })).rejects.toThrow(/does not match/i);
  });
});
