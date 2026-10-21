import { describe, it, expect, vi } from 'vitest';
import { ToolError } from '@/lib/types';
import type { OptionValues } from '@/lib/types';
import { encodeWavPCM16 } from '@/lib/audio';
import type { VideoEngine } from '@/lib/video';
import {
  applyPaletteIndices,
  colorDepthForPalette,
  countTargetsBefore,
  createGifWriter,
  ditherToIndices,
  encodeGif,
  estimateGifBytes,
  fitSize,
  gifDataUrl,
  gifOutputFilename,
  loadGifEncoder,
  nearestPaletteIndex,
  palettePreset,
  planFrameTimestamps,
  quantizePalette,
  resolveGifSettings,
  resolveTimeRange,
  selectFrames,
  toBase64,
  GIF_MAX_FRAMES,
  PALETTE_PRESETS,
  type GifSourceInfo,
  type Palette,
} from './gif';
import tool, {
  convertVideoToGif,
  openMediabunnySource,
  runVideoToGif,
  type GifConversion,
  type GifFrame,
  type GifSource,
  type GifSourceOpener,
} from './video-to-gif.tool';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const file = (name = 'clip.mp4', bytes = 1024): File =>
  new File([new Uint8Array(bytes)], name, { type: 'video/mp4' });

const source = (overrides: Partial<GifSourceInfo> = {}): GifSourceInfo => ({
  durationSeconds: 10,
  sourceWidth: 1920,
  sourceHeight: 1080,
  ...overrides,
});

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

/** A tiny GIF reader, used to assert on what the encoder actually produced. */
function parseGif(bytes: Uint8Array): {
  header: string;
  width: number;
  height: number;
  frames: number;
  delays: number[];
  localPalettes: number;
  globalColors: number;
  minCodeSize: number;
} {
  const info = readGif(bytes);
  return {
    header: info.header,
    width: info.width,
    height: info.height,
    frames: info.frames,
    delays: info.delays,
    localPalettes: info.localPalettes,
    globalColors: info.globalColors,
    minCodeSize: info.minCodeSize,
  };
}

interface GifFrameInfo {
  /** Frame delay in hundredths of a second. */
  delayCs: number;
  /** The frame's own colour table, or `null` when it uses the global one. */
  localPalette: number[][] | null;
  /** LZW minimum code size. */
  minCodeSize: number;
  /** The concatenated LZW payload. */
  data: Uint8Array;
  width: number;
  height: number;
}

interface GifInfo {
  header: string;
  width: number;
  height: number;
  frames: number;
  delays: number[];
  localPalettes: number;
  globalColors: number;
  minCodeSize: number;
  globalPalette: number[][];
  frameInfos: GifFrameInfo[];
  /** The Netscape loop count (0 = forever), or `null` when there is none. */
  loopCount: number | null;
}

/**
 * A real (if minimal) GIF container parser: header, logical screen
 * descriptor, colour tables, graphic control extensions, image descriptors and
 * the LZW payloads. It exists so the tests can look inside the bytes the
 * encoder produced instead of trusting it.
 */
