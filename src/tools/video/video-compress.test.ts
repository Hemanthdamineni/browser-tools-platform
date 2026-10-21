import { describe, it, expect, vi } from 'vitest';
import { ToolError } from '@/lib/types';
import type { VideoEngine, VideoProbe } from '@/lib/video';
import {
  compressOutputFilename,
  compressionPreset,
  formatSizeChange,
  resolveCompressSettings,
  resolveContainer,
  sizeChangePercent,
  COMPRESSION_PRESETS,
  COMPRESS_MAX_DURATION_SECONDS,
  COMPRESS_MAX_OUTPUT_BYTES,
  COMPRESS_MAX_WIDTH,
  COMPRESS_MIN_VIDEO_BITRATE,
  COMPRESS_WARN_DURATION_SECONDS,
  COMPRESS_WARN_OUTPUT_BYTES,
  type CompressSettings,
  type CompressSourceInfo,
} from './compress';
import tool, {
  encodeCompressedVideo,
  pickAudioCodec,
  pickVideoCodec,
  probeCompressSource,
  runVideoCompress,
  sourceInfoFromProbe,
  type CompressDeps,
} from './video-compress.tool';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const file = (name = 'clip.mp4', bytes = 1024): File =>
  new File([new Uint8Array(bytes)], name, { type: 'video/mp4' });

const source = (overrides: Partial<CompressSourceInfo> = {}): CompressSourceInfo => ({
  fileSize: 10 * 1024 * 1024,
  durationSeconds: 10,
  width: 1920,
  height: 1080,
  frameRate: 30,
  videoBitrate: 8_000_000,
  audioBitrate: 128_000,
  audioChannels: 2,
  audioSampleRate: 48_000,
  hasAudio: true,
  ...overrides,
});

/* -------------------------------------------------------------------------- */
/*  A fake video engine                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The fake engine writes a tiny, self-describing binary format instead of a
 * real video: a magic number, the frame count and one record per frame
 * (timestamp, width, height). That is enough to prove that the frames the
 * decoder produced really ended up in the encoded output — and that the
 * output really can be read back.
 */
interface FakeFrame {
  timestamp: number;
  width: number;
  height: number;
}

const FAKE_MAGIC = 0x46414b45; // 'FAKE'

function encodeFakeVideo(frames: FakeFrame[]): Uint8Array {
  const buffer = new ArrayBuffer(8 + frames.length * 16);
  const view = new DataView(buffer);
  view.setUint32(0, FAKE_MAGIC);
  view.setUint32(4, frames.length);
  frames.forEach((frame, index) => {
    const offset = 8 + index * 16;
    view.setFloat64(offset, frame.timestamp);
    view.setUint32(offset + 8, frame.width);
    view.setUint32(offset + 12, frame.height);
  });
  return new Uint8Array(buffer);
}

function looksLikeFakeVideo(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength >= 8 &&
    new DataView(bytes.buffer, bytes.byteOffset, 8).getUint32(0) === FAKE_MAGIC
  );
}

function decodeFakeVideo(bytes: Uint8Array): FakeFrame[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0) !== FAKE_MAGIC) throw new Error('not a fake video');
  const count = view.getUint32(4);
  const frames: FakeFrame[] = [];
  for (let index = 0; index < count; index++) {
    const offset = 8 + index * 16;
    frames.push({
      timestamp: view.getFloat64(offset),
      width: view.getUint32(offset + 8),
      height: view.getUint32(offset + 12),
    });
  }
  return frames;
}

function defaultFrames(): FakeFrame[] {
  const frames: FakeFrame[] = [];
  for (let i = 0; i < 30; i++) {
    frames.push({ timestamp: i / 30, width: 1920, height: 1080 });
  }
  return frames;
}

interface FakeEngineConfig {
  frames?: FakeFrame[];
  duration?: number;
  width?: number;
  height?: number;
  frameRate?: number;
  videoBitrate?: number;
  audioBitrate?: number | null;
  hasAudio?: boolean;
  encodableVideo?: string[];
  encodableAudio?: string[];
}

/**
 * A structural stand-in for Mediabunny: no codec, no canvas, but the same
 * shape the tool drives — `Input`, `Output`, `BufferTarget`, `Conversion`,
 * `Quality` and the codec queries.
 */
