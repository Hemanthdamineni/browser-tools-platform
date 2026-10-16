import { afterEach, describe, expect, it, vi } from 'vitest';
import tool, { flipScale, normalizeRotation, outputSize } from './image-rotate.tool';

interface Transform {
  translate: [number, number];
  rotate: number;
  scale: [number, number];
  draw: [number, number];
}

interface DrawCall {
  canvasWidth: number;
  canvasHeight: number;
  transform: Transform;
}

/**
 * jsdom has no `OffscreenCanvas` / `createImageBitmap`, so we install minimal
 * fakes that record the 2D transform the tool applies. This lets the happy
 * path (and every rotate/flip branch) be asserted without a real rasteriser.
 */
function installImageMocks(
  opts: { width?: number; height?: number; encodeAs?: string; failDecode?: boolean } = {},
): { drawCalls: DrawCall[]; close: ReturnType<typeof vi.fn> } {
  const drawCalls: DrawCall[] = [];
  const drawCount = { value: 0 };
  const close = vi.fn();

  class FakeOffscreenCanvas {
    width: number;
    height: number;
    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
    }
    getContext(kind: string) {
      if (kind !== '2d') return null;
      const transform: Transform = { translate: [0, 0], rotate: 0, scale: [1, 1], draw: [0, 0] };
      const record = () => {
        drawCalls[drawCount.value] = {
          canvasWidth: this.width,
          canvasHeight: this.height,
          transform: {
            translate: [transform.translate[0], transform.translate[1]],
            scale: [transform.scale[0], transform.scale[1]],
            rotate: transform.rotate,
            draw: [transform.draw[0], transform.draw[1]],
          },
        };
      };
      return {
        translate(x: number, y: number) {
          transform.translate = [x, y];
        },
        rotate(angle: number) {
          transform.rotate = angle;
        },
        scale(x: number, y: number) {
          transform.scale = [x, y];
        },
        drawImage(_image: unknown, x: number, y: number) {
          transform.draw = [x, y];
          record();
          drawCount.value++;
        },
      };
    }
    convertToBlob(options: { type: string }) {
      return Promise.resolve(new Blob([new Uint8Array([1, 2, 3])], { type: opts.encodeAs ?? options.type }));
    }
  }

  const createImageBitmap = opts.failDecode
    ? vi.fn(async () => {
        throw new Error('bad bytes');
      })
    : vi.fn(async () => ({ width: opts.width ?? 4, height: opts.height ?? 2, close }));

  vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas);
  vi.stubGlobal('createImageBitmap', createImageBitmap);
  return { drawCalls, close };
}

function png(name = 'photo.png', type = 'image/png'): File {
  return new File([new Uint8Array([137, 80, 78, 71])], name, { type });
}

afterEach(() => vi.unstubAllGlobals());

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
  });
  it('rejects non-multiples and non-numbers with a ToolError', () => {
    expect(() => normalizeRotation(45)).toThrow(/multiple of 90/i);
    expect(() => normalizeRotation('abc')).toThrow(/not a number/i);
    expect(() => normalizeRotation(undefined)).toThrow(/not a number/i);
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
});

describe('flipScale', () => {
  it('maps each flip option to a scale about the centre', () => {
    expect(flipScale('none')).toEqual({ x: 1, y: 1 });
    expect(flipScale('horizontal')).toEqual({ x: -1, y: 1 });
    expect(flipScale('vertical')).toEqual({ x: 1, y: -1 });
    expect(flipScale('both')).toEqual({ x: -1, y: -1 });
    expect(flipScale(undefined)).toEqual({ x: 1, y: 1 });
  });
});

