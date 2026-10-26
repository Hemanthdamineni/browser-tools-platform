import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import { loadGifEncoder } from '@/tools/video/gif';
import tool, {
  encodeFrames,
  runGifMaker,
  type MakerFrame,
  type MakerSettings,
} from './gif-maker.tool';
import { meta } from './gif-maker.meta';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function imageFile(name: string, bytes = 16): File {
  return new File([new Uint8Array(bytes)], name, { type: 'image/png' });
}

/** A single-colour RGBA frame. */
function solidFrame(
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }
  return data;
}

/** A fake loader: no canvas, fully deterministic. */
function fakeLoad(frames: MakerFrame[], width = 8, height = 6) {
  return async (): Promise<{ frames: MakerFrame[]; width: number; height: number }> => ({
    frames,
    width,
    height,
  });
}

/** A minimal GIF reader: header, size, loop count and per-frame delays. */
function readGif(bytes: Uint8Array): {
  width: number;
  height: number;
  frames: number;
  loopCount: number | null;
  delays: number[];
} {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint16(6, true);
  const height = view.getUint16(8, true);
  let offset = 13;
  // Skip the global colour table if present.
  const packed = bytes[10]!;
  if (packed & 0x80) offset += 3 * 2 ** ((packed & 0x07) + 1);
  let frames = 0;
  let loopCount: number | null = null;
  const delays: number[] = [];
  while (offset < bytes.length) {
    const marker = bytes[offset]!;
    if (marker === 0x3b) break;
    if (marker === 0x21) {
      const label = bytes[offset + 1]!;
      offset += 2;
      if (label === 0xf9) {
        const size = bytes[offset]!;
        delays.push(view.getUint16(offset + 2, true));
        offset += size + 2;
        continue;
      }
      if (label === 0xff) {
        const size = bytes[offset]!;
        let p = offset + 1 + size;
        const len = bytes[p]!;
        if (len >= 3) loopCount = view.getUint16(p + 2, true);
        p += len + 1;
        while (bytes[p] !== 0) p += bytes[p]! + 1;
        offset = p + 1;
        continue;
      }
      while (bytes[offset] !== 0) offset += bytes[offset]! + 1;
      offset += 1;
      continue;
    }
    if (marker === 0x2c) {
      frames++;
      offset += 9;
      const fp = bytes[offset]!;
      offset += 1;
      if (fp & 0x80) offset += 3 * 2 ** ((fp & 0x07) + 1);
      // Skip the LZW minimum code size byte.
      offset += 1;
      let dataSize = bytes[offset]!;
      offset += 1;
      while (dataSize > 0) {
        offset += dataSize;
        dataSize = bytes[offset]!;
        offset += 1;
      }
      continue;
    }
    offset += 1;
  }
  return { width, height, frames, loopCount, delays };
}

/* -------------------------------------------------------------------------- */
/*  Meta                                                                       */
/* -------------------------------------------------------------------------- */

describe('gif-maker meta', () => {
  it('declares the panel, multiple files and the gifenc credit', () => {
    expect(meta.id).toBe('gif-maker');
    expect(meta.input).toBe('file');
    expect(meta.multiple).toBe(true);
    expect(meta.panel).toBe('gif-maker');
    expect(meta.credits?.some((credit) => credit.name === 'gifenc')).toBe(true);
    expect(meta.privacy.network).toBe('none');
  });
});

/* -------------------------------------------------------------------------- */
/*  encodeFrames                                                              */
/* -------------------------------------------------------------------------- */

describe('encodeFrames', () => {
  it('writes a real GIF with the requested size and frame count', async () => {
    const api = await loadGifEncoder();
    const frames: MakerFrame[] = [
      { rgba: solidFrame(6, 4, 255, 0, 0), delayCs: 5 },
      { rgba: solidFrame(6, 4, 0, 0, 255), delayCs: 10 },
    ];
    const settings: MakerSettings = {
      width: 6,
      height: 4,
      colors: 32,
      paletteScope: 'global',
      dither: false,
      loop: 0,
      delaysCs: [5, 10],
    };
    const bytes = encodeFrames(frames, settings, api);
    const gif = readGif(bytes);
    expect(gif.width).toBe(6);
    expect(gif.height).toBe(4);
    expect(gif.frames).toBe(2);
  });

  it('stores per-frame delays in centiseconds and the loop count', async () => {
    const api = await loadGifEncoder();
    const frames: MakerFrame[] = [
      { rgba: solidFrame(4, 4, 1, 2, 3), delayCs: 3 },
      { rgba: solidFrame(4, 4, 4, 5, 6), delayCs: 20 },
    ];
    const bytes = encodeFrames(
      frames,
      {
        width: 4,
        height: 4,
        colors: 32,
        paletteScope: 'global',
        dither: false,
        loop: 5,
        delaysCs: [3, 20],
      },
      api,
    );
    const gif = readGif(bytes);
    expect(gif.delays).toEqual([3, 20]);
    // A non-zero loop count is stored on the Netscape extension.
    expect(gif.loopCount).toBe(5);
  });

  it('writes loop forever when the loop count is 0', async () => {
    const api = await loadGifEncoder();
    const frames: MakerFrame[] = [{ rgba: solidFrame(4, 4, 1, 2, 3), delayCs: 10 }];
    const bytes = encodeFrames(
      frames,
      {
        width: 4,
        height: 4,
        colors: 32,
        paletteScope: 'global',
        dither: false,
        loop: 0,
        delaysCs: [10],
      },
      api,
    );
    expect(readGif(bytes).loopCount).toBe(0);
  });

  it('refuses to encode without frames', async () => {
    const api = await loadGifEncoder();
    expect(() =>
      encodeFrames(
        [],
        {
          width: 4,
          height: 4,
          colors: 32,
          paletteScope: 'global',
          dither: false,
          loop: 0,
          delaysCs: [],
        },
        api,
      ),
    ).toThrow(/no frames/i);
  });

  it('refuses a frame that does not match the requested size', async () => {
    const api = await loadGifEncoder();
    const frames: MakerFrame[] = [{ rgba: solidFrame(4, 4, 1, 2, 3), delayCs: 10 }];
    expect(() =>
      encodeFrames(
        frames,
        {
          width: 8,
          height: 4,
          colors: 32,
          paletteScope: 'global',
          dither: false,
          loop: 0,
          delaysCs: [10],
        },
        api,
      ),
    ).toThrow(/wrong size|not match/i);
  });
});
/* -------------------------------------------------------------------------- */
/*  runGifMaker                                                               */
/* -------------------------------------------------------------------------- */