function fakeEngine(config: FakeEngineConfig = {}) {
  const sourceFrames = config.frames ?? defaultFrames();
  const duration = config.duration ?? 10;
  const width = config.width ?? 1920;
  const height = config.height ?? 1080;
  const frameRate = config.frameRate ?? 30;
  const videoBitrate = config.videoBitrate ?? 8_000_000;
  const audioBitrate = config.audioBitrate === undefined ? 128_000 : config.audioBitrate;
  const hasAudio = config.hasAudio ?? true;
  const encodableVideo = config.encodableVideo ?? ['avc', 'vp9', 'vp8'];
  const encodableAudio = config.encodableAudio ?? ['aac', 'opus'];

  const conversions: Record<string, unknown>[] = [];
  const disposed: unknown[] = [];

  class FakeBlobSource {
    constructor(public blob: Blob) {}
  }

  class FakeInput {
    decoded: FakeFrame[] | null = null;
    encoded = false;

    constructor(public options: { source: FakeBlobSource }) {}

    async readFrames(): Promise<FakeFrame[]> {
      if (this.decoded) return this.decoded;
      const bytes = new Uint8Array(await this.options.source.blob.arrayBuffer());
      this.encoded = looksLikeFakeVideo(bytes);
      this.decoded = this.encoded ? decodeFakeVideo(bytes) : sourceFrames;
      return this.decoded;
    }

    async getFormat() {
      return { name: 'MP4', mimeType: 'video/mp4' };
    }

    async getVideoTracks() {
      const decoded = await this.readFrames();
      const first = decoded[0];
      const w = first ? first.width : width;
      const h = first ? first.height : height;
      return [
        {
          getCodec: async () => 'avc',
          getCodecParameterString: async () => 'avc1.640028',
          getCodedWidth: async () => w,
          getCodedHeight: async () => h,
          getDisplayWidth: async () => w,
          getDisplayHeight: async () => h,
          getRotation: async () => 0,
          getAverageBitrate: async () => videoBitrate,
          canDecode: async () => true,
          getLanguageCode: async () => 'und',
          computeFrameRateMetrics: async () => ({ bestGuessFrameRate: frameRate }),
        },
      ];
    }

    async getAudioTracks() {
      if (!hasAudio) return [];
      return [
        {
          getCodec: async () => 'aac',
          getCodecParameterString: async () => 'mp4a.40.2',
          getNumberOfChannels: async () => 2,
          getSampleRate: async () => 48_000,
          getAverageBitrate: async () => audioBitrate,
          canDecode: async () => true,
          getLanguageCode: async () => 'eng',
        },
      ];
    }

    async getDurationFromMetadata() {
      const decoded = await this.readFrames();
      if (!this.encoded) return duration;
      const last = decoded.at(-1);
      return last ? last.timestamp + 1 / frameRate : duration;
    }

    async computeDuration() {
      return this.getDurationFromMetadata();
    }

    async getMetadataTags() {
      return {};
    }

    async getMimeType() {
      return 'video/mp4; codecs="avc1.640028, mp4a.40.2"';
    }

    async getPrimaryVideoTrack() {
      const tracks = await this.getVideoTracks();
      return tracks[0] ?? null;
    }

    async getPrimaryAudioTrack() {
      const tracks = await this.getAudioTracks();
      return tracks[0] ?? null;
    }

    dispose() {
      disposed.push(this);
    }
  }

  class FakeBufferTarget {
    buffer: ArrayBuffer | null = null;
  }

  class FakeFormat {
    constructor(
      public name: string,
      public videoCodecs: string[],
      public audioCodecs: string[],
    ) {}
    get fileExtension() {
      return this.name === 'WebM' ? '.webm' : '.mp4';
    }
    get mimeType() {
      return this.name === 'WebM' ? 'video/webm' : 'video/mp4';
    }
    getSupportedCodecs() {
      return [...this.videoCodecs, ...this.audioCodecs];
    }
    getSupportedVideoCodecs() {
      return this.videoCodecs;
    }
    getSupportedAudioCodecs() {
      return this.audioCodecs;
    }
    get supportsVideoTransformationMetadata() {
      return true;
    }
  }

  class FakeOutput {
    state = 'pending';
    constructor(public options: { format: FakeFormat; target: FakeBufferTarget }) {}
    async start() {
      this.state = 'started';
    }
    async finalize() {
      this.state = 'finalized';
    }
    async cancel() {
      this.state = 'canceled';
    }
    async getMimeType() {
      return `${this.options.format.mimeType}; codecs="avc1.640028"`;
    }
  }

  class FakeQuality {
    constructor(public options: { bitrate?: number }) {}
  }

  class FakeConversion {
    onProgress?: (progress: number, processedTime: number) => void;
    isValid = true;
    utilizedTracks: unknown[] = [];
    discardedTracks: unknown[] = [];
    state = 'idle';

    constructor(public options: Record<string, any>) {
      conversions.push(options);
    }

    static async init(options: Record<string, any>) {
      return new FakeConversion(options);
    }

    async execute() {
      const input = this.options.input as FakeInput;
      const decoded = await input.readFrames();
      const first = decoded[0];
      const outWidth = (this.options.video?.width ?? first?.width ?? width) as number;
      const outHeight = first
        ? Math.round((outWidth * first.height) / first.width / 2) * 2
        : height;
      const encoded = decoded.map((frame) => ({
        timestamp: frame.timestamp,
        width: outWidth,
        height: outHeight,
      }));
      const bytes = encodeFakeVideo(encoded);
      const output = this.options.output as FakeOutput;
      const target = output.options.target;
      target.buffer = bytes.buffer as ArrayBuffer;
      this.onProgress?.(0, 0);
      this.onProgress?.(1, duration);
    }

    async cancel() {
      this.state = 'canceled';
    }
  }

  const engine = {
    Input: FakeInput,
    BlobSource: FakeBlobSource,
    BufferTarget: FakeBufferTarget,
    Output: FakeOutput,
    Quality: FakeQuality,
    Conversion: FakeConversion,
    Mp4OutputFormat: class extends FakeFormat {
      constructor() {
        super('MP4', ['avc', 'hevc', 'vp9', 'av1', 'vp8'], ['aac', 'opus']);
      }
    },
    WebMOutputFormat: class extends FakeFormat {
      constructor() {
        super('WebM', ['vp9', 'vp8', 'av1'], ['opus', 'vorbis']);
      }
    },
    ALL_FORMATS: [],
    VIDEO_CODECS: ['avc', 'hevc', 'vp9', 'av1', 'vp8', 'prores'],
    AUDIO_CODECS: ['aac', 'opus', 'vorbis', 'mp3'],
    getFirstEncodableVideoCodec: async (codecs: string[]) =>
      codecs.find((codec) => encodableVideo.includes(codec)) ?? null,
    getEncodableVideoCodecs: async () => encodableVideo,
    getFirstEncodableAudioCodec: async (codecs: string[]) =>
      codecs.find((codec) => encodableAudio.includes(codec)) ?? null,
    getEncodableAudioCodecs: async () => encodableAudio,
  } as unknown as VideoEngine;

  return { engine, conversions, disposed };
}

