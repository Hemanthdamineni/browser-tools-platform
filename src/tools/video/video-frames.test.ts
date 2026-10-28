import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { ToolError } from '@/lib/types';
import type { OptionValues } from '@/lib/types';
import type { VideoEngine } from '@/lib/video';

// Mock VideoDecoder on globalThis for tests
const OriginalVideoDecoder = globalThis.VideoDecoder;

beforeAll(() => {
  globalThis.VideoDecoder = class VideoDecoder {
    state = 'unconfigured';
    configure = vi.fn();
    decode = vi.fn();
    read = vi.fn().mockRejectedValue(new Error('No frame ready'));
    flush = vi.fn().mockResolvedValue(undefined);
    close = vi.fn();
    constructor() {}
  } as any;

  // Mock OffscreenCanvas for tests
  globalThis.OffscreenCanvas = class OffscreenCanvas {
    width: number;
    height: number;
    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
    }
    getContext(type: string) {
      return {
        drawImage: vi.fn(),
        clearRect: vi.fn(),
      };
    }
    convertToBlob = vi.fn().mockResolvedValue(new Blob(['fake'], { type: 'image/png' }));
  } as any;
});

afterAll(() => {
  globalThis.VideoDecoder = OriginalVideoDecoder;
  if ('OffscreenCanvas' in globalThis && globalThis.OffscreenCanvas !== undefined) {
    globalThis.OffscreenCanvas = undefined as unknown as typeof OffscreenCanvas;
  }
});

import tool from './video-frames.tool';
import { extractFrames, type FrameExtractionResult } from './video-frames.core';
import {
  planFrameExtraction,
  frameOutputName,
  frameDimensions,
  type FramePlan,
} from './video-frames.core';

/* -------------------------------------------------------------------------- */
/*  Meta                                                                       */
/* -------------------------------------------------------------------------- */

describe('video-frames meta', () => {
  it('exports the meta', () => {
    expect(tool.meta).toBeDefined();
    expect(tool.meta.id).toBe('video-frames');
    expect(tool.meta.name).toBe('Video Frames');
  });
});

/* -------------------------------------------------------------------------- */
/*  Core helpers                                                               */
/* -------------------------------------------------------------------------- */

describe('planFrameExtraction', () => {
  it('plans interval mode correctly', () => {
    const plan = planFrameExtraction(20, { interval: 5, count: 10, width: 320 }, 1920, 1080);
    expect(plan.mode).toBe('interval');
    expect(plan.intervalSeconds).toBe(5);
    expect(plan.width).toBe(320);
    expect(plan.timestamps.length).toBeLessThanOrEqual(10);
    expect(plan.timestamps[0]).toBe(0);
    expect(plan.timestamps[1]).toBe(5);
  });

  it('plans thumbnail mode correctly', () => {
    const plan = planFrameExtraction(20, { mode: 'thumbnail', count: 5, width: 320 }, 1920, 1080);
    expect(plan.mode).toBe('thumbnail');
    expect(plan.timestamps.length).toBe(5);
    expect(plan.timestamps[0]).toBe(0);
    expect(plan.timestamps[4]).toBeCloseTo(16, 0); // 20 * 4/5 = 16
  });

  it('throws on invalid interval', () => {
    expect(() => planFrameExtraction(20, { interval: 0 }, 1920, 1080)).toThrow(ToolError);
    expect(() => planFrameExtraction(20, { interval: 31 }, 1920, 1080)).toThrow(ToolError);
    expect(() => planFrameExtraction(20, { interval: -1 }, 1920, 1080)).toThrow(ToolError);
  });

  it('throws on invalid count', () => {
    expect(() => planFrameExtraction(20, { count: 0 }, 1920, 1080)).toThrow(ToolError);
    expect(() => planFrameExtraction(20, { count: 51 }, 1920, 1080)).toThrow(ToolError);
    expect(() => planFrameExtraction(20, { count: 1.5 }, 1920, 1080)).toThrow(ToolError);
  });

  it('throws on invalid width', () => {
    expect(() => planFrameExtraction(20, { width: 99 }, 1920, 1080)).toThrow(ToolError);
    expect(() => planFrameExtraction(20, { width: 1281 }, 1920, 1080)).toThrow(ToolError);
    expect(() => planFrameExtraction(20, { width: 320.5 }, 1920, 1080)).toThrow(ToolError);
  });

  it('throws on invalid source dimensions', () => {
    expect(() => planFrameExtraction(20, { interval: 5 }, 0, 1080)).toThrow(ToolError);
    expect(() => planFrameExtraction(20, { interval: 5 }, 1920, 0)).toThrow(ToolError);
  });

  it('throws on invalid duration', () => {
    expect(() => planFrameExtraction(null, { interval: 5 }, 1920, 1080)).toThrow(ToolError);
    expect(() => planFrameExtraction(0, { interval: 5 }, 1920, 1080)).toThrow(ToolError);
    expect(() => planFrameExtraction(-5, { interval: 5 }, 1920, 1080)).toThrow(ToolError);
  });

  it('returns single timestamp at 0 when duration < interval', () => {
    const plan = planFrameExtraction(0.1, { interval: 5 }, 1920, 1080);
    expect(plan.timestamps).toEqual([0]);
    expect(plan.timestamps.length).toBe(1);
  });
});