function readGif(bytes: Uint8Array): GifInfo {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const header = String.fromCharCode(...bytes.slice(0, 6));
  const width = view.getUint16(6, true);
  const height = view.getUint16(8, true);
  const packed = bytes[10]!;
  const globalColors = 2 ** ((packed & 0x07) + 1);

  let offset = 13;
  const globalPalette: number[][] = [];
  if (packed & 0x80) {
    for (let i = 0; i < globalColors; i++) {
      globalPalette.push([bytes[offset]!, bytes[offset + 1]!, bytes[offset + 2]!]);
      offset += 3;
    }
  }

  let frames = 0;
  let localPalettes = 0;
  let minCodeSize = 0;
  let loopCount: number | null = null;
  const delays: number[] = [];
  const frameInfos: GifFrameInfo[] = [];
  let pendingDelay = 0;

  while (offset < bytes.length) {
    const marker = bytes[offset]!;
    if (marker === 0x3b) break; // trailer
    if (marker === 0x21) {
      const label = bytes[offset + 1]!;
      offset += 2;
      if (label === 0xf9) {
        // Graphic control extension: size byte, 4 data bytes, terminator.
        const size = bytes[offset]!;
        delays.push(view.getUint16(offset + 2, true));
        pendingDelay = delays[delays.length - 1]!;
        offset += size + 2;
        continue;
      }
      if (label === 0xff) {
        // Application extension (the Netscape looping block).
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
      const frameWidth = view.getUint16(offset + 5, true);
      const frameHeight = view.getUint16(offset + 7, true);
      const framePacked = bytes[offset + 9]!;
      offset += 10;
      let localPalette: number[][] | null = null;
      if (framePacked & 0x80) {
        localPalettes++;
        const size = 2 ** ((framePacked & 0x07) + 1);
        localPalette = [];
        for (let i = 0; i < size; i++) {
          localPalette.push([bytes[offset]!, bytes[offset + 1]!, bytes[offset + 2]!]);
          offset += 3;
        }
      }
      minCodeSize = bytes[offset]!;
      offset += 1; // LZW minimum code size
      const chunks: number[] = [];
      while (bytes[offset] !== 0) {
        const len = bytes[offset]!;
        offset += 1;
        for (let i = 0; i < len; i++) chunks.push(bytes[offset + i]!);
        offset += len;
      }
      offset += 1;
      frameInfos.push({
        delayCs: pendingDelay,
        localPalette,
        minCodeSize,
        data: Uint8Array.from(chunks),
        width: frameWidth,
        height: frameHeight,
      });
      pendingDelay = 0;
      continue;
    }
    break;
  }

  return {
    header,
    width,
    height,
    frames,
    delays,
    localPalettes,
    globalColors,
    minCodeSize,
    globalPalette,
    frameInfos,
    loopCount,
  };
}

/**
 * A standard GIF LZW decoder. It follows the spec (clear code, end code,
 * growing code size, the "code not yet in the table" case) so it can prove
 * that what the encoder wrote is readable by a normal decoder.
 */
function lzwDecode(data: Uint8Array, minCodeSize: number): Uint8Array {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  const table: number[][] = [];
  const resetTable = (): void => {
    table.length = 0;
    for (let i = 0; i < clearCode; i++) table.push([i]);
    table.push([]); // the clear code
    table.push([]); // the end code
  };
  resetTable();

  let codeSize = minCodeSize + 1;
  let bit = 0;
  const out: number[] = [];

  const readCode = (): number => {
    let code = 0;
    for (let i = 0; i < codeSize; i++) {
      const byte = data[bit >> 3] ?? 0;
      code |= ((byte >> (bit & 7)) & 1) << i;
      bit++;
    }
    return code;
  };

  let previous: number[] | null = null;
  while ((bit >> 3) < data.length) {
    const code = readCode();
    if (code === clearCode) {
      resetTable();
      codeSize = minCodeSize + 1;
      previous = null;
      continue;
    }
    if (code === endCode) break;
    let entry: number[];
    if (code < table.length && table[code]!.length > 0) {
      entry = table[code]!;
    } else if (code === table.length && previous) {
      entry = [...previous, previous[0]!];
    } else {
      throw new Error(`Corrupt LZW stream: unexpected code ${code}.`);
    }
    for (const value of entry) out.push(value);
    if (previous) {
      table.push([...previous, entry[0]!]);
      if (table.length === 1 << codeSize && codeSize < 12) codeSize++;
    }
    previous = entry;
  }
  return Uint8Array.from(out);
}

/**
 * A fake decoded source: no codec, no canvas, fully deterministic.
 * The frames are rendered at whatever size the converter asks for.
 */
function fakeSource(
  timestamps: number[],
  overrides: Partial<GifSource> = {},
): GifSource & { disposed: () => boolean; requested: () => number } {
  let disposed = false;
  let requested = 0;
  const built: GifSource = {
    durationSeconds: 1,
    sourceWidth: 64,
    sourceHeight: 48,
    hasAudio: true,
    async *frames(request) {
      requested++;
      for (const timestamp of timestamps) {
        yield {
          timestamp,
          rgba: solidFrame(request.width, request.height, (timestamp * 100) % 256, 40, 200),
        };
      }
    },
    dispose() {
      disposed = true;
    },
    ...overrides,
  };
  return Object.assign(built, {
    disposed: () => disposed,
    requested: () => requested,
  });
}

/** An async iterable of timestamped frames, for the pure selection tests. */
async function* framesAt(timestamps: number[]): AsyncGenerator<{ timestamp: number }> {
  for (const timestamp of timestamps) yield { timestamp };
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of iterable) out.push(item);
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Meta                                                                       */
/* -------------------------------------------------------------------------- */

describe('video-to-gif meta', () => {
  it('is a beta file tool in the video category', () => {
    expect(tool.meta.id).toBe('video-to-gif');
    expect(tool.meta.category).toBe('video');
    expect(tool.meta.input).toBe('file');
    expect(tool.meta.status).toBe('beta');
    expect(tool.meta.summary.length).toBeLessThanOrEqual(120);
    expect(tool.meta.privacy).toEqual({ processing: 'on-device', network: 'none', offline: true });
  });

  it('offers the four required options with sensible defaults', () => {
    const options = tool.meta.options ?? [];
    const byKey = new Map(options.map((o) => [o.key, o]));
    expect(byKey.get('start')?.type).toBe('number');
    expect(byKey.get('end')?.type).toBe('number');
    expect(byKey.get('fps')?.default).toBe(10);
    expect(byKey.get('width')?.default).toBe(480);
    expect(byKey.get('palette')?.type).toBe('select');
    expect(byKey.get('palette')?.default).toBe('balanced');
  });

  it('labels every option and describes the range convention', () => {
    for (const option of tool.meta.options ?? []) {
      expect(option.label.length).toBeGreaterThan(0);
      expect(option.help?.length).toBeGreaterThan(0);
    }
  });

  it('credits the two bundled libraries with their licences', () => {
    const credits = tool.meta.credits ?? [];
    expect(credits.find((c) => c.name === 'mediabunny')?.license).toBe('MPL-2.0');
    expect(credits.find((c) => c.name === 'gifenc')?.license).toBe('MIT');
  });
});

describe('palettePreset', () => {
  it('maps the option value onto a preset and rejects anything else', () => {
    expect(palettePreset('small').colors).toBe(32);
    expect(palettePreset('balanced').scope).toBe('local');
    expect(palettePreset('high').dither).toBe(true);
    // Missing values fall back to the balanced preset.
    expect(palettePreset(undefined).id).toBe('balanced');
    expect(() => palettePreset('ultra')).toThrow(/not a known palette quality/i);
  });
});

/* -------------------------------------------------------------------------- */
/*  Settings                                                                   */
/* -------------------------------------------------------------------------- */

describe('resolveGifSettings', () => {
  it('uses the declared defaults and runs to the end of the clip', () => {
    const settings = resolveGifSettings({}, source({ durationSeconds: 4 }));
    expect(settings.startSeconds).toBe(0);
    expect(settings.endSeconds).toBe(4);
    expect(settings.fps).toBe(10);
    expect(settings.width).toBe(480);
    expect(settings.height).toBe(270);
    expect(settings.frameCount).toBe(40);
    expect(settings.delayMs).toBe(100);
    expect(settings.effectiveFps).toBe(10);
    expect(settings.colors).toBe(128);
    expect(settings.paletteScope).toBe('local');
    expect(settings.dither).toBe(false);
  });

  it('honours an explicit time range', () => {
    const settings = resolveGifSettings({ start: 1.5, end: 3 }, source({ durationSeconds: 10 }));
    expect(settings.startSeconds).toBe(1.5);
    expect(settings.endSeconds).toBe(3);
    expect(settings.rangeSeconds).toBe(1.5);
    expect(settings.frameCount).toBe(15);
  });

  it('accepts the options as strings, the way the form delivers them', () => {
    const settings = resolveGifSettings(
      { start: '1', end: '2', fps: '20', width: '240', palette: 'small' },
      source({ durationSeconds: 10 }),
    );
    expect(settings.startSeconds).toBe(1);
    expect(settings.endSeconds).toBe(2);
    expect(settings.fps).toBe(20);
    expect(settings.width).toBe(240);
    expect(settings.colors).toBe(32);
  });

  it('treats an empty field as "use the default"', () => {
    const settings = resolveGifSettings(
      { start: '', end: '', fps: '', width: '' },
      source({ durationSeconds: 4 }),
    );
    expect(settings.startSeconds).toBe(0);
    expect(settings.endSeconds).toBe(4);
    expect(settings.fps).toBe(10);
    expect(settings.width).toBe(480);
  });

  it('refuses a value that is not a number instead of guessing', () => {
    expect(() => resolveGifSettings({ fps: 'fast' }, source())).toThrow(/must be a number/i);
    expect(() => resolveGifSettings({ width: 'wide' }, source())).toThrow(/must be a number/i);
    expect(() => resolveGifSettings({ start: 'later' }, source())).toThrow(/must be a number/i);
    expect(() => resolveGifSettings({ end: 'later' }, source())).toThrow(/must be a number/i);
    expect(() => resolveGifSettings({ fps: Number.NaN }, source())).toThrow(/must be a number/i);
    expect(() => resolveGifSettings({ fps: true }, source())).toThrow(/must be a number/i);
  });

  it('keeps the aspect ratio of the source', () => {
    const portrait = resolveGifSettings(
      { width: 480 },
      source({ sourceWidth: 1080, sourceHeight: 1920 }),
    );
    expect(portrait.width).toBe(480);
    expect(portrait.height).toBe(853);
  });

  it('rejects a range that starts after it ends', () => {
    expect(() => resolveGifSettings({ start: 5, end: 2 }, source())).toThrow(ToolError);
    expect(() => resolveGifSettings({ start: 2, end: 2 }, source())).toThrow(/before the end/i);
  });

  it('rejects a range outside the clip', () => {
    expect(() => resolveGifSettings({ start: 20 }, source({ durationSeconds: 10 }))).toThrow(
      /past the end of the clip/i,
    );
    expect(() => resolveGifSettings({ end: 20 }, source({ durationSeconds: 10 }))).toThrow(
      /past the end of the clip/i,
    );
  });

  it('rejects a frame rate of zero, a negative one and an absurd one', () => {
    expect(() => resolveGifSettings({ fps: 0 }, source())).toThrow(/at least 1 fps/i);
    expect(() => resolveGifSettings({ fps: -5 }, source())).toThrow(/at least 1 fps/i);
    expect(() => resolveGifSettings({ fps: 1000 }, source())).toThrow(/30 fps or less/i);
  });

  it('rejects a width of zero and an absurd width', () => {
    expect(() => resolveGifSettings({ width: 0 }, source())).toThrow(/at least 16 pixels/i);
    expect(() => resolveGifSettings({ width: 5000 }, source())).toThrow(/1280 pixels or less/i);
  });

  it('rejects a range that would produce more frames than the limit allows', () => {
    expect(() => resolveGifSettings({ fps: 30, end: 60 }, source({ durationSeconds: 60 }))).toThrow(
      /limit is 300/i,
    );
    const ok = resolveGifSettings({ fps: 30, end: 10 }, source({ durationSeconds: 60 }));
    expect(ok.frameCount).toBe(300);
    expect(GIF_MAX_FRAMES).toBe(300);
  });

  it('rejects an unknown palette quality but accepts the three presets', () => {
    expect(() => resolveGifSettings({ palette: 'ultra' }, source())).toThrow(ToolError);
    const small = resolveGifSettings({ palette: 'small' }, source());
    expect(small.colors).toBe(32);
    expect(small.paletteScope).toBe('global');
    const high = resolveGifSettings({ palette: 'high' }, source());
    expect(high.colors).toBe(256);
    expect(high.dither).toBe(true);
    expect(PALETTE_PRESETS).toHaveLength(3);
  });

  it('refuses to guess when the duration is unknown', () => {
    expect(() => resolveGifSettings({}, source({ durationSeconds: null }))).toThrow(
      /length of this clip could not be read/i,
    );
    // An explicit range still works — the clip is simply not checked.
    const settings = resolveGifSettings({ end: 2 }, source({ durationSeconds: null }));
    expect(settings.endSeconds).toBe(2);
  });

  it('rejects a clip with no duration at all', () => {
    expect(() => resolveGifSettings({}, source({ durationSeconds: 0 }))).toThrow(/no duration/i);
  });

  it('rejects impossible source dimensions', () => {
    expect(() => resolveGifSettings({}, source({ sourceWidth: 0 }))).toThrow(
      /invalid frame dimensions/i,
    );
    expect(() => resolveGifSettings({}, source({ sourceHeight: Number.NaN }))).toThrow(
      /invalid frame dimensions/i,
    );
  });

  it('rounds the frame delay to whole hundredths of a second', () => {
    // GIF stores delays in hundredths, so 24 fps cannot be represented exactly.
    const settings = resolveGifSettings({ fps: 24 }, source({ durationSeconds: 1 }));
    expect(settings.delayMs % 10).toBe(0);
    expect(settings.effectiveFps).toBe(25);
  });
});

describe('resolveTimeRange', () => {
  it('treats an end time of 0 as "to the end of the clip"', () => {
    const range = resolveTimeRange({ start: 0, end: 0 }, source({ durationSeconds: 7.5 }));
    expect(range).toEqual({ startSeconds: 0, endSeconds: 7.5 });
  });

  it('falls back to the defaults for missing values', () => {
    const range = resolveTimeRange({}, source({ durationSeconds: 3 }));
    expect(range).toEqual({ startSeconds: 0, endSeconds: 3 });
  });

  it('rejects negative times', () => {
    expect(() => resolveTimeRange({ start: -1 }, source())).toThrow(/0 seconds or more/i);
    expect(() => resolveTimeRange({ end: -1 }, source())).toThrow(/0 seconds or more/i);
  });
});

describe('fitSize', () => {
  it('keeps the aspect ratio and clamps extreme frames', () => {
    expect(fitSize(480, 1920, 1080)).toEqual({ width: 480, height: 270 });
    expect(fitSize(480, 1080, 1920)).toEqual({ width: 480, height: 853 });
    const huge = fitSize(1280, 100, 5000);
    expect(huge.width * huge.height).toBeLessThanOrEqual(2_000_000);
    expect(huge.height).toBeGreaterThan(0);
  });
});

/* -------------------------------------------------------------------------- */
/*  Frame plan                                                                 */
/* -------------------------------------------------------------------------- */

describe('planFrameTimestamps', () => {
  it('spreads the frames evenly across the range', () => {
    const stamps = planFrameTimestamps(0, 2, 10);
    expect(stamps).toHaveLength(20);
    expect(stamps[0]).toBe(0);
    expect(stamps.at(-1)).toBeCloseTo(1.9, 6);
    expect(stamps[1]! - stamps[0]!).toBeCloseTo(0.1, 6);
    expect(stamps[10]! - stamps[9]!).toBeCloseTo(0.1, 6);
  });

  it('starts at the requested offset and stays inside the range', () => {
    const stamps = planFrameTimestamps(1.5, 3, 10);
    expect(stamps[0]).toBe(1.5);
    expect(stamps.every((s) => s >= 1.5 && s < 3)).toBe(true);
    expect(stamps).toHaveLength(15);
  });

  it('round-trips a time range into a playback duration', () => {
    const fps = 10;
    const range = 2.5;
    const stamps = planFrameTimestamps(0, range, fps);
    const delayMs = Math.round(1000 / fps / 10) * 10;
    // The GIF plays for frames × delay; the range is covered to within a frame.
    expect(Math.abs(stamps.length * (delayMs / 1000) - range)).toBeLessThanOrEqual(1 / fps);
  });

  it('always produces at least one frame', () => {
    expect(planFrameTimestamps(0, 0.01, 10)).toHaveLength(1);
  });
});

describe('countTargetsBefore', () => {
  it('counts the planned timestamps that fall strictly before a moment', () => {
    const targets = [0, 0.1, 0.2, 0.3];
    expect(countTargetsBefore(targets, 0)).toBe(0);
    expect(countTargetsBefore(targets, 0.05)).toBe(1);
    expect(countTargetsBefore(targets, 0.1)).toBe(1);
    expect(countTargetsBefore(targets, 0.25)).toBe(3);
    expect(countTargetsBefore(targets, 99)).toBe(4);
  });
});

describe('selectFrames', () => {
  it('repeats the source frame that covers a planned timestamp', async () => {
    const picked = await collect(selectFrames(framesAt([0, 0.5]), [0.2, 0.4, 0.6]));
    expect(picked.map((f) => f.timestamp)).toEqual([0, 0, 0.5]);
  });

  it('uses the frame at the exact timestamp when there is one', async () => {
    const picked = await collect(selectFrames(framesAt([0, 0.5]), [0.5]));
    expect(picked.map((f) => f.timestamp)).toEqual([0.5]);
  });

  it('falls back to the first frame for a target before the clip starts', async () => {
    const picked = await collect(selectFrames(framesAt([0.2, 0.4]), [0, 0.1]));
    expect(picked.map((f) => f.timestamp)).toEqual([0.2, 0.2]);
  });

  it('keeps the last frame for the tail of the range', async () => {
    const picked = await collect(selectFrames(framesAt([0, 0.1]), [0, 0.05, 0.5]));
    expect(picked.map((f) => f.timestamp)).toEqual([0, 0, 0.1]);
  });

  it('produces nothing when the source has no frames', async () => {
    expect(await collect(selectFrames(framesAt([]), [0, 0.5]))).toEqual([]);
  });

  it('produces exactly one frame per planned timestamp', async () => {
    const targets = planFrameTimestamps(0, 2, 10);
    const source = planFrameTimestamps(0, 2, 30);
    const picked = await collect(selectFrames(framesAt(source), targets));
    expect(picked).toHaveLength(targets.length);
  });
});

/* -------------------------------------------------------------------------- */
/*  File name                                                                  */
/* -------------------------------------------------------------------------- */

describe('gifOutputFilename', () => {
  it('swaps the extension', () => {
    expect(gifOutputFilename('clip.mp4')).toBe('clip.gif');
    expect(gifOutputFilename('my holiday.MOV')).toBe('my holiday.gif');
    expect(gifOutputFilename('archive.part.mp4')).toBe('archive.part.gif');
  });

  it('keeps names without an extension usable', () => {
    expect(gifOutputFilename('noext')).toBe('noext.gif');
    expect(gifOutputFilename('')).toBe('video.gif');
  });

  it('preserves Unicode names', () => {
    expect(gifOutputFilename('презентация 日本語 🎥.mkv')).toBe('презентация 日本語 🎥.gif');
  });

  it('never keeps a path separator', () => {
    expect(gifOutputFilename('dir/clip.mp4')).toBe('dir_clip.gif');
  });
});

/* -------------------------------------------------------------------------- */
/*  Palette                                                                    */
/* -------------------------------------------------------------------------- */

describe('quantizePalette', () => {
  it('returns the exact colours of a two-colour image', () => {
    const rgba = new Uint8ClampedArray(8 * 4 * 4);
    for (let i = 0; i < 16; i++) {
      rgba[i * 4] = 255;
      rgba[i * 4 + 1] = 0;
      rgba[i * 4 + 2] = 0;
      rgba[i * 4 + 3] = 255;
    }
    for (let i = 16; i < 32; i++) {
      rgba[i * 4] = 0;
      rgba[i * 4 + 1] = 0;
      rgba[i * 4 + 2] = 255;
      rgba[i * 4 + 3] = 255;
    }
    const palette = quantizePalette(rgba, 16);
    expect(palette).toHaveLength(2);
    expect(palette).toContainEqual({ r: 255, g: 0, b: 0 });
    expect(palette).toContainEqual({ r: 0, g: 0, b: 255 });
  });

  it('never returns more colours than asked for', () => {
    const width = 64;
    const height = 64;
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      rgba[i * 4] = i % 256;
      rgba[i * 4 + 1] = (i * 3) % 256;
      rgba[i * 4 + 2] = (i * 7) % 256;
      rgba[i * 4 + 3] = 255;
    }
    const palette = quantizePalette(rgba, 32);
    expect(palette.length).toBeLessThanOrEqual(32);
    expect(palette.length).toBeGreaterThan(1);
    for (const color of palette) {
      expect(color.r).toBeGreaterThanOrEqual(0);
      expect(color.r).toBeLessThanOrEqual(255);
    }
  });

  it('is deterministic', () => {
    const rgba = solidFrame(4, 4, 12, 200, 90);
    expect(quantizePalette(rgba, 16)).toEqual(quantizePalette(rgba, 16));
  });

  it('returns nothing for an empty frame', () => {
    expect(quantizePalette(new Uint8ClampedArray(0), 16)).toEqual([]);
  });
});