/** Stub the WebCodecs globals the tool insists on. */
async function withWebCodecsAsync<T>(fn: () => Promise<T>): Promise<T> {
  vi.stubGlobal('VideoDecoder', class FakeVideoDecoder {});
  vi.stubGlobal('VideoEncoder', class FakeVideoEncoder {});
  try {
    return await fn();
  } finally {
    vi.unstubAllGlobals();
  }
}

/* -------------------------------------------------------------------------- */
/*  Meta                                                                       */
/* -------------------------------------------------------------------------- */

describe('video-compress meta', () => {
  it('is a beta file tool in the video category', () => {
    expect(tool.meta.id).toBe('video-compress');
    expect(tool.meta.category).toBe('video');
    expect(tool.meta.input).toBe('file');
    expect(tool.meta.status).toBe('beta');
    expect(tool.meta.summary.length).toBeLessThanOrEqual(120);
    expect(tool.meta.privacy).toEqual({ processing: 'on-device', network: 'none', offline: true });
  });

  it('offers the size and quality presets plus the width, fps and audio knobs', () => {
    const options = tool.meta.options ?? [];
    const byKey = new Map(options.map((option) => [option.key, option]));
    const preset = byKey.get('preset');
    expect(preset?.type).toBe('select');
    expect(preset?.default).toBe('size-50');
    expect((preset as { choices: { value: string }[] }).choices.map((c) => c.value)).toEqual([
      'size-50',
      'size-25',
      'size-target',
      'quality-high',
      'quality-medium',
      'quality-low',
    ]);
    expect(byKey.get('targetSize')?.type).toBe('number');
    expect(byKey.get('targetSize')?.showWhen).toEqual({ key: 'preset', value: 'size-target' });
    expect(byKey.get('width')?.type).toBe('number');
    expect(byKey.get('width')?.default).toBe(0);
    expect(byKey.get('fps')?.type).toBe('number');
    expect(byKey.get('fps')?.default).toBe(0);
    expect(byKey.get('container')?.type).toBe('select');
    expect(byKey.get('container')?.default).toBe('mp4');
    expect(byKey.get('audio')?.type).toBe('boolean');
    expect(byKey.get('audio')?.default).toBe(true);
  });

  it('labels every control and explains it', () => {
    for (const option of tool.meta.options ?? []) {
      expect(option.label.length).toBeGreaterThan(0);
      expect(option.help?.length).toBeGreaterThan(0);
    }
  });

  it('credits the bundled engine and points at the sibling video tools', () => {
    expect(tool.meta.credits?.find((credit) => credit.name === 'mediabunny')?.license).toBe(
      'MPL-2.0',
    );
    expect(tool.meta.related).toContain('video-to-gif');
    expect(tool.meta.related).toContain('video-info');
  });
});

/* -------------------------------------------------------------------------- */
/*  Presets                                                                    */
/* -------------------------------------------------------------------------- */

describe('compressionPreset', () => {
  it('maps every preset id onto its definition', () => {
    expect(compressionPreset('size-50').sizeFactor).toBe(0.5);
    expect(compressionPreset('size-25').sizeFactor).toBe(0.25);
    expect(compressionPreset('size-target').sizeFactor).toBeNull();
    expect(compressionPreset('quality-high').bitsPerPixel).toBeGreaterThan(
      compressionPreset('quality-medium').bitsPerPixel!,
    );
    expect(compressionPreset('quality-medium').bitsPerPixel).toBeGreaterThan(
      compressionPreset('quality-low').bitsPerPixel!,
    );
    expect(COMPRESSION_PRESETS).toHaveLength(6);
  });

  it('falls back to the default and rejects anything unknown', () => {
    expect(compressionPreset(undefined).id).toBe('size-50');
    expect(compressionPreset('').id).toBe('size-50');
    expect(() => compressionPreset('ultra')).toThrow(ToolError);
    expect(() => compressionPreset('ultra')).toThrow(/not a known compression preset/i);
  });
});