describe('frameOutputName', () => {
  it('generates correct filename', () => {
    expect(frameOutputName('video.mp4', 0, 0)).toBe('video-frame-001-0_000s.png');
    expect(frameOutputName('video.mp4', 5, 12.345)).toBe('video-frame-006-12_345s.png');
    expect(frameOutputName('my movie.mov', 0, 0)).toBe('my movie-frame-001-0_000s.png');
    expect(frameOutputName('clip', 9, 45.678)).toBe('clip-frame-010-45_678s.png');
  });
});

describe('frameDimensions', () => {
  it('scales down when target is smaller', () => {
    const dims = frameDimensions(1920, 1080, 320);
    expect(dims.width).toBe(320);
    expect(dims.height).toBe(180);
  });

  it('does not scale up when target is larger', () => {
    const dims = frameDimensions(640, 480, 1280);
    expect(dims.width).toBe(640);
    expect(dims.height).toBe(480);
  });

  it('handles square videos', () => {
    const dims = frameDimensions(1080, 1080, 320);
    expect(dims.width).toBe(320);
    expect(dims.height).toBe(320);
  });

  it('handles portrait videos', () => {
    const dims = frameDimensions(720, 1280, 320);
    // Scales based on width: 320/720 = 0.444..., height = 1280 * 0.444 = 569
    expect(dims.width).toBe(320);
    expect(dims.height).toBe(569);
  });
});

/* -------------------------------------------------------------------------- */
/*  Engine mock                                                                */
/* -------------------------------------------------------------------------- */

function fakeEngine(): VideoEngine {
  const timestamps = [0, 5000000, 10000000, 15000000, 20000000]; // microseconds

  return {
    BlobSource: class {
      constructor(public file: File) {}
    } as any,
    Input: class {
      constructor(public options: any) {}
      videoTracks: any[] = [{
        kind: 'video',
        getDecoderConfig: async () => ({ codec: 'avc1.640028', codedWidth: 1920, codedHeight: 1080 }),
        getCodedWidth: async () => 1920,
        getCodedHeight: async () => 1080,
        getSampleRate: async () => 48000,
        getNumberOfChannels: async () => 2,
        samples: async function* () {
          for (const ts of timestamps) {
            yield { timestamp: ts, duration: 33333 };
          }
        },
      }];
      async close() {}
      dispose() {}
      async getFormat() {
        return { name: 'MP4', extensions: ['mp4'], mimeTypes: ['video/mp4'] };
      }
      async getPrimaryVideoTrack() {
        return this.videoTracks[0];
      }
      async getPrimaryAudioTrack() {
        return this.audioTracks[0] || null;
      }
      async getDurationFromMetadata() {
        return 20;
      }
      async computeDuration() {
        return 20;
      }
    } as any,
    ALL_FORMATS: [{ name: 'MP4', extensions: ['mp4'], mimeTypes: ['video/mp4'] }] as any,
    VideoDecoder: class {
      state = 'unconfigured';
      outputQueue: any[] = [];

      constructor(private init: { output: (frame: any) => void; error: (err: any) => void }) {}

      configure(config: any) {
        this.state = 'configured';
      }

      decode(chunk: any) {
        if (this.state !== 'configured') throw new Error('Decoder not configured');
        // Produce frame synchronously for testing
        this.outputQueue.push({
          timestamp: chunk.timestamp,
          codedWidth: 1920,
          codedHeight: 1080,
          close: vi.fn(),
        });
      }

      async read() {
        if (this.outputQueue.length === 0) throw new Error('No frame ready');
        return this.outputQueue.shift();
      }

      async flush() {}

      close() {}
    },
    VideoEncoder: class {},
    AudioDecoder: class {},
    AudioEncoder: class {},
    Demuxer: class {
      static probe(file: File) {
        return file.type === 'video/mp4' || file.name.endsWith('.mp4');
      }
      async demux() {
        return [
          {
            type: 'video',
            track: {
              kind: 'video',
              getDecoderConfig: async () => ({ codec: 'avc1.640028', codedWidth: 1920, codedHeight: 1080 }),
              getSampleRate: async () => 48000,
              getNumberOfChannels: async () => 2,
              samples: async function* () {
                for (const ts of timestamps) {
                  yield { timestamp: ts, duration: 33333 };
                }
              },
            },
          },
        ];
      }
    } as any,
    Output: class {} as any,
    BufferTarget: class {
      buffer: Uint8Array | null = null;
    } as any,
    Conversion: class {
      static async init() {
        return {
          isValid: true,
          execute: vi.fn(),
          onProgress: null as any,
        };
      }
    } as any,
    VideoSampleSink: class {
      constructor(private track: any) {}
      samples(startSeconds: number, endSeconds: number) {
        const { timestamps } = this.track;
        return (async function* () {
          for (const ts of timestamps) {
            const seconds = ts / 1_000_000;
            if (seconds >= startSeconds && seconds <= endSeconds) {
              yield {
                timestamp: ts,
                duration: 33333,
                draw(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
                  ctx.fillStyle = '#000';
                  ctx.fillRect(x, y, width, height);
                },
                close() {},
              };
            }
          }
        })();
      }
    },
    chooseVideoEncoder: vi.fn().mockResolvedValue({
      create: vi.fn().mockReturnValue({
        encode: vi.fn(),
        data: new Uint8Array(),
        mime: 'video/mp4',
      }),
    }),
    chooseAudioEncoder: vi.fn().mockResolvedValue({
      create: vi.fn().mockReturnValue({
        encode: vi.fn(),
        data: new Uint8Array(),
        mime: 'audio/mp4',
      }),
    }),
  } as unknown as VideoEngine;
}

