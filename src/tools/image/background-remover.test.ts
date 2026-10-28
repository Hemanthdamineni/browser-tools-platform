import { afterEach, describe, expect, it, vi } from 'vitest';
import { installImageMock, makeFile, type MockHandle } from './image-mock';
import tool from './background-remover.tool';
import { meta } from './background-remover.meta';

/* -------------------------------------------------------------------------- */
/*  Fixtures & helpers                                                        */
/* -------------------------------------------------------------------------- */

function gray(v: number): number[] {
  return [v, v, v, 255];
}

function grayBuffer(values: number[]): Uint8ClampedArray {
  return Uint8ClampedArray.from(values.flatMap((v) => gray(v)));
}

function grid(pixels: Uint8ClampedArray, width: number, height: number): number[][] {
  const out: number[][] = [];
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      row.push(pixels[i]);
    }
    out.push(row);
  }
  return out;
}

function at(pixels: Uint8ClampedArray, width: number, x: number, y: number): number[] {
  const i = (y * width + x) * 4;
  return [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
}

/* -------------------------------------------------------------------------- */
/*  Tool run()                                                                */
/* -------------------------------------------------------------------------- */

let mock: MockHandle | undefined;

afterEach(() => {
  mock?.restore();
  mock = undefined;
});

const PNG = (name = 'photo.png') => makeFile(name, 'image/png');

// A 4×4 image with a simple pattern for testing
const BASE_PIXELS = [
  // Row 0: dark
  20, 20, 20, 255, 20, 20, 20, 255, 20, 20, 20, 255, 20, 20, 20, 255,
  // Row 1: mid
  100, 100, 100, 255, 100, 100, 100, 255, 100, 100, 100, 255, 100, 100, 100, 255,
  // Row 2: mid
  150, 150, 150, 255, 150, 150, 150, 255, 150, 150, 150, 255, 150, 150, 150, 255,
  // Row 3: light
  220, 220, 220, 255, 220, 220, 220, 255, 220, 220, 220, 255, 220, 220, 220, 255,
];

describe('background-remover run', () => {
  it('requires exactly one image file', async () => {
    mock = installImageMock({
      bitmaps: new Map([[PNG().name, { width: 4, height: 4, pixels: new Uint8ClampedArray(BASE_PIXELS) }]]),
    });

    // No files
    await expect(tool.run({ files: [], options: {}, signal: undefined })).rejects.toThrow('Choose an image file');

    // Two files
    await expect(
      tool.run({ files: [PNG('a.png'), PNG('b.png')], options: {}, signal: undefined }),
    ).rejects.toThrow('Choose exactly one image file');

    // Non-image file
    const txt = new File(['hello'], 'readme.txt', { type: 'text/plain' });
    await expect(tool.run({ files: [txt], options: {}, signal: undefined })).rejects.toThrow('not an image');
  });

  it('rejects non-image files', async () => {
    mock = installImageMock({
      bitmaps: new Map([[PNG().name, { width: 4, height: 4, pixels: new Uint8ClampedArray(BASE_PIXELS) }]]),
    });

    const pdf = new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' });
    await expect(tool.run({ files: [pdf], options: {}, signal: undefined })).rejects.toThrow('not an image');
  });
});

describe('background-remover meta', () => {
  it('has correct metadata', () => {
    expect(meta.id).toBe('background-remover');
    expect(meta.name).toBe('Background Remover');
    expect(meta.category).toBe('image');
    expect(meta.input).toBe('file');
    expect(meta.multiple).toBe(false);
    expect(meta.worker).toBe(true);
    expect(meta.options).toHaveLength(3);
    expect(meta.options.map((o) => o.key)).toEqual(['output', 'color', 'threshold']);
  });

  it('has MODNet in credits with Apache-2.0 license', () => {
    const modnetCredit = meta.credits.find((c) => c.name === 'MODNet' || c.name.toLowerCase().includes('modnet'));
    expect(modnetCredit).toBeDefined();
    expect(modnetCredit?.url.toLowerCase()).toContain('modnet');
  });
});

describe('background-remover module', () => {
  it('exports a valid FileToolModule', () => {
    expect(tool).toBeDefined();
    expect(tool.meta).toBeDefined();
    expect(tool.run).toBeDefined();
  });
});