describe('resolveContainer', () => {
  it('accepts the two containers it can write', () => {
    expect(resolveContainer('mp4')).toBe('mp4');
    expect(resolveContainer('webm')).toBe('webm');
    expect(resolveContainer(undefined)).toBe('mp4');
  });

  it('refuses an unknown container instead of guessing', () => {
    expect(() => resolveContainer('avi')).toThrow(/not a container this tool can write/i);
  });
});

/* -------------------------------------------------------------------------- */
/*  Settings                                                                   */
/* -------------------------------------------------------------------------- */

describe('resolveCompressSettings', () => {
  it('halves the source size with the default preset', () => {
    const settings = resolveCompressSettings({}, source());
    expect(settings.presetId).toBe('size-50');
    expect(settings.container).toBe('mp4');
    expect(settings.extension).toBe('mp4');
    expect(settings.targetBytes).toBe(5 * 1024 * 1024);
    // 4.19 Mbps total, minus 128 kbps of audio.
    expect(settings.totalBitrate).toBe(4_194_304);
    expect(settings.videoBitrate).toBe(4_066_304);
    expect(settings.audioBitrate).toBe(128_000);
    expect(settings.estimatedBytes).toBe(5 * 1024 * 1024);
    expect(settings.width).toBe(1920);
    expect(settings.height).toBe(1080);
    expect(settings.frameRate).toBe(30);
    expect(settings.keepAudio).toBe(true);
  });

  it('aims at a quarter of the source with the 25% preset', () => {
    const settings = resolveCompressSettings({ preset: 'size-25' }, source());
    expect(settings.targetBytes).toBe(2.5 * 1024 * 1024);
    expect(settings.estimatedBytes).toBe(2.5 * 1024 * 1024);
  });

  it('aims at an explicit target size in megabytes', () => {
    const settings = resolveCompressSettings({ preset: 'size-target', targetSize: 5 }, source());
    expect(settings.targetBytes).toBe(5 * 1024 * 1024);
    expect(settings.estimatedBytes).toBe(5 * 1024 * 1024);
  });

  it('never aims at a file bigger than the original', () => {
    const settings = resolveCompressSettings({ preset: 'size-target', targetSize: 500 }, source());
    expect(settings.targetBytes).toBe(source().fileSize);
    expect(settings.warnings.join(' ')).toMatch(/bigger than the source/i);
  });

  it('derives the quality presets from the picture size', () => {
    const high = resolveCompressSettings({ preset: 'quality-high' }, source());
    const medium = resolveCompressSettings({ preset: 'quality-medium' }, source());
    const low = resolveCompressSettings({ preset: 'quality-low' }, source());
    expect(high.videoBitrate).toBeGreaterThan(medium.videoBitrate);
    expect(medium.videoBitrate).toBeGreaterThan(low.videoBitrate);
    // 1920 × 1080 × 30 fps × 0.15 bits per pixel.
    expect(high.videoBitrate).toBe(8_000_000); // capped by the source bitrate
    expect(medium.videoBitrate).toBe(5_598_720);
    expect(low.videoBitrate).toBe(3_110_400);
    expect(high.warnings.join(' ')).toMatch(/already compressed harder/i);
  });

  it('narrows the video and keeps the aspect ratio', () => {
    const settings = resolveCompressSettings({ width: 1280 }, source());
    expect(settings.width).toBe(1280);
    expect(settings.height).toBe(720);
    expect(settings.widthClamped).toBe(false);
  });

  it('never upscales and says so', () => {
    const settings = resolveCompressSettings({ width: 3840 }, source());
    expect(settings.width).toBe(1920);
    expect(settings.widthClamped).toBe(true);
    expect(settings.warnings.join(' ')).toMatch(/wider than the source/i);
  });

  it('caps the frame rate but never raises it above the source', () => {
    expect(resolveCompressSettings({ fps: 24 }, source()).frameRate).toBe(24);
    expect(resolveCompressSettings({ fps: 60 }, source()).frameRate).toBe(30);
    expect(resolveCompressSettings({ fps: 0 }, source()).frameRate).toBe(30);
    const unknown = resolveCompressSettings({}, source({ frameRate: null }));
    expect(unknown.frameRate).toBe(30);
  });

  it('keeps fractional frame rates', () => {
    expect(resolveCompressSettings({ fps: 29.97 }, source()).frameRate).toBe(29.97);
  });

  it('drops the audio when asked to', () => {
    const settings = resolveCompressSettings({ audio: false }, source());
    expect(settings.keepAudio).toBe(false);
    expect(settings.audioBitrate).toBe(0);
    expect(settings.totalBitrate).toBe(settings.videoBitrate);
  });

  it('notes a clip without an audio track', () => {
    const settings = resolveCompressSettings({}, source({ hasAudio: false, audioBitrate: null }));
    expect(settings.keepAudio).toBe(false);
    expect(settings.audioBitrate).toBe(0);
    expect(settings.warnings.join(' ')).toMatch(/no audio track/i);
  });

  it('accepts the options as strings, the way the form delivers them', () => {
    const settings = resolveCompressSettings(
      { preset: 'size-target', targetSize: '2.5', width: '1280', fps: '24', container: 'webm' },
      source(),
    );
    expect(settings.targetBytes).toBe(2.5 * 1024 * 1024);
    expect(settings.width).toBe(1280);
    expect(settings.frameRate).toBe(24);
    expect(settings.container).toBe('webm');
    expect(settings.extension).toBe('webm');
  });

  it('treats an empty field as "use the default"', () => {
    const settings = resolveCompressSettings({ preset: '', width: '', fps: '' }, source());
    expect(settings.presetId).toBe('size-50');
    expect(settings.width).toBe(1920);
    expect(settings.frameRate).toBe(30);
  });

  it('refuses a value that is not a number instead of guessing', () => {
    expect(() => resolveCompressSettings({ width: 'wide' }, source())).toThrow(/must be a number/i);
    expect(() => resolveCompressSettings({ fps: 'fast' }, source())).toThrow(/must be a number/i);
    expect(() =>
      resolveCompressSettings({ preset: 'size-target', targetSize: 'big' }, source()),
    ).toThrow(/must be a number/i);
    expect(() => resolveCompressSettings({ width: Number.NaN }, source())).toThrow(
      /must be a number/i,
    );
    expect(() => resolveCompressSettings({ fps: true }, source())).toThrow(/must be a number/i);
  });

  it('rejects an unknown preset', () => {
    expect(() => resolveCompressSettings({ preset: 'ultra' }, source())).toThrow(ToolError);
  });

  it('rejects a clip whose length cannot be read', () => {
    expect(() => resolveCompressSettings({}, source({ durationSeconds: null }))).toThrow(
      /length of this clip could not be read/i,
    );
    expect(() => resolveCompressSettings({}, source({ durationSeconds: 0 }))).toThrow(
      /length of this clip could not be read/i,
    );
  });

  it('refuses a clip that is longer than the hard limit', () => {
    expect(() =>
      resolveCompressSettings({}, source({ durationSeconds: COMPRESS_MAX_DURATION_SECONDS + 1 })),
    ).toThrow(/longer than the 60 minute limit/i);
  });

  it('warns about a long clip before it starts', () => {
    const settings = resolveCompressSettings(
      {},
      source({ durationSeconds: COMPRESS_WARN_DURATION_SECONDS + 1 }),
    );
    expect(settings.warnings.join(' ')).toMatch(/minutes long/i);
  });

  it('refuses an output that would not fit in memory', () => {
    expect(() =>
      resolveCompressSettings(
        {},
        source({ fileSize: 1.5 * 1024 ** 3, durationSeconds: COMPRESS_MAX_DURATION_SECONDS }),
      ),
    ).toThrow(/over the 512 MB limit/i);
  });

  it('warns when the produced file is big', () => {
    const settings = resolveCompressSettings(
      {},
      source({ fileSize: 200 * 1024 * 1024, durationSeconds: 900 }),
    );
    expect(settings.estimatedBytes).toBeGreaterThan(COMPRESS_WARN_OUTPUT_BYTES);
    expect(settings.estimatedBytes).toBeLessThan(COMPRESS_MAX_OUTPUT_BYTES);
    expect(settings.warnings.join(' ')).toMatch(/held in memory/i);
  });

  it('rejects impossible dimensions and an empty file', () => {
    expect(() => resolveCompressSettings({}, source({ width: 0 }))).toThrow(
      /invalid frame dimensions/i,
    );
    expect(() => resolveCompressSettings({}, source({ height: Number.NaN }))).toThrow(
      /invalid frame dimensions/i,
    );
    expect(() => resolveCompressSettings({}, source({ fileSize: 0 }))).toThrow(/empty/i);
  });

  it('rejects an absurd width or frame rate', () => {
    expect(() => resolveCompressSettings({ width: COMPRESS_MAX_WIDTH + 1 }, source())).toThrow(
      /3840 pixels or less/i,
    );
    expect(() => resolveCompressSettings({ width: -5 }, source())).toThrow(/0 .* or more/i);
    expect(() => resolveCompressSettings({ fps: 240 }, source())).toThrow(/60 fps or less/i);
    expect(() => resolveCompressSettings({ fps: -1 }, source())).toThrow(/0 .* or more/i);
  });

  it('rejects a target size of zero', () => {
    expect(() =>
      resolveCompressSettings({ preset: 'size-target', targetSize: 0 }, source()),
    ).toThrow(/target size in megabytes/i);
  });

  it('never drops the video bitrate below the floor', () => {
    const settings = resolveCompressSettings(
      { preset: 'size-target', targetSize: 0.1 },
      source({ fileSize: 10 * 1024 * 1024, durationSeconds: 3600 }),
    );
    expect(settings.videoBitrate).toBe(COMPRESS_MIN_VIDEO_BITRATE);
    expect(settings.warnings.join(' ')).toMatch(/larger than the/i);
  });

  it('handles a fractional clip length', () => {
    const settings = resolveCompressSettings(
      {},
      source({ fileSize: 1_250_000, durationSeconds: 2.5 }),
    );
    expect(settings.totalBitrate).toBe(2_000_000);
    expect(settings.estimatedBytes).toBe(625_000);
  });
});