describe('nearestPaletteIndex', () => {
  const palette: Palette = [
    { r: 0, g: 0, b: 0 },
    { r: 255, g: 255, b: 255 },
  ];
  it('finds the closest colour', () => {
    expect(nearestPaletteIndex(250, 250, 250, palette)).toBe(1);
    expect(nearestPaletteIndex(5, 5, 5, palette)).toBe(0);
    // 128 is marginally closer to white than to black.
    expect(nearestPaletteIndex(128, 128, 128, palette)).toBe(1);
  });
});

describe('applyPaletteIndices', () => {
  it('maps every pixel to the closest palette entry', () => {
    const rgba = new Uint8ClampedArray(4 * 4 * 4);
    for (let i = 0; i < 16; i++) {
      rgba[i * 4] = 200;
      rgba[i * 4 + 1] = 200;
      rgba[i * 4 + 2] = 200;
      rgba[i * 4 + 3] = 255;
    }
    const palette: Palette = [
      { r: 0, g: 0, b: 0 },
      { r: 255, g: 255, b: 255 },
    ];
    const indices = applyPaletteIndices(rgba, palette);
    expect(indices).toHaveLength(16);
    expect(new Set(indices).size).toBe(1);
    expect(indices[0]).toBe(1);
  });
});

describe('ditherToIndices', () => {
  it('mixes both palette entries on a mid-grey image', () => {
    const width = 16;
    const height = 16;
    const rgba = solidFrame(width, height, 128, 128, 128);
    const palette: Palette = [
      { r: 0, g: 0, b: 0 },
      { r: 255, g: 255, b: 255 },
    ];
    const dithered = ditherToIndices(rgba, width, height, palette);
    const plain = applyPaletteIndices(rgba, palette);
    expect(dithered).toHaveLength(width * height);
    expect(new Set(dithered).size).toBe(2);
    // Without dithering a flat grey collapses onto a single palette entry.
    expect(new Set(plain).size).toBe(1);
  });

  it('keeps a flat colour on a single palette entry', () => {
    const width = 8;
    const height = 8;
    const rgba = solidFrame(width, height, 255, 0, 0);
    const palette: Palette = [
      { r: 0, g: 0, b: 0 },
      { r: 255, g: 0, b: 0 },
    ];
    const dithered = ditherToIndices(rgba, width, height, palette);
    expect(new Set(dithered).size).toBe(1);
    expect(dithered[0]).toBe(1);
  });
});

