import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OptionValues } from '@/lib/types';
import { ToolError } from '@/lib/types';
import type { VideoEngine } from '@/lib/video';
import {
  FRAMES_MAX,
  fitSize,
  frameOutputFilename,
  planCountTimestamps,
  planIntervalTimestamps,
  resolveFrameLayout,
  resolveFrameMode,
  resolveFramesSettings,
  sheetCell,
  sheetGrid,
  sheetOutputFilename,
  type FramesSourceInfo,
} from './video-frames.core';
import tool, {
  extractFrames,
  openMediabunnySource,
  runVideoFrames,
  type FramesResult,
  type FramesSource,
  type FramesSourceOpener,
} from './video-frames.tool';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const file = (name = 'clip.mp4', bytes = 1024): File =>
  new File([new Uint8Array(bytes)], name, { type: 'video/mp4' });

const sourceInfo = (overrides: Partial<FramesSourceInfo> = {}): FramesSourceInfo => ({
  durationSeconds: 10,
  sourceWidth: 1920,
  sourceHeight: 1080,
  ...overrides,
});

/** A fake decoded source: no codec, no canvas, fully deterministic. */
function fakeSource(
  sampleCount: number,
  overrides: Partial<FramesSource> = {},
): FramesSource & { disposed: () => boolean; requested: () => number } {
  let disposed = false;
  let requested = 0;
  const built: FramesSource = {
    durationSeconds: 10,
    sourceWidth: 1920,
    sourceHeight: 1080,
    async *samples(timestamps) {
      requested++;
      for (let i = 0; i < sampleCount; i++) {
        yield { timestamp: timestamps[i] ?? i, draw: () => {} };
      }
    },
    dispose() {
      disposed = true;
    },
    ...overrides,
  };
  return Object.assign(built, { disposed: () => disposed, requested: () => requested });
}

/* -------------------------------------------------------------------------- */
/*  Meta                                                                       */
/* -------------------------------------------------------------------------- */

describe('video-frames meta', () => {
  it('is a beta file tool in the video category', () => {
    expect(tool.meta.id).toBe('video-frames');
    expect(tool.meta.category).toBe('video');
    expect(tool.meta.input).toBe('file');
    expect(tool.meta.status).toBe('beta');
    expect(tool.meta.privacy).toEqual({ processing: 'on-device', network: 'none', offline: true });
  });

  it('declares a media accept list', () => {
    expect(tool.meta.accept).toContain('video/*');
  });
});

/* -------------------------------------------------------------------------- */
/*  Mode / layout resolution                                                   */
/* -------------------------------------------------------------------------- */

describe('resolveFrameMode', () => {
  it('accepts both modes', () => {
    expect(resolveFrameMode('interval')).toBe('interval');
    expect(resolveFrameMode('count')).toBe('count');
  });

  it('fails loudly on an unknown mode', () => {
    expect(() => resolveFrameMode('every 5 frames')).toThrow(ToolError);
  });
});

describe('resolveFrameLayout', () => {
  it('accepts both layouts', () => {
    expect(resolveFrameLayout('individual')).toBe('individual');
    expect(resolveFrameLayout('sheet')).toBe('sheet');
  });

  it('fails loudly on an unknown layout', () => {
    expect(() => resolveFrameLayout('montage')).toThrow(ToolError);
  });
});

/* -------------------------------------------------------------------------- */
/*  Timestamp planning                                                         */
/* -------------------------------------------------------------------------- */

describe('planIntervalTimestamps', () => {
  it('samples on a fixed clock from the start time', () => {
    expect(planIntervalTimestamps(0, 10, 2)).toEqual([0, 2, 4, 6, 8, 10]);
  });

  it('keeps the last frame inside the range', () => {
    expect(planIntervalTimestamps(1, 10, 3)).toEqual([1, 4, 7, 10]);
    expect(planIntervalTimestamps(0.5, 10, 2.5)).toEqual([0.5, 3, 5.5, 8]);
  });

  it('yields the start for a zero-width range', () => {
    expect(planIntervalTimestamps(3, 3, 1)).toEqual([3]);
  });

  it('rejects a non-positive interval', () => {
    expect(() => planIntervalTimestamps(0, 5, 0)).toThrow(ToolError);
    expect(() => planIntervalTimestamps(0, 5, -1)).toThrow(ToolError);
  });

  it('stops generating after the frame cap plus one', () => {
    // 600 seconds at 3 s → 201 timestamps, exactly the stop signal.
    const plan = planIntervalTimestamps(0, 600, 3);
    expect(plan.length).toBe(FRAMES_MAX + 1);
  });
});