describe('runGifMaker', () => {
  it('builds a GIF from the ordered frames and reports the result', async () => {
    const load = fakeLoad([
      { rgba: solidFrame(8, 6, 255, 0, 0), delayCs: 0 },
      { rgba: solidFrame(8, 6, 0, 0, 255), delayCs: 0 },
    ]);
    const result = await runGifMaker(
      {
        files: [imageFile('a.png'), imageFile('b.png')],
        options: { loop: 3, delayCs: 10, palette: 'balanced', width: 8, sizeLimit: 4 },
      },
      load,
    );
    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]!.filename).toBe('animation.gif');
    expect(result.outputs[0]!.blob.type).toBe('image/gif');
    expect(result.report?.render).toBe('image');
    expect(result.stats?.frames).toBe(2);
    expect(result.stats?.loop).toBe(3);
  });

  it('applies per-frame delays from the frameDelays option', async () => {
    const load = fakeLoad([
      { rgba: solidFrame(8, 6, 1, 2, 3), delayCs: 0 },
      { rgba: solidFrame(8, 6, 4, 5, 6), delayCs: 0 },
    ]);
    const result = await runGifMaker(
      {
        files: [imageFile('a.png'), imageFile('b.png')],
        options: { frameDelays: '[10, 20]', width: 8, sizeLimit: 4 },
      },
      load,
    );
    expect(result.stats?.durationMs).toBe(300);
  });

  it('rejects a delay list that does not match the frame count', async () => {
    const load = fakeLoad([{ rgba: solidFrame(8, 6, 1, 2, 3), delayCs: 0 }]);
    await expect(
      runGifMaker({ files: [imageFile('a.png')], options: { frameDelays: '[10, 20]' } }, load),
    ).rejects.toThrow(/2 entries for 1 frame/);
  });

  it('rejects malformed delay JSON', async () => {
    const load = fakeLoad([{ rgba: solidFrame(8, 6, 1, 2, 3), delayCs: 0 }]);
    await expect(
      runGifMaker({ files: [imageFile('a.png')], options: { frameDelays: 'not json' } }, load),
    ).rejects.toThrow(/not valid JSON/);
  });

  it('throws when no files are chosen', async () => {
    await expect(runGifMaker({ files: [], options: {} }, fakeLoad([]))).rejects.toBeInstanceOf(
      ToolError,
    );
  });

  it('throws when a selected file is not an image', async () => {
    const notImage = new File([new Uint8Array(4)], 'notes.txt', { type: 'text/plain' });
    const load = fakeLoad([{ rgba: solidFrame(8, 6, 1, 2, 3), delayCs: 0 }]);
    await expect(runGifMaker({ files: [notImage], options: {} }, load)).rejects.toThrow(
      /not an image/,
    );
  });

  it('rejects a negative loop count', async () => {
    const load = fakeLoad([{ rgba: solidFrame(8, 6, 1, 2, 3), delayCs: 0 }]);
    await expect(
      runGifMaker({ files: [imageFile('a.png')], options: { loop: -1 } }, load),
    ).rejects.toThrow(/loop count cannot be negative/);
  });

  it('rejects a negative size limit', async () => {
    const load = fakeLoad([{ rgba: solidFrame(8, 6, 1, 2, 3), delayCs: 0 }]);
    await expect(
      runGifMaker({ files: [imageFile('a.png')], options: { sizeLimit: -2 } }, load),
    ).rejects.toThrow(/size limit cannot be negative/);
  });

  it('clamps the loop count to 1000', async () => {
    const load = fakeLoad([{ rgba: solidFrame(8, 6, 1, 2, 3), delayCs: 0 }]);
    const result = await runGifMaker(
      { files: [imageFile('a.png')], options: { loop: 5000 } },
      load,
    );
    expect(result.stats?.loop).toBe(1000);
  });

  it('rounds and clamps a raw centisecond delay', async () => {
    const load = fakeLoad([{ rgba: solidFrame(8, 6, 1, 2, 3), delayCs: 0 }]);
    const result = await runGifMaker(
      { files: [imageFile('a.png')], options: { delayCs: '10.6' } },
      load,
    );
    // 10.6 cs rounds to 11 cs = 110 ms. The 24 fps → 4 cs quantisation is
    // covered in the panel test (fpsToCentiseconds), not here.
    expect(result.stats?.durationMs).toBe(110);
  });
});

/* -------------------------------------------------------------------------- */
/*  The default export                                                        */
/* -------------------------------------------------------------------------- */

describe('the tool module', () => {
  it('exposes the meta as the single source of truth', () => {
    expect(tool.meta).toBe(meta);
    expect(typeof tool.run).toBe('function');
  });
});