describe('colorDepthForPalette', () => {
  it('uses the smallest colour depth that fits the palette', () => {
    expect(colorDepthForPalette([{ r: 0, g: 0, b: 0 }])).toBe(2);
    expect(colorDepthForPalette([{ r: 0, g: 0, b: 0 }, { r: 1, g: 1, b: 1 }])).toBe(2);
    expect(colorDepthForPalette(new Array(32).fill({ r: 0, g: 0, b: 0 }))).toBe(5);
    expect(colorDepthForPalette(new Array(128).fill({ r: 0, g: 0, b: 0 }))).toBe(7);
    expect(colorDepthForPalette(new Array(256).fill({ r: 0, g: 0, b: 0 }))).toBe(8);
  });
});

/* -------------------------------------------------------------------------- */
/*  Encoding                                                                   */
/* -------------------------------------------------------------------------- */

describe('encodeGif', () => {
  it('writes a real GIF with the requested size, delay and frame count', async () => {
    const api = await loadGifEncoder();
    const frames = [solidFrame(8, 6, 255, 0, 0), solidFrame(8, 6, 0, 0, 255)];
    const bytes = encodeGif(
      frames,
      {
        width: 8,
        height: 6,
        delayMs: 100,
        colors: 64,
        paletteScope: 'local',
        dither: false,
      },
      api,
    );

    const gif = parseGif(bytes);
    expect(gif.header).toBe('GIF89a');
    expect(gif.width).toBe(8);
    expect(gif.height).toBe(6);
    expect(gif.frames).toBe(2);
    expect(gif.delays).toEqual([10, 10]); // centiseconds
  });

  it('stores a local colour table per frame only for the per-frame palette', async () => {
    const api = await loadGifEncoder();
    const frames = [solidFrame(8, 6, 255, 0, 0), solidFrame(8, 6, 0, 255, 0)];
    const shared = encodeGif(
      frames,
      {
        width: 8,
        height: 6,
        delayMs: 100,
        colors: 32,
        paletteScope: 'global',
        dither: false,
      },
      api,
    );
    const local = encodeGif(
      frames,
      {
        width: 8,
        height: 6,
        delayMs: 100,
        colors: 32,
        paletteScope: 'local',
        dither: false,
      },
      api,
    );

    // A shared palette lives in the global colour table only.
    expect(parseGif(shared).localPalettes).toBe(0);
    // With a per-frame palette every frame but the first carries its own table.
    expect(parseGif(local).localPalettes).toBe(1);
    expect(
      parseGif(
        encodeGif(
          [...frames, frames[0]!],
          {
            width: 8,
            height: 6,
            delayMs: 100,
            colors: 32,
            paletteScope: 'local',
            dither: false,
          },
          api,
        ),
      ).localPalettes,
    ).toBe(2);
    // A per-frame palette costs extra bytes.
    expect(local.byteLength).toBeGreaterThan(shared.byteLength);
  });

  it('sizes the colour table and the LZW code size to the palette', async () => {
    const api = await loadGifEncoder();
    const small = encodeGif(
      [solidFrame(8, 6, 255, 0, 0)],
      {
        width: 8,
        height: 6,
        delayMs: 100,
        colors: 32,
        paletteScope: 'global',
        dither: false,
      },
      api,
    );
    const gif = parseGif(small);
    // A solid frame needs a single colour, so the table is the smallest one.
    expect(gif.globalColors).toBe(2);
    expect(gif.minCodeSize).toBe(2);
  });

  it('refuses to encode without frames', async () => {
    const api = await loadGifEncoder();
    expect(() =>
      encodeGif(
        [],
        { width: 8, height: 6, delayMs: 100, colors: 32, paletteScope: 'global', dither: false },
        api,
      ),
    ).toThrow(/no frames/i);
  });
});