/* -------------------------------------------------------------------------- */
/*  Reporting                                                                  */
/* -------------------------------------------------------------------------- */

describe('formatSizeChange', () => {
  it('describes the change in words', () => {
    expect(formatSizeChange(100, 50)).toBe('50% smaller');
    expect(formatSizeChange(100, 150)).toBe('50% larger');
    expect(formatSizeChange(100, 100)).toBe('the same size');
    expect(formatSizeChange(0, 10)).toBe('an unknown size');
  });

  it('reports the signed percentage', () => {
    expect(sizeChangePercent(100, 50)).toBe(-50);
    expect(sizeChangePercent(100, 150)).toBe(50);
    expect(sizeChangePercent(0, 50)).toBe(0);
  });
});

describe('compressOutputFilename', () => {
  it('adds the -compressed suffix and the new extension', () => {
    expect(compressOutputFilename('clip.mp4', 'mp4')).toBe('clip-compressed.mp4');
    expect(compressOutputFilename('my holiday.MOV', 'webm')).toBe('my holiday-compressed.webm');
    expect(compressOutputFilename('archive.part.mp4', 'mp4')).toBe('archive.part-compressed.mp4');
  });

  it('keeps names without an extension usable and preserves Unicode', () => {
    expect(compressOutputFilename('noext', 'mp4')).toBe('noext-compressed.mp4');
    expect(compressOutputFilename('', 'mp4')).toBe('video-compressed.mp4');
    expect(compressOutputFilename('презентация 日本語 🎥.mkv', 'mp4')).toBe(
      'презентация 日本語 🎥-compressed.mp4',
    );
  });

  it('never keeps a path separator', () => {
    expect(compressOutputFilename('dir/clip.mp4', 'mp4')).toBe('dir_clip-compressed.mp4');
  });
});