describe('planCountTimestamps', () => {
  it('spreads frames evenly with the bounds pinned', () => {
    expect(planCountTimestamps(0, 10, 6)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(planCountTimestamps(5, 15, 5)).toEqual([5, 7.5, 10, 12.5, 15]);
  });

  it('rounds to whole counts', () => {
    expect(planCountTimestamps(0, 4, 2.6)).toHaveLength(3);
  });

  it('returns just the start for one frame', () => {
    expect(planCountTimestamps(0, 9, 1)).toEqual([0]);
  });

  it('returns the start for a zero-width range', () => {
    expect(planCountTimestamps(7, 7, 10)).toEqual([7]);
  });
});

/* -------------------------------------------------------------------------- */
/*  fitSize                                                                    */
/* -------------------------------------------------------------------------- */

describe('fitSize', () => {
  it('keeps the source aspect ratio', () => {
    expect(fitSize(320, 1920, 1080)).toEqual({ width: 320, height: 180 });
  });

  it('guards against a degenerate source', () => {
    expect(fitSize(100, 0, 0)).toEqual({ width: 100, height: 100 });
  });
});

/* -------------------------------------------------------------------------- */
/*  Contact-sheet grid                                                         */
/* -------------------------------------------------------------------------- */

describe('sheetGrid', () => {
  it('picks a near-square grid when columns are 0', () => {
    const grid = sheetGrid(9, 0, 320, 180);
    expect(grid.columns).toBe(3);
    expect(grid.rows).toBe(3);
    expect(grid.canvasWidth).toBe(12 * 2 + 3 * 320 + 2 * 8);
    expect(grid.canvasHeight).toBe(12 * 2 + 3 * 180 + 2 * 8);
  });

  it('honours an explicit column count and wraps rows', () => {
    const grid = sheetGrid(10, 4, 320, 180);
    expect(grid.columns).toBe(4);
    expect(grid.rows).toBe(3);
  });

  it('never produces an empty sheet', () => {
    expect(sheetGrid(0, 0, 320, 180).rows).toBeGreaterThan(0);
  });
});

describe('sheetCell', () => {
  it('lays cells out left-to-right then top-to-bottom', () => {
    const grid = sheetGrid(9, 3, 320, 180);
    expect(sheetCell(0, grid)).toEqual({ x: 12, y: 12, width: 320, height: 180 });
    expect(sheetCell(1, grid)).toEqual({ x: 340, y: 12, width: 320, height: 180 });
    expect(sheetCell(3, grid)).toEqual({ x: 12, y: 200, width: 320, height: 180 });
  });
});

/* -------------------------------------------------------------------------- */
/*  File names                                                                 */
/* -------------------------------------------------------------------------- */

describe('frameOutputFilename', () => {
  it('zero-pads to the total width so files sort in order', () => {
    expect(frameOutputFilename('holiday clip.mp4', 0, 12)).toBe('holiday clip-01.png');
    expect(frameOutputFilename('holiday clip.mp4', 11, 12)).toBe('holiday clip-12.png');
  });

  it('keeps Unicode names intact', () => {
    expect(frameOutputFilename('vacaciones verano.mov', 2, 20)).toBe('vacaciones verano-03.png');
  });

  it('uses at least two digits', () => {
    expect(frameOutputFilename('a.mp4', 0, 2)).toBe('a-01.png');
  });
});

describe('sheetOutputFilename', () => {
  it('appends a contact-sheet suffix', () => {
    expect(sheetOutputFilename('holiday clip.mp4')).toBe('holiday clip-contact-sheet.png');
  });
});

/* -------------------------------------------------------------------------- */
/*  Settings                                                                   */
/* -------------------------------------------------------------------------- */

const defaults = (overrides: OptionValues = {}): OptionValues => ({
  mode: 'interval',
  interval: 1,
  count: 12,
  start: 0,
  end: 0,
  layout: 'individual',
  columns: 0,
  width: 0,
  ...overrides,
});

describe('resolveFramesSettings', () => {
  it('plans an interval run over the whole clip', () => {
    const settings = resolveFramesSettings(defaults({ interval: 2 }), sourceInfo());
    expect(settings.mode).toBe('interval');
    expect(settings.layout).toBe('individual');
    expect(settings.startSeconds).toBe(0);
    expect(settings.endSeconds).toBe(10);
    expect(settings.timestamps).toEqual([0, 2, 4, 6, 8, 10]);
    expect(settings.sheet).toBeNull();
  });

  it('plans a count run over the whole clip', () => {
    const settings = resolveFramesSettings(defaults({ mode: 'count', count: 6 }), sourceInfo());
    expect(settings.timestamps).toEqual([0, 2, 4, 6, 8, 10]);
  });

  it('clamps the range to the clip duration', () => {
    const settings = resolveFramesSettings(defaults({ start: 0, end: 60 }), sourceInfo());
    expect(settings.endSeconds).toBe(10);
  });

  it('rejects a start after the end', () => {
    expect(() => resolveFramesSettings(defaults({ start: 20, end: 5 }), sourceInfo())).toThrow(
      /start time is after/i,
    );
  });

  it('defaults the individual width and keeps the aspect ratio', () => {
    const settings = resolveFramesSettings(defaults(), sourceInfo());
    expect(settings.width).toBe(480);
    expect(settings.height).toBe(270);
  });

  it('builds a contact-sheet grid for the sheet layout', () => {
    const settings = resolveFramesSettings(
      defaults({ layout: 'sheet', columns: 4, width: 320 }),
      sourceInfo(),
    );
    expect(settings.layout).toBe('sheet');
    expect(settings.sheet).not.toBeNull();
    expect(settings.sheet!.columns).toBe(4);
    expect(settings.width).toBe(320);
  });

  it('rejects a run over the frame cap', () => {
    expect(() =>
      resolveFramesSettings(defaults({ interval: 0.1 }), sourceInfo({ durationSeconds: 1000 })),
    ).toThrow(/over the 200 frame limit/i);
  });

  it('rejects a missing explicit end when the duration is unknown', () => {
    expect(() =>
      resolveFramesSettings(defaults({ end: 0 }), sourceInfo({ durationSeconds: null })),
    ).toThrow(/pick an explicit end time/i);
  });
});

/* -------------------------------------------------------------------------- */
/*  extractFrames (fake source)                                                */
/* -------------------------------------------------------------------------- */

/** A stand-in for `OffscreenCanvas` — jsdom has no canvas 2D context. */
class FakeOffscreenCanvas {
  constructor(
    public width: number,
    public height: number,
  ) {}
  getContext() {
    return {
      fillStyle: '#000000',
      fillRect: () => {},
      drawImage: () => {},
    };
  }
  convertToBlob() {
    return Promise.resolve(new Blob(['png'], { type: 'image/png' }));
  }
}

describe('extractFrames', () => {
  const options: OptionValues = defaults({ interval: 1, start: 0, end: 0 });

  beforeEach(() => {
    vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('extracts one PNG per sampled frame', async () => {
    const src = fakeSource(6, { durationSeconds: 5 });
    const open: FramesSourceOpener = async () => src;
    const result = await extractFrames(file(), options, {}, open);
    expect(result.frames).toHaveLength(6);
    expect(result.frames[0]!.filename).toMatch(/-01\.png$/);
    expect(result.frames[5]!.filename).toMatch(/-06\.png$/);
    expect(result.frames.every((f) => f.bytes.byteLength > 0)).toBe(true);
    expect(result.sheet).toBeNull();
    expect(src.disposed()).toBe(true);
  });

  it('reports monotonically increasing progress', async () => {
    const src = fakeSource(3);
    const open: FramesSourceOpener = async () => src;
    const progress: number[] = [];
    await extractFrames(
      file(),
      defaults({ count: 3 }),
      { onProgress: (f) => progress.push(f) },
      open,
    );
    expect(progress.at(-1)).toBe(1);
    for (let i = 1; i < progress.length; i++) {
      expect(progress[i]!).toBeGreaterThanOrEqual(progress[i - 1]!);
    }
  });

  it('propagates a cancelled run', async () => {
    const controller = new AbortController();
    controller.abort();
    const open: FramesSourceOpener = async () => fakeSource(1);
    await expect(
      extractFrames(file(), options, { signal: controller.signal }, open),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('fails clearly when no frame can be decoded', async () => {
    const open: FramesSourceOpener = async () => fakeSource(0);
    await expect(extractFrames(file(), defaults({ count: 1 }), {}, open)).rejects.toThrow(
      /no frames could be decoded/i,
    );
  });

  it('assembles a single contact sheet in sheet mode', async () => {
    const src = fakeSource(9);
    const open: FramesSourceOpener = async () => src;
    const result = await extractFrames(file(), defaults({ layout: 'sheet', columns: 3 }), {}, open);
    expect(result.frames).toHaveLength(0);
    expect(result.sheet).not.toBeNull();
    expect(result.sheet!.filename).toBe('clip-contact-sheet.png');
    expect(result.sheet!.width).toBeGreaterThan(0);
    expect(src.disposed()).toBe(true);
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
  class VideoSampleSink {
    constructor(public track: unknown) {}
    async *samplesAtTimestamps(): AsyncGenerator<never> {
      yield* [];
    }
  }
  return { Input, BlobSource, VideoSampleSink, ALL_FORMATS: [] } as unknown as VideoEngine;
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
      src.dispose();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  Tool plumbing                                                              */
/* -------------------------------------------------------------------------- */

describe('runVideoFrames', () => {
  const result = (overrides: Partial<FramesResult> = {}): FramesResult => {
    const settings = resolveFramesSettings(defaults(), sourceInfo());
    return {
      settings,
      frames: [
        {
          bytes: new Uint8Array([1, 2, 3]),
          filename: 'clip-01.png',
          width: 480,
          height: 270,
          timestamp: 0,
        },
        {
          bytes: new Uint8Array([4, 5, 6]),
          filename: 'clip-02.png',
          width: 480,
          height: 270,
          timestamp: 1,
        },
      ],
      sheet: null,
      sourceWidth: 1920,
      sourceHeight: 1080,
      ...overrides,
    };
  };

  it('rejects an empty selection', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(ToolError);
  });

  it('rejects a multi-file selection', async () => {
    const extract = vi.fn();
    await expect(
      runVideoFrames({ files: [file('a.mp4'), file('b.mp4')], options: {} }, extract),
    ).rejects.toThrow(/one video file/i);
    expect(extract).not.toHaveBeenCalled();
  });

  it('passes the resolved options to the extractor', async () => {
    let seen: OptionValues | undefined;
    const extract = vi.fn(async (_f: File, options: OptionValues) => {
      seen = options;
      return result();
    });
    await runVideoFrames({ files: [file()], options: { mode: 'count', count: 3 } }, extract);
    expect(seen).toMatchObject({ mode: 'count', count: 3, interval: 1 });
  });

  it('returns one output per frame in individual mode', async () => {
    const extract = vi.fn(async () => result());
    const out = await runVideoFrames({ files: [file()], options: {} }, extract);
    expect(out.outputs).toHaveLength(2);
    expect(out.outputs[0]!.filename).toBe('clip-01.png');
    expect(out.outputs[0]!.previewUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('skips the preview for oversized stills', async () => {
    const big = new Uint8Array(2 * 1024 * 1024);
    const extract = vi.fn(async () =>
      result({
        frames: [{ bytes: big, filename: 'clip-01.png', width: 480, height: 270, timestamp: 0 }],
      }),
    );
    const out = await runVideoFrames({ files: [file()], options: {} }, extract);
    expect(out.outputs[0]!.previewUrl).toBeUndefined();
  });

  it('renders a contact sheet as an inline image plus a download', async () => {
    const settings = resolveFramesSettings(defaults({ layout: 'sheet', columns: 3 }), sourceInfo());
    const extract = vi.fn(async () =>
      result({
        settings,
        frames: [],
        sheet: {
          bytes: new Uint8Array([9, 8, 7]),
          filename: 'clip-contact-sheet.png',
          width: 1000,
          height: 600,
        },
      }),
    );
    const out = await runVideoFrames({ files: [file()], options: { layout: 'sheet' } }, extract);
    expect(out.outputs).toHaveLength(1);
    expect(out.outputs[0]!.filename).toBe('clip-contact-sheet.png');
    expect(out.report).toMatchObject({ render: 'image' });
    expect(out.report!.output).toMatch(/^data:image\/png;base64,/);
    expect(out.stats).toMatchObject({ columns: 3 });
  });
});