describe('image-rotate run', () => {
  it('rotates by 0° by default and names the output after the source', async () => {
    const { drawCalls } = installImageMocks();
    const result = await tool.run({ files: [png()], options: {} });
    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]!.filename).toBe('photo-rotated.png');
    expect(result.outputs[0]!.blob.type).toBe('image/png');
    expect(drawCalls[0]!.canvasWidth).toBe(4);
    expect(drawCalls[0]!.canvasHeight).toBe(2);
    expect(drawCalls[0]!.transform.rotate).toBe(0);
    expect(drawCalls[0]!.transform.draw).toEqual([-2, -1]);
  });

  it('swaps the canvas for 90° and rotates clockwise', async () => {
    const { drawCalls } = installImageMocks({ width: 4, height: 2 });
    const result = await tool.run({ files: [png()], options: { rotate: '90' } });
    expect(result.outputs[0]!.filename).toBe('photo-rotated.png');
    expect(drawCalls[0]!.canvasWidth).toBe(2);
    expect(drawCalls[0]!.canvasHeight).toBe(4);
    expect(drawCalls[0]!.transform.rotate).toBeCloseTo(Math.PI / 2);
    expect(drawCalls[0]!.transform.translate).toEqual([1, 2]);
  });

  it('handles 180° and 270° rotation', async () => {
    const a = installImageMocks();
    await tool.run({ files: [png()], options: { rotate: '180' } });
    expect(a.drawCalls[0]!.transform.rotate).toBeCloseTo(Math.PI);
    expect(a.drawCalls[0]!.canvasWidth).toBe(4);
    vi.unstubAllGlobals();

    const b = installImageMocks();
    await tool.run({ files: [png()], options: { rotate: '270' } });
    expect(b.drawCalls[0]!.transform.rotate).toBeCloseTo((3 * Math.PI) / 2);
    expect(b.drawCalls[0]!.canvasWidth).toBe(2);
  });

  it('applies each flip option as a centre scale', async () => {
    for (const [flip, expected] of [
      ['none', [1, 1]],
      ['horizontal', [-1, 1]],
      ['vertical', [1, -1]],
      ['both', [-1, -1]],
    ] as const) {
      const { drawCalls } = installImageMocks();
      await tool.run({ files: [png()], options: { flip } });
      expect(drawCalls[0]!.transform.scale).toEqual(expected);
      vi.unstubAllGlobals();
    }
  });

  it('supports every output format option', async () => {
    for (const [format, ext, mime] of [
      ['png', 'png', 'image/png'],
      ['jpeg', 'jpg', 'image/jpeg'],
      ['webp', 'webp', 'image/webp'],
    ] as const) {
      const { drawCalls } = installImageMocks();
      const result = await tool.run({ files: [png()], options: { rotate: '90', format } });
      expect(result.outputs[0]!.filename).toBe(`photo-rotated.${ext}`);
      expect(result.outputs[0]!.blob.type).toBe(mime);
      expect(drawCalls).toHaveLength(1);
      vi.unstubAllGlobals();
    }
  });

  it('keeps the source format when "original" is selected', async () => {
    installImageMocks();
    const jpg = new File([new Uint8Array([0xff, 0xd8])], 'pic.jpg', { type: 'image/jpeg' });
    const result = await tool.run({ files: [jpg], options: { format: 'original' } });
    expect(result.outputs[0]!.filename).toBe('pic-rotated.jpg');
    expect(result.outputs[0]!.blob.type).toBe('image/jpeg');
  });

  it('processes multiple files and reports progress', async () => {
    installImageMocks();
    const progress: number[] = [];
    const result = await tool.run({
      files: [png('a.png'), png('b.png')],
      options: {},
      onProgress: (fraction) => progress.push(fraction),
    });
    expect(result.outputs.map((o) => o.filename)).toEqual(['a-rotated.png', 'b-rotated.png']);
    expect(result.stats).toMatchObject({ files: 2 });
    expect(progress.at(0)).toBe(0);
    expect(progress.at(-1)).toBe(1);
  });

  it('closes each decoded bitmap', async () => {
    const { close } = installImageMocks();
    await tool.run({ files: [png()], options: {} });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('rejects an empty selection', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose an image file/i);
  });

  it('rejects a non-image file', async () => {
    const txt = new File(['x'], 'a.txt', { type: 'text/plain' });
    await expect(tool.run({ files: [txt], options: {} })).rejects.toThrow(/not an image/i);
  });

  it('rejects an invalid rotation angle', async () => {
    installImageMocks();
    await expect(tool.run({ files: [png()], options: { rotate: '45' } })).rejects.toThrow(
      /multiple of 90/i,
    );
  });

  it('surfaces a friendly error when the image cannot be decoded', async () => {
    installImageMocks({ failDecode: true });
    await expect(tool.run({ files: [png()], options: {} })).rejects.toThrow(/could not be decoded/i);
  });

  it('surfaces a friendly error when the browser cannot encode the target format', async () => {
    installImageMocks({ encodeAs: 'image/png' });
    await expect(
      tool.run({ files: [png()], options: { format: 'webp' } }),
    ).rejects.toThrow(/cannot encode webp/i);
  });

  it('honours an aborted signal', async () => {
    installImageMocks();
    const controller = new AbortController();
    controller.abort();
    await expect(
      tool.run({ files: [png()], options: {}, signal: controller.signal }),
    ).rejects.toThrow(/cancel/i);
  });
});