/* -------------------------------------------------------------------------- */
/*  Codec selection                                                            */
/* -------------------------------------------------------------------------- */

describe('pickVideoCodec / pickAudioCodec', () => {
  it('picks a codec the browser can encode and the container can hold', async () => {
    const { engine } = fakeEngine({ encodableVideo: ['vp9', 'avc'], encodableAudio: ['aac'] });
    await expect(pickVideoCodec('mp4', { width: 640, height: 360 }, engine)).resolves.toBe('avc');
    await expect(pickVideoCodec('webm', { width: 640, height: 360 }, engine)).resolves.toBe('vp9');
    await expect(pickAudioCodec('mp4', { numberOfChannels: 2 }, engine)).resolves.toBe('aac');
  });

  it('never picks a codec the container cannot hold', async () => {
    const { engine } = fakeEngine({ encodableVideo: ['avc'] });
    // WebM cannot hold H.264, so nothing is offered.
    await expect(pickVideoCodec('webm', { width: 640, height: 360 }, engine)).resolves.toBeNull();
  });

  it('returns null when the browser can encode nothing', async () => {
    const { engine } = fakeEngine({ encodableVideo: [], encodableAudio: [] });
    await expect(pickVideoCodec('mp4', { width: 640, height: 360 }, engine)).resolves.toBeNull();
    await expect(pickAudioCodec('mp4', {}, engine)).resolves.toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/*  Tool plumbing                                                              */
/* -------------------------------------------------------------------------- */

describe('runVideoCompress', () => {
  it('rejects an empty selection', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(ToolError);
  });

  it('rejects a multi-file selection', async () => {
    await expect(tool.run({ files: [file('a.mp4'), file('b.mp4')], options: {} })).rejects.toThrow(
      /one video file/i,
    );
  });

  it('rejects an empty file before the engine is even loaded', async () => {
    await expect(tool.run({ files: [file('empty.mp4', 0)], options: {} })).rejects.toThrow(
      /empty/i,
    );
  });

  const probeOf = (overrides: Partial<VideoProbe> = {}): VideoProbe =>
    ({
      fileName: 'clip.mp4',
      fileSize: 1024 * 1024,
      format: 'MP4',
      formatMime: 'video/mp4',
      mimeType: 'video/mp4',
      durationSeconds: 10,
      durationFromMetadata: true,
      videoTracks: [
        {
          index: 0,
          codec: 'avc',
          codecString: 'avc1.640028',
          codedWidth: 1920,
          codedHeight: 1080,
          displayWidth: 1920,
          displayHeight: 1080,
          rotation: 0,
          frameRate: 30,
          averageBitrate: 8_000_000,
          decodable: true,
          language: null,
        },
      ],
      audioTracks: [
        {
          index: 0,
          codec: 'aac',
          codecString: 'mp4a.40.2',
          channels: 2,
          sampleRate: 48_000,
          averageBitrate: 128_000,
          decodable: true,
          language: null,
        },
      ],
      tags: null,
      webCodecs: true,
      ...overrides,
    }) as VideoProbe;

  const encodedOf = (bytes: Uint8Array, overrides: Record<string, unknown> = {}) => ({
    bytes,
    mimeType: 'video/mp4',
    codec: 'avc',
    audioCodec: 'aac',
    probe: probeOf({ fileSize: bytes.byteLength }),
    warnings: [],
    ...overrides,
  });

  it('returns the compressed file, the notes and the before/after numbers', async () => {
    const deps: CompressDeps = {
      probe: async () => probeOf(),
      encode: async () => encodedOf(new Uint8Array(512 * 1024)),
    };
    const result = await runVideoCompress({ files: [file()], options: {} }, deps);

    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]!.filename).toBe('clip-compressed.mp4');
    expect(result.outputs[0]!.blob.size).toBe(512 * 1024);
    expect(result.outputs[0]!.blob.type).toBe('video/mp4');
    expect(result.notes?.join(' ')).toMatch(/Source 1 MB → compressed 512 KB/);
    expect(result.notes?.join(' ')).toMatch(/50% smaller/);
    expect(result.stats).toMatchObject({
      sourceBytes: 1024 * 1024,
      outputBytes: 512 * 1024,
      savedBytes: 512 * 1024,
    });
    expect(result.report?.render).toBe('table');
    const table = JSON.parse(result.report!.output) as { headers: string[]; rows: string[][] };
    expect(table.headers).toEqual(['Property', 'Value']);
    expect(table.rows.find((row) => row[0] === 'Change')?.[1]).toContain('50% smaller');
  });

  it('warns when the result is not smaller than the source', async () => {
    const deps: CompressDeps = {
      probe: async () => probeOf(),
      encode: async () => encodedOf(new Uint8Array(2 * 1024 * 1024)),
    };
    const result = await runVideoCompress({ files: [file()], options: {} }, deps);
    expect(result.warnings?.join(' ')).toMatch(/came out the same size/i);
  });

  it('passes the resolved options through to the settings', async () => {
    let seen: CompressSettings | undefined;
    const deps: CompressDeps = {
      probe: async () => probeOf(),
      encode: async (_f, settings) => {
        seen = settings;
        return encodedOf(new Uint8Array(1024));
      },
    };
    await runVideoCompress(
      { files: [file()], options: { preset: 'quality-low', width: 640 } },
      deps,
    );
    expect(seen?.presetId).toBe('quality-low');
    expect(seen?.width).toBe(640);
  });

  it('reports progress that only ever moves forward', async () => {
    const fractions: number[] = [];
    const deps: CompressDeps = {
      probe: async () => probeOf(),
      encode: async () => encodedOf(new Uint8Array(1024)),
    };
    await runVideoCompress(
      { files: [file()], options: {}, onProgress: (fraction) => fractions.push(fraction) },
      deps,
    );
    expect(fractions.length).toBeGreaterThan(1);
    expect(fractions.at(-1)).toBeGreaterThan(0);
    for (let i = 1; i < fractions.length; i++) {
      expect(fractions[i]!).toBeGreaterThanOrEqual(fractions[i - 1]!);
    }
  });

  it('keeps a cancelled run a cancellation', async () => {
    const controller = new AbortController();
    controller.abort();
    const deps: CompressDeps = {
      probe: async () => probeOf(),
      encode: async () => encodedOf(new Uint8Array(1024)),
    };
    await expect(
      runVideoCompress({ files: [file()], options: {}, signal: controller.signal }, deps),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});

/* -------------------------------------------------------------------------- */
/*  The engine seam                                                            */
/* -------------------------------------------------------------------------- */

describe('the engine seam', () => {
  it('reports a browser without WebCodecs', async () => {
    const { engine } = fakeEngine();
    vi.stubGlobal('VideoDecoder', undefined);
    vi.stubGlobal('VideoEncoder', undefined);
    try {
      await expect(
        encodeCompressedVideo(file(), resolveCompressSettings({}, source()), source(), {}, engine),
      ).rejects.toThrow(/WebCodecs is not available/i);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('reports a browser that cannot encode anything', async () => {
    const { engine } = fakeEngine({ encodableVideo: [] });
    await withWebCodecsAsync(async () => {
      await expect(
        encodeCompressedVideo(file(), resolveCompressSettings({}, source()), source(), {}, engine),
      ).rejects.toThrow(/cannot encode any video format/i);
    });
  });

  it('reports a clip without a video track', async () => {
    const { engine } = fakeEngine({ hasAudio: true });
    const probe = await probeCompressSource(file(), {}, engine);
    expect(probe.videoTracks).toHaveLength(1);
    expect(() => sourceInfoFromProbe({ ...probe, videoTracks: [] })).toThrow(/no video track/i);
  });
});

/* -------------------------------------------------------------------------- */
/*  The real engine path                                                       */
/* -------------------------------------------------------------------------- */

describe('the real engine path', () => {
  it('rejects malformed bytes with a clear message', async () => {
    const garbage = new File([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])], 'broken.mp4', {
      type: 'video/mp4',
    });
    await expect(tool.run({ files: [garbage], options: {} })).rejects.toThrow(
      /not a video container/i,
    );
  });

  it('says plainly when the browser cannot encode', async () => {
    // jsdom has no WebCodecs, so the real path must say so rather than crash.
    const fake = await fakeEngine();
    const probe = await probeCompressSource(file(), {}, fake.engine);
    const settings = resolveCompressSettings({}, sourceInfoFromProbe(probe));
    await expect(
      encodeCompressedVideo(file(), settings, sourceInfoFromProbe(probe), {}, fake.engine),
    ).rejects.toThrow(/WebCodecs is not available/i);
  });
});

/* -------------------------------------------------------------------------- */
/*  The fake engine end to end                                                 */
/* -------------------------------------------------------------------------- */

describe('the fake engine end to end', () => {
  it('decodes the frames, re-encodes them and hands back a readable file', async () => {
    const frames = defaultFrames();
    const { engine, conversions } = fakeEngine({ frames });
    const deps: CompressDeps = {
      probe: (sourceFile, ctx) => probeCompressSource(sourceFile, ctx, engine),
      encode: (sourceFile, settings, info, ctx) =>
        encodeCompressedVideo(sourceFile, settings, info, ctx, engine),
    };

    const result = await withWebCodecsAsync(() =>
      runVideoCompress({ files: [file('holiday.mp4', 4096)], options: { width: 1280 } }, deps),
    );

    // The bytes that come out really are the frames that went in.
    const encoded = decodeFakeVideo(new Uint8Array(await result.outputs[0]!.blob.arrayBuffer()));
    expect(encoded).toHaveLength(frames.length);
    expect(encoded.map((frame) => frame.timestamp)).toEqual(frames.map((frame) => frame.timestamp));
    // Scaled to the requested width, with the aspect ratio kept.
    expect(encoded[0]!.width).toBe(1280);
    expect(encoded[0]!.height).toBe(720);

    // The encoder was asked for the right things.
    expect(conversions).toHaveLength(1);
    const options = conversions[0] as {
      video: {
        codec: string;
        width: number;
        forceTranscode: boolean;
        quality: { options: { bitrate: number } };
      };
      audio: { codec: string; forceTranscode: boolean; discard?: boolean };
      copy: unknown;
    };
    expect(options.video.codec).toBe('avc');
    expect(options.video.width).toBe(1280);
    expect(options.video.forceTranscode).toBe(true);
    expect(options.video.quality.options.bitrate).toBeGreaterThan(0);
    expect(options.audio.codec).toBe('aac');
    expect(options.audio.forceTranscode).toBe(true);
    // The source packets are never copied over — that would not be compression.
    expect(options.copy).toBe(false);

    expect(result.stats).toMatchObject({ width: 1280, height: 720, codec: 'avc' });
    expect(result.outputs[0]!.filename).toBe('holiday-compressed.mp4');
  });

  it('drops the audio when the browser cannot encode it', async () => {
    const { engine, conversions } = fakeEngine({ encodableAudio: [] });
    const deps: CompressDeps = {
      probe: (sourceFile, ctx) => probeCompressSource(sourceFile, ctx, engine),
      encode: (sourceFile, settings, info, ctx) =>
        encodeCompressedVideo(sourceFile, settings, info, ctx, engine),
    };
    const result = await withWebCodecsAsync(() =>
      runVideoCompress({ files: [file()], options: {} }, deps),
    );
    const options = conversions[0] as { audio: { discard?: boolean; codec?: string } };
    expect(options.audio.discard).toBe(true);
    expect(result.warnings?.join(' ')).toMatch(/cannot encode audio/i);
    expect(result.notes?.join(' ')).toMatch(/No audio/i);
  });

  it('writes a WebM file when that container is asked for', async () => {
    const { engine } = fakeEngine({ encodableVideo: ['vp9'] });
    const deps: CompressDeps = {
      probe: (sourceFile, ctx) => probeCompressSource(sourceFile, ctx, engine),
      encode: (sourceFile, settings, info, ctx) =>
        encodeCompressedVideo(sourceFile, settings, info, ctx, engine),
    };
    const result = await withWebCodecsAsync(() =>
      runVideoCompress({ files: [file('clip.webm')], options: { container: 'webm' } }, deps),
    );
    expect(result.outputs[0]!.filename).toBe('clip-compressed.webm');
    expect(result.stats?.container).toBe('webm');
    expect(result.stats?.codec).toBe('vp9');
  });

  it('turns a cancelled encode into a cancellation', async () => {
    const { engine } = fakeEngine();
    const controller = new AbortController();
    controller.abort();
    await withWebCodecsAsync(async () => {
      await expect(
        encodeCompressedVideo(
          file(),
          resolveCompressSettings({}, source()),
          source(),
          { signal: controller.signal },
          engine,
        ),
      ).rejects.toMatchObject({ name: 'AbortError' });
    });
  });
});