describe('createGifWriter', () => {
  it('refuses a frame that does not match the requested size', async () => {
    const api = await loadGifEncoder();
    const writer = createGifWriter(
      { width: 8, height: 6, delayMs: 100, colors: 32, paletteScope: 'global', dither: false },
      api,
    );
    expect(() => writer.write(solidFrame(4, 4, 1, 2, 3))).toThrow(/wrong size|not match/i);
  });
});

describe('the encoded bytes', () => {
  it('round-trips the pixels through a standard LZW decoder', async () => {
    const api = await loadGifEncoder();
    const width = 17;
    const height = 9;
    // A gradient, so the palette really has to be quantised.
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        rgba[i] = (x * 15) % 256;
        rgba[i + 1] = (y * 28) % 256;
        rgba[i + 2] = (x * y) % 256;
        rgba[i + 3] = 255;
      }
    }
    const palette = quantizePalette(rgba, 64);
    const expected = applyPaletteIndices(rgba, palette);

    const writer = createGifWriter(
      { width, height, delayMs: 100, colors: 64, paletteScope: 'global', dither: false },
      api,
    );
    writer.write(rgba);
    const bytes = writer.finish();

    const info = readGif(bytes);
    expect(info.frameInfos).toHaveLength(1);
    const frame = info.frameInfos[0]!;
    // A standard decoder must be able to read the payload back.
    const decoded = lzwDecode(frame.data, frame.minCodeSize);
    expect(decoded).toHaveLength(width * height);
    expect(Array.from(decoded)).toEqual(Array.from(expected));

    // The colour table holds the quantised palette (padded to a power of two).
    expect(info.globalPalette.length).toBeGreaterThanOrEqual(palette.length);
    for (const color of palette) {
      expect(info.globalPalette).toContainEqual([color.r, color.g, color.b]);
    }
  });

  it('round-trips every frame of a dithered animation', async () => {
    const api = await loadGifEncoder();
    const width = 12;
    const height = 12;
    const frames = [solidFrame(width, height, 255, 0, 0), solidFrame(width, height, 0, 255, 0)];
    const bytes = encodeGif(
      frames,
      {
        width,
        height,
        delayMs: 100,
        colors: 256,
        paletteScope: 'local',
        dither: true,
      },
      api,
    );

    const info = readGif(bytes);
    expect(info.frameInfos).toHaveLength(2);
    for (const [index, frame] of info.frameInfos.entries()) {
      const decoded = lzwDecode(frame.data, frame.minCodeSize);
      expect(decoded).toHaveLength(width * height);
      // The first frame's table is the global one; later frames carry their own.
      const palette = frame.localPalette ?? info.globalPalette;
      expect(palette.length).toBeGreaterThan(0);
      if (index > 0) expect(frame.localPalette).not.toBeNull();
      const source = frames[index]!;
      for (let p = 0; p < width * height; p++) {
        const i = p * 4;
        const color = palette[decoded[p]!];
        expect(color).toBeDefined();
        // Dithering may shift a channel by a step, but the colour must stay close.
        expect(Math.abs(color![0]! - source[i]!)).toBeLessThan(40);
        expect(Math.abs(color![1]! - source[i + 1]!)).toBeLessThan(40);
        expect(Math.abs(color![2]! - source[i + 2]!)).toBeLessThan(40);
      }
    }
  });

  it('writes a looping GIF and the requested delay', async () => {
    const api = await loadGifEncoder();
    const bytes = encodeGif(
      [solidFrame(4, 4, 1, 2, 3), solidFrame(4, 4, 4, 5, 6)],
      {
        width: 4,
        height: 4,
        delayMs: 250,
        colors: 16,
        paletteScope: 'global',
        dither: false,
      },
      api,
    );
    const info = readGif(bytes);
    // 0 = loop forever.
    expect(info.loopCount).toBe(0);
    // 250 ms is stored as 25 hundredths of a second.
    expect(info.delays).toEqual([25, 25]);
  });
});