/* -------------------------------------------------------------------------- */
/*  The extraction                                                             */
/* -------------------------------------------------------------------------- */

describe('extractFrames', () => {
  it('extracts frames in interval mode', async () => {
    const engine = fakeEngine();
    const file = new File([new Uint8Array(2048)], 'test.mp4', { type: 'video/mp4' });
    const result = await extractFrames(
      file,
      { interval: 5, count: 4, width: 320, mode: 'interval' },
      { signal: undefined, onProgress: undefined },
      engine,
    );
    expect(result.frames.length).toBeGreaterThan(0);
    expect(result.stats.mode).toBe('interval');
    expect(result.stats.frameCount).toBe(result.frames.length);
  });

  it('extracts frames in thumbnail mode', async () => {
    const engine = fakeEngine();
    const file = new File([new Uint8Array(2048)], 'test.mp4', { type: 'video/mp4' });
    const result = await extractFrames(
      file,
      { mode: 'thumbnail', count: 3, width: 320 },
      { signal: undefined, onProgress: undefined },
      engine,
    );
    expect(result.frames.length).toBeGreaterThan(0);
    expect(result.stats.mode).toBe('thumbnail');
  });

  it('aborts on signal', async () => {
    const engine = fakeEngine();
    const file = new File([new Uint8Array(2048)], 'test.mp4', { type: 'video/mp4' });
    const controller = new AbortController();
    controller.abort();
    await expect(
      extractFrames(file, { interval: 5, count: 4, width: 320 }, { signal: controller.signal }, engine),
    ).rejects.toThrow('The operation was cancelled.');
  });

  it('throws on missing WebCodecs', async () => {
    // Temporarily remove VideoDecoder
    const saved = globalThis.VideoDecoder;
    globalThis.VideoDecoder = undefined as any;
    const engine = fakeEngine();
    const file = new File([new Uint8Array(2048)], 'test.mp4', { type: 'video/mp4' });
    await expect(
      extractFrames(file, { interval: 5, count: 4, width: 320 }, { signal: undefined }, engine),
    ).rejects.toThrow(ToolError);
    globalThis.VideoDecoder = saved;
  });
});

/* -------------------------------------------------------------------------- */
/*  Tool plumbing                                                              */
/* -------------------------------------------------------------------------- */

describe('video-frames tool', () => {
  it('rejects missing file', async () => {
    await expect(
      tool.run({ files: [], options: {}, signal: undefined, onProgress: undefined }),
    ).rejects.toThrow(ToolError);
  });

  it('rejects multiple files', async () => {
    const files = [
      new File([new Uint8Array(2048)], 'a.mp4', { type: 'video/mp4' }),
      new File([new Uint8Array(2048)], 'b.mp4', { type: 'video/mp4' }),
    ];
    await expect(
      tool.run({ files, options: {}, signal: undefined, onProgress: undefined }),
    ).rejects.toThrow(ToolError);
  });

  it('rejects empty file', async () => {
    const file = new File([], 'empty.mp4', { type: 'video/mp4' });
    await expect(
      tool.run({ files: [file], options: {}, signal: undefined, onProgress: undefined }),
    ).rejects.toThrow(ToolError);
  });
});