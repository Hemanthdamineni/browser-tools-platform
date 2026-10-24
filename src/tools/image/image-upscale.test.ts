import { afterEach, describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './image-upscale.tool';
import { meta } from './image-upscale.meta';
import { blobPixels, installImageMock, makeFile, pixelAt, type MockHandle } from './image-mock';

let mock: MockHandle | undefined;

/** Install the browser fakes and serve one decoded bitmap of the given pixels. */
function useSource(
  width: number,
  height: number,
  color: (x: number, y: number) => [number, number, number, number] = () => [0, 0, 0, 255],
): void {
  mock = installImageMock({ pixelOutput: true });
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = color(x, y);
      const i = (y * width + x) * 4;
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = a;
    }
  }
  mock.setDecoder(async () => ({ width, height, pixels }));
}

afterEach(() => {
  mock?.restore();
  mock = undefined;
});

/** Read the first output's pixels as raw RGBA. */
async function outPixels(result: { outputs: { blob: Blob }[] }): Promise<Uint8ClampedArray> {
  return blobPixels(result.outputs[0]!.blob);
}

const run = (options: Record<string, string | number | boolean> = {}, file = makeFile('photo.png')) =>
  tool.run({ files: [file], options });

/* -------------------------------------------------------------------------- */
/*  Metadata                                                                   */
/* -------------------------------------------------------------------------- */