describe('base64 helpers', () => {
  it('encodes bytes into a data URL', () => {
    expect(toBase64(new Uint8Array([104, 105]))).toBe('aGk=');
    const url = gifDataUrl(new Uint8Array([71, 73, 70]));
    expect(url.startsWith('data:image/gif;base64,')).toBe(true);
  });
});

describe('estimateGifBytes', () => {
  it('grows with the frame count and the palette size', () => {
    const small = estimateGifBytes(10, 100, 100, 32);
    const large = estimateGifBytes(10, 100, 100, 256);
    expect(large).toBeGreaterThan(small);
    expect(estimateGifBytes(20, 100, 100, 32)).toBeGreaterThan(small);
  });
});

/* -------------------------------------------------------------------------- */
/*  Conversion                                                                 */
/* -------------------------------------------------------------------------- */

describe('convertVideoToGif', () => {
  const options: OptionValues = { start: 0, end: 0, fps: 10, width: 16, palette: 'balanced' };

  it('samples the range and encodes the frames', async () => {
    const src = fakeSource([0, 0.3, 0.6]);
    const open: GifSourceOpener = async () => src;
    const progress: number[] = [];
    const result = await convertVideoToGif(
      file(),
      options,
      {
        onProgress: (fraction) => progress.push(fraction),
      },
      open,
    );

    expect(result.frameCount).toBe(10); // 1 second at 10 fps
    expect(result.width).toBe(16);
    expect(result.height).toBe(12);
    expect(result.bytes.byteLength).toBeGreaterThan(0);
    expect(result.filename).toBe('clip.gif');
    expect(result.hasAudio).toBe(true);
    expect(result.rangeSeconds).toBe(1);
    expect(src.disposed()).toBe(true);

    const gif = parseGif(result.bytes);
    expect(gif.header).toBe('GIF89a');
    expect(gif.width).toBe(16);
    expect(gif.height).toBe(12);
    expect(gif.frames).toBe(10);
    expect(progress.at(-1)).toBeLessThanOrEqual(1);
    for (let i = 1; i < progress.length; i++) {
      expect(progress[i]!).toBeGreaterThanOrEqual(progress[i - 1]!);
    }
  });

  it('honours a shorter time range', async () => {
    const src = fakeSource([0, 0.1, 0.2, 0.3, 0.4]);
    const open: GifSourceOpener = async () => src;
    const result = await convertVideoToGif(file(), { ...options, start: 0, end: 0.5 }, {}, open);
    expect(result.frameCount).toBe(5);
    expect(result.rangeSeconds).toBe(0.5);
    expect(parseGif(result.bytes).frames).toBe(5);
  });

  it('turns the time range into the GIF playback time', async () => {
    const src = fakeSource([0.5, 0.8, 1.1, 1.4, 1.7], { durationSeconds: 5 });
    const open: GifSourceOpener = async () => src;
    const result = await convertVideoToGif(
      file(),
      { ...options, start: 0.5, end: 2, fps: 10 },
      {},
      open,
    );
    expect(result.frameCount).toBe(15);
    const gif = readGif(result.bytes);
    // Every frame lasts 100 ms, so the animation plays for 1.5 seconds.
    expect(gif.delays.every((d) => d === 10)).toBe(true);
    const played = (gif.delays.length * 10) / 100;
    expect(Math.abs(played - result.rangeSeconds)).toBeLessThanOrEqual(1 / 10);
  });

  it('writes a shared palette for the small-file preset', async () => {
    const src = fakeSource([0, 0.5]);
    const open: GifSourceOpener = async () => src;
    const result = await convertVideoToGif(
      file(),
      { ...options, palette: 'small' },
      {},
      open,
    );
    expect(result.colors).toBe(32);
    expect(result.paletteScope).toBe('global');
    const gif = readGif(result.bytes);
    // One shared colour table, no per-frame tables.
    expect(gif.localPalettes).toBe(0);
    expect(gif.globalPalette.length).toBeGreaterThan(0);
  });

  it('writes a dithered per-frame palette for the best-quality preset', async () => {
    const src = fakeSource([0, 0.5]);
    const open: GifSourceOpener = async () => src;
    const result = await convertVideoToGif(
      file(),
      { ...options, palette: 'high' },
      {},
      open,
    );
    expect(result.colors).toBe(256);
    expect(result.paletteScope).toBe('local');
    expect(result.dither).toBe(true);
    const gif = readGif(result.bytes);
    // The first frame uses the global table, the rest carry their own.
    expect(gif.localPalettes).toBe(gif.frames - 1);
    expect(gif.frames).toBe(result.frameCount);
  });

  it('drops the frames outside the requested range', async () => {
    const src = fakeSource([0, 0.1, 0.2, 0.3, 0.4, 0.5]);
    const open: GifSourceOpener = async () => src;
    const result = await convertVideoToGif(file(), { ...options, start: 0.2, end: 0.5 }, {}, open);
    expect(result.frameCount).toBe(3);
    expect(parseGif(result.bytes).frames).toBe(3);
  });

  it('flags a GIF that is wider than the source clip', async () => {
    const src = fakeSource([0, 0.5]);
    const open: GifSourceOpener = async () => src;
    const small = await convertVideoToGif(file(), { ...options, width: 32 }, {}, open);
    expect(small.upscaled).toBe(false);
    const big = await convertVideoToGif(file(), { ...options, width: 128 }, {}, open);
    expect(big.upscaled).toBe(true);
  });

  it('fails clearly when the range holds no frames', async () => {
    const src = fakeSource([]);
    const open: GifSourceOpener = async () => src;
    await expect(convertVideoToGif(file(), options, {}, open)).rejects.toThrow(
      /no frames could be decoded/i,
    );
    expect(src.disposed()).toBe(true);
  });

  it('propagates a cancelled run', async () => {
    const controller = new AbortController();
    controller.abort();
    const open: GifSourceOpener = async () => fakeSource([0]);
    await expect(
      convertVideoToGif(file(), options, { signal: controller.signal }, open),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('reports an out-of-range time range without decoding a single frame', async () => {
    const src = fakeSource([0]);
    const open: GifSourceOpener = async () => src;
    await expect(
      convertVideoToGif(file(), { ...options, start: 30, end: 40 }, {}, open),
    ).rejects.toThrow(/past the end of the clip/i);
    expect(src.requested()).toBe(0);
  });

  it('refuses a range that would produce a GIF far over the size limit', async () => {
    const src = fakeSource([0], { durationSeconds: 30, sourceWidth: 1920, sourceHeight: 1080 });
    const open: GifSourceOpener = async () => src;
    await expect(
      convertVideoToGif(file(), { ...options, fps: 10, width: 1280, end: 30 }, {}, open),
    ).rejects.toThrow(/over the 16 MB limit/i);
    expect(src.requested()).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/*  The engine seam                                                            */
/* -------------------------------------------------------------------------- */

type Method = (...args: never[]) => Promise<unknown>;

/** A structural stand-in for the Mediabunny engine — no real codec. */
function fakeEngine(config: { decodable?: boolean; videoTrack?: boolean } = {}) {
  const videoTrack: Record<string, Method> = {
    getDisplayWidth: async () => 640,
    getDisplayHeight: async () => 360,
    canDecode: async () => config.decodable ?? true,
  };

  const input = {
    getFormat: async () => ({ name: 'MP4', mimeType: 'video/mp4' }),
    getDurationFromMetadata: async () => 4,
    computeDuration: async () => 4,
    getMetadataTags: async () => ({}),
    getMimeType: async () => 'video/mp4',
    getPrimaryVideoTrack: async () => (config.videoTrack === false ? null : videoTrack),
    getPrimaryAudioTrack: async () => null,
    dispose: () => {},
  };

  class Input {
    constructor(public options: unknown) {}
    getFormat = input.getFormat;
    getDurationFromMetadata = input.getDurationFromMetadata;
    computeDuration = input.computeDuration;
    getMetadataTags = input.getMetadataTags;
    getMimeType = input.getMimeType;
    getPrimaryVideoTrack = input.getPrimaryVideoTrack;
    getPrimaryAudioTrack = input.getPrimaryAudioTrack;
    dispose = input.dispose;
  }
  class BlobSource {
    constructor(public blob: Blob) {}
  }

  return { Input, BlobSource, ALL_FORMATS: [] } as unknown as VideoEngine;
}

describe('openMediabunnySource', () => {
  it('reports a file without a video track', async () => {
    const engine = fakeEngine({ videoTrack: false });
    await expect(openMediabunnySource(file('tone.mp3'), {}, engine)).rejects.toThrow(
      /no video track/i,
    );
  });

  it('reports a codec this browser cannot decode', async () => {
    vi.stubGlobal('VideoDecoder', class FakeVideoDecoder {});
    try {
      const engine = fakeEngine({ decodable: false });
      await expect(openMediabunnySource(file(), {}, engine)).rejects.toThrow(
        /cannot decode the video codec/i,
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('reports a browser without WebCodecs', async () => {
    expect(globalThis.VideoDecoder).toBeUndefined();
    const engine = fakeEngine();
    await expect(openMediabunnySource(file(), {}, engine)).rejects.toThrow(/WebCodecs/i);
  });

  it('opens a decodable clip and reports its size', async () => {
    vi.stubGlobal('VideoDecoder', class FakeVideoDecoder {});
    try {
      const engine = fakeEngine();
      const src = await openMediabunnySource(file(), {}, engine);
      expect(src.sourceWidth).toBe(640);
      expect(src.sourceHeight).toBe(360);
      expect(src.durationSeconds).toBe(4);
      expect(src.hasAudio).toBe(false);
      src.dispose();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  The real engine path                                                       */
/* -------------------------------------------------------------------------- */

describe('the real engine path', () => {
  it('rejects an empty file before the engine is even loaded', async () => {
    await expect(tool.run({ files: [file('empty.mp4', 0)], options: {} })).rejects.toThrow(
      /empty/i,
    );
  });

  it('rejects malformed bytes with a clear message', async () => {
    const garbage = new File([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])], 'broken.mp4', {
      type: 'video/mp4',
    });
    await expect(tool.run({ files: [garbage], options: {} })).rejects.toThrow(
      /not a video container/i,
    );
  });

  it('rejects a file without a video track', async () => {
    const channel = new Float32Array(800);
    for (let i = 0; i < channel.length; i++) {
      channel[i] = Math.sin((i / 800) * Math.PI * 2 * 5) * 0.5;
    }
    const wav = new File(
      [encodeWavPCM16([channel], 8000).slice().buffer as ArrayBuffer],
      'tone.wav',
      {
        type: 'audio/wav',
      },
    );
    await expect(tool.run({ files: [wav], options: {} })).rejects.toThrow(/no video track/i);
  });
});

/* -------------------------------------------------------------------------- */
/*  Tool plumbing                                                              */
/* -------------------------------------------------------------------------- */

describe('runVideoToGif', () => {
  const conversion = (overrides: Partial<GifConversion> = {}): GifConversion => ({
    bytes: new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]),
    filename: 'clip.gif',
    frameCount: 12,
    width: 480,
    height: 270,
    fps: 10,
    effectiveFps: 10,
    delayMs: 100,
    startSeconds: 0,
    endSeconds: 1.2,
    rangeSeconds: 1.2,
    colors: 128,
    paletteScope: 'local',
    dither: false,
    sourceWidth: 1920,
    sourceHeight: 1080,
    upscaled: false,
    hasAudio: true,
    ...overrides,
  });

  it('rejects an empty selection', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(ToolError);
  });

  it('rejects a multi-file selection', async () => {
    const convert = vi.fn();
    await expect(
      runVideoToGif({ files: [file('a.mp4'), file('b.mp4')], options: {} }, convert),
    ).rejects.toThrow(/one video file/i);
    expect(convert).not.toHaveBeenCalled();
  });

  it('passes the resolved options to the converter', async () => {
    let seen: OptionValues | undefined;
    const convert = vi.fn(async (_f: File, options: OptionValues) => {
      seen = options;
      return conversion();
    });
    await runVideoToGif({ files: [file()], options: {} }, convert);
    expect(seen).toMatchObject({ start: 0, end: 0, fps: 10, width: 480, palette: 'balanced' });
  });

  it('returns a downloadable GIF plus an inline animated preview', async () => {
    const convert = vi.fn(async () => conversion());
    const result = await runVideoToGif({ files: [file()], options: {} }, convert);

    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]!.filename).toBe('clip.gif');
    expect(result.outputs[0]!.blob.type).toBe('image/gif');
    expect(result.outputs[0]!.blob.size).toBe(6);
    expect(result.report?.render).toBe('image');
    expect(result.report?.output.startsWith('data:image/gif;base64,')).toBe(true);
    expect(result.stats).toMatchObject({ frames: 12, width: 480, height: 270, fps: 10 });
    expect(result.notes?.join(' ')).toMatch(/preview/i);
    expect(result.notes?.join(' ')).toMatch(/audio/i);
  });

  it('keeps a Unicode file name in the download', async () => {
    const convert = vi.fn(async () => conversion({ filename: 'презентация 日本語 🎥.gif' }));
    const result = await runVideoToGif(
      { files: [file('презентация 日本語 🎥.mkv')], options: {} },
      convert,
    );
    expect(result.outputs[0]!.filename).toBe('презентация 日本語 🎥.gif');
  });

  it('warns when the frame delay cannot hit the requested rate', async () => {
    const convert = vi.fn(async () => conversion({ fps: 30, effectiveFps: 33.33 }));
    const result = await runVideoToGif({ files: [file()], options: {} }, convert);
    expect(result.warnings?.join(' ')).toMatch(/hundredths of a second/i);
  });

  it('notes an upscaled GIF', async () => {
    const convert = vi.fn(async () => conversion({ upscaled: true }));
    const result = await runVideoToGif({ files: [file()], options: {} }, convert);
    expect(result.notes?.join(' ')).toMatch(/scaled up/i);
  });

  it('skips the inline preview for a very large GIF but still returns the file', async () => {
    const big = new Uint8Array(9 * 1024 * 1024);
    const convert = vi.fn(async () => conversion({ bytes: big }));
    const result = await runVideoToGif({ files: [file()], options: {} }, convert);
    expect(result.report).toBeUndefined();
    expect(result.outputs[0]!.blob.size).toBe(big.byteLength);
    expect(result.notes?.join(' ')).toMatch(/too large to preview/i);
  });

  it('offers a thumbnail for a small GIF but not for a big one', async () => {
    const small = await runVideoToGif({ files: [file()], options: {} }, vi.fn(async () => conversion()));
    expect(small.outputs[0]!.previewUrl).toMatch(/^data:image\/gif;base64,/);

    const medium = new Uint8Array(2 * 1024 * 1024);
    const convert = vi.fn(async () => conversion({ bytes: medium }));
    const result = await runVideoToGif({ files: [file()], options: {} }, convert);
    // The animation is still previewed, but the thumbnail next to the download
    // is dropped so the same bytes are not copied around twice.
    expect(result.report?.render).toBe('image');
    expect(result.outputs[0]!.previewUrl).toBeUndefined();
  });
});

/* -------------------------------------------------------------------------- */
/*  Type-level guarantees                                                      */
/* -------------------------------------------------------------------------- */

describe('the frame contract', () => {
  it('frames carry a timestamp and RGBA pixels', () => {
    const frame: GifFrame = { timestamp: 0.5, rgba: solidFrame(2, 2, 1, 2, 3) };
    expect(frame.rgba).toHaveLength(2 * 2 * 4);
    expect(frame.timestamp).toBe(0.5);
  });
});