describe('image-upscale meta', () => {
  it('is a routable, on-device image tool with a panel', () => {
    expect(meta.id).toBe('image-upscale');
    expect(meta.category).toBe('image');
    expect(meta.input).toBe('file');
    expect(meta.panel).toBe('image-upscale');
    expect(meta.privacy).toEqual({ processing: 'on-device', network: 'none', offline: true });
    expect(meta.summary.length).toBeLessThanOrEqual(120);
  });

  it('ships the required examples, FAQ entries and article', () => {
    expect((meta.examples ?? []).length).toBeGreaterThanOrEqual(3);
    expect((meta.faq ?? []).length).toBeGreaterThanOrEqual(3);
    const article = meta.article ?? [];
    expect(article.length).toBeGreaterThanOrEqual(3);
    expect(article.length).toBeLessThanOrEqual(5);
    for (const section of article) {
      expect(section.heading.length).toBeGreaterThan(0);
      expect(section.body.length).toBeGreaterThan(0);
    }
    expect((meta.related ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('says plainly that this is not AI super-resolution, and why', () => {
    const faq = meta.faq ?? [];
    const mentionsAlgorithmic = faq.some((entry) => /not ai super-resolution/i.test(entry.a));
    const mentionsGpl = faq.some((entry) => /GPL/i.test(entry.a));
    expect(mentionsAlgorithmic).toBe(true);
    expect(mentionsGpl).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/*  Errors                                                                     */
/* -------------------------------------------------------------------------- */

describe('image-upscale errors', () => {
  it('rejects when no file is chosen', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose an image file/i);
  });

  it('rejects a file that is not an image', async () => {
    await expect(run({}, makeFile('notes.txt', 'text/plain'))).rejects.toThrow(/not an image/i);
  });

  it('rejects an unknown interpolation or output format', async () => {
    await expect(run({ interpolation: 'sinc' })).rejects.toThrow(/Unknown interpolation/);
    await expect(run({ format: 'gif' })).rejects.toThrow(/Unknown output format/);
    await expect(run({ scale: '3' })).rejects.toThrow(/Unknown scale factor/);
  });

  it('cancels when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      tool.run({ files: [makeFile('photo.png')], options: {}, signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('rejects a target above the canvas budget instead of trying to allocate it', async () => {
    useSource(5000, 5000);
    await expect(run({ scale: '4' })).rejects.toThrow(/too large to process safely/i);
  });
});

/* -------------------------------------------------------------------------- */
/*  The upscale itself                                                         */
/* -------------------------------------------------------------------------- */

describe('image-upscale run', () => {
  it('exports the exact target dimensions in the filename', async () => {
    useSource(4, 2);
    const result = await run({ scale: '2', sharpen: 0 });
    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]!.filename).toBe('photo-8x4.png');
    expect(result.outputs[0]!.blob.type).toBe('image/png');
    // The fake encoder returns raw RGBA, so the byte length is the pixel count.
    expect(await outPixels(result)).toHaveLength(8 * 4 * 4);
  });

  it('applies a custom percentage exactly', async () => {
    useSource(4, 2);
    const result = await run({ scale: 'custom', percent: 300, sharpen: 0 });
    expect(result.outputs[0]!.filename).toBe('photo-12x6.png');
    expect(await outPixels(result)).toHaveLength(12 * 6 * 4);
    expect(result.stats?.size).toBe('12 × 6');
    expect(result.stats?.factor).toBe('300%');
  });

  it('scales a solid colour to the identical solid colour end to end', async () => {
    useSource(3, 3, () => [40, 80, 120, 255]);
    // Defaults: 2× Lanczos3 with 40% sharpening — a flat area must stay flat.
    const result = await run({ scale: '2' });
    const pixels = await outPixels(result);
    expect(pixels).toHaveLength(6 * 6 * 4);
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 6; x++) {
        expect(pixelAt(pixels, 6, x, y)).toEqual([40, 80, 120, 255]);
      }
    }
  });

  it('keeps the four quadrants of a 2×2 image intact under nearest at 2×', async () => {
    useSource(2, 2, (x, y) =>
      y === 0 ? (x === 0 ? [255, 0, 0, 255] : [0, 255, 0, 255]) : x === 0 ? [0, 0, 255, 255] : [255, 255, 255, 255],
    );
    const result = await run({ scale: '2', interpolation: 'nearest', sharpen: 0 });
    const pixels = await outPixels(result);
    expect(pixelAt(pixels, 4, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(pixels, 4, 3, 0)).toEqual([0, 255, 0, 255]);
    expect(pixelAt(pixels, 4, 0, 3)).toEqual([0, 0, 255, 255]);
    expect(pixelAt(pixels, 4, 3, 3)).toEqual([255, 255, 255, 255]);
    // Each quadrant is a solid 2×2 block: the corner of a block matches its centre.
    expect(pixelAt(pixels, 4, 1, 1)).toEqual(pixelAt(pixels, 4, 0, 0));
    expect(pixelAt(pixels, 4, 2, 2)).toEqual(pixelAt(pixels, 4, 3, 3));
  });

  it('sharpening changes edge pixels but never a flat area', async () => {
    useSource(6, 6, (x) => (x < 3 ? [100, 100, 100, 255] : [150, 150, 150, 255]));
    const soft = await run({ scale: '2', interpolation: 'bicubic', sharpen: 0 });
    const sharp = await run({ scale: '2', interpolation: 'bicubic', sharpen: 120 });
    const before = await outPixels(soft);
    const after = await outPixels(sharp);
    expect([...after]).not.toEqual([...before]);
    // Flat columns away from the edge are untouched by the mask.
    expect(pixelAt(after, 12, 0, 0)).toEqual(pixelAt(before, 12, 0, 0));
  });

  it('keeps transparency in PNG but composites JPEG onto white', async () => {
    useSource(2, 1, (x) => (x === 0 ? [0, 0, 0, 0] : [255, 0, 0, 255]));
    const png = await outPixels(await run({ format: 'png', interpolation: 'nearest' }));
    expect(pixelAt(png, 4, 0, 0)).toEqual([0, 0, 0, 0]);
    const jpeg = await outPixels(await run({ format: 'jpeg', interpolation: 'nearest' }));
    expect(pixelAt(jpeg, 4, 0, 0)).toEqual([255, 255, 255, 255]);
    for (let i = 3; i < jpeg.length; i += 4) expect(jpeg[i]).toBe(255);
  });

  it('reports the shape of the work in stats and notes', async () => {
    useSource(4, 2);
    const result = await run({ scale: '4', interpolation: 'lanczos3', sharpen: 80, format: 'webp' });
    expect(result.stats).toMatchObject({
      size: '16 × 8',
      factor: '4×',
      interpolation: 'lanczos3',
      sharpen: '80%',
    });
    expect(result.outputs[0]!.filename).toBe('photo-16x8.webp');
    expect(result.notes?.join(' ')).toMatch(/No AI model is involved/i);
  });

  it('reports sharpening as off when the amount is zero', async () => {
    useSource(2, 2);
    const result = await run({ sharpen: 0 });
    expect(result.stats?.sharpen).toBe('off');
  });

  it('reports progress from decode to encode', async () => {
    useSource(2, 2);
    const seen: number[] = [];
    await tool.run({
      files: [makeFile('photo.png')],
      options: { scale: '2' },
      onProgress: (fraction) => seen.push(fraction),
    });
    expect(seen.length).toBeGreaterThanOrEqual(3);
    expect(seen[seen.length - 1]).toBe(1);
  });

  it('throws a ToolError subclass for user mistakes', async () => {
    await expect(run({ interpolation: 'sinc' })).rejects.toBeInstanceOf(ToolError);
  });
});
