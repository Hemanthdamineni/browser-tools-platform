import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import {
  assertDecodeBudget,
  assertVideoFile,
  buildVideoProbeReport,
  chooseVideoEncoder,
  describeAudioCodec,
  describeVideoCodec,
  formatBitrate,
  formatFrameRate,
  formatResolution,
  formatTimecode,
  isVideoEngineLoaded,
  isWebCodecsAvailable,
  openVideoWith,
  probeVideoFile,
  probeVideoFileWith,
  videoCapabilities,
  VIDEO_PROBE_MAX_BYTES,
  type VideoEngine,
  type VideoProbeOptions,
  type VideoTrackInfo,
} from './index';

/* -------------------------------------------------------------------------- */
/*  Fake engine — a structural stand-in for Mediabunny with no real codec      */
/* -------------------------------------------------------------------------- */

type Method = (...args: never[]) => Promise<unknown>;

function videoTrack(overrides: Record<string, unknown> = {}): Record<string, Method> {
  return {
    getCodec: async () => 'avc',
    getCodecParameterString: async () => 'avc1.640028',
    getCodedWidth: async () => 1920,
    getCodedHeight: async () => 1080,
    getDisplayWidth: async () => 1920,
    getDisplayHeight: async () => 1080,
    getRotation: async () => 0,
    getAverageBitrate: async () => 5_000_000,
    canDecode: async () => true,
    getLanguageCode: async () => 'und',
    computeFrameRateMetrics: async () => ({ bestGuessFrameRate: 30 }),
    ...(overrides as Record<string, Method>),
  };
}

function audioTrack(overrides: Record<string, unknown> = {}): Record<string, Method> {
  return {
    getCodec: async () => 'aac',
    getCodecParameterString: async () => 'mp4a.40.2',
    getNumberOfChannels: async () => 2,
    getSampleRate: async () => 48000,
    getAverageBitrate: async () => 128_000,
    canDecode: async () => true,
    getLanguageCode: async () => 'eng',
    ...(overrides as Record<string, Method>),
  };
}

interface EngineConfig {
  format?: { name: string; mimeType: string };
  formatThrows?: boolean;
  tracksThrow?: boolean;
  videoTracks?: Record<string, Method>[];
  audioTracks?: Record<string, Method>[];
  durationFromMetadata?: number | null;
  metadataDurationThrows?: boolean;
  computedDuration?: number | null;
  tags?: Record<string, unknown>;
  mimeType?: string;
}

function fakeEngine(config: EngineConfig = {}) {
  const calls: string[] = [];
  let disposed = false;

  const input = {
    getFormat: async () => {
      calls.push('getFormat');
      if (config.formatThrows) throw new Error('UnsupportedInputFormatError');
      return config.format ?? { name: 'MP4', mimeType: 'video/mp4' };
    },
    getVideoTracks: async () => {
      calls.push('getVideoTracks');
      if (config.tracksThrow) throw new Error('truncated');
      return config.videoTracks ?? [videoTrack()];
    },
    getAudioTracks: async () => config.audioTracks ?? [audioTrack()],
    getDurationFromMetadata: async () => {
      calls.push('getDurationFromMetadata');
      if (config.metadataDurationThrows) throw new Error('no metadata duration');
      return config.durationFromMetadata ?? null;
    },
    computeDuration: async () => {
      calls.push('computeDuration');
      return config.computedDuration === undefined ? 90.5 : config.computedDuration;
    },
    getMetadataTags: async () => config.tags ?? {},
    getMimeType: async () => config.mimeType ?? 'video/mp4; codecs="avc1.640028, mp4a.40.2"',
    getPrimaryVideoTrack: async () => (config.videoTracks ?? [videoTrack()])[0] ?? null,
    getPrimaryAudioTrack: async () => (config.audioTracks ?? [audioTrack()])[0] ?? null,
    dispose: () => {
      disposed = true;
      calls.push('dispose');
    },
  };

  class Input {
    constructor(public options: unknown) {}
    getFormat = input.getFormat;
    getVideoTracks = input.getVideoTracks;
    getAudioTracks = input.getAudioTracks;
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

  const engine = { Input, BlobSource, ALL_FORMATS: [] } as unknown as VideoEngine;
  return { engine, calls, isDisposed: () => disposed };
}

const file = (name = 'clip.mp4', bytes = 1024): File =>
  new File([new Uint8Array(bytes)], name, { type: 'video/mp4' });

/* -------------------------------------------------------------------------- */
/*  Validation & limits                                                       */
/* -------------------------------------------------------------------------- */

describe('video engine validation', () => {
  it('rejects missing and empty files before touching the engine', async () => {
    expect(() => assertVideoFile(null)).toThrow(ToolError);
    await expect(probeVideoFile(file('empty.mp4', 0))).rejects.toThrow(/empty/i);
    // Validation happens up-front, so the heavy engine must stay unloaded.
    expect(isVideoEngineLoaded()).toBe(false);
  });

  it('rejects files past the size ceiling with a hint', () => {
    const huge = file('huge.mp4', 8);
    Object.defineProperty(huge, 'size', { value: VIDEO_PROBE_MAX_BYTES + 1 });
    try {
      assertVideoFile(huge);
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ToolError);
      expect((error as ToolError).message).toMatch(/larger than/i);
      expect((error as ToolError).hint).toBeTruthy();
    }
    expect(() => assertVideoFile(huge, VIDEO_PROBE_MAX_BYTES + 1)).not.toThrow();
  });

  it('flags impossible and oversized frames', () => {
    expect(() => assertDecodeBudget(3840, 2160)).not.toThrow();
    expect(() => assertDecodeBudget(0, 1080)).toThrow(ToolError);
    expect(() => assertDecodeBudget(Number.NaN, 1080)).toThrow(ToolError);
    expect(() => assertDecodeBudget(20_000, 20_000)).toThrow(/More pixels|more pixels/i);
  });
});

/* -------------------------------------------------------------------------- */
/*  Capability gate                                                           */
/* -------------------------------------------------------------------------- */

describe('video capabilities', () => {
  it('reports no WebCodecs (jsdom) without loading the engine', async () => {
    expect(isWebCodecsAvailable()).toBe(false);
    await expect(videoCapabilities()).resolves.toEqual({
      webCodecs: false,
      decodable: [],
      encodable: [],
    });
    await expect(chooseVideoEncoder(['avc'])).resolves.toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/*  probeVideoFileWith                                                        */
/* -------------------------------------------------------------------------- */

describe('probeVideoFileWith', () => {
  it('reads container, duration and tracks, and always disposes the input', async () => {
    const { engine, isDisposed } = fakeEngine({
      durationFromMetadata: 90.5,
      tags: { title: 'Holiday', artist: 'Zoe', date: new Date('2024-05-01T00:00:00Z') },
    });
    const probe = await probeVideoFileWith(engine, file('Holiday 🎬.mp4'));

    expect(probe.fileName).toBe('Holiday 🎬.mp4');
    expect(probe.format).toBe('MP4');
    expect(probe.mimeType).toContain('avc1.640028');
    expect(probe.durationSeconds).toBe(90.5);
    expect(probe.durationFromMetadata).toBe(true);
    expect(probe.videoTracks).toHaveLength(1);
    expect(probe.audioTracks).toHaveLength(1);
    expect(probe.tags).toEqual({
      title: 'Holiday',
      artist: 'Zoe',
      date: '2024-05-01T00:00:00.000Z',
    });
    expect(isDisposed()).toBe(true);

    const v = probe.videoTracks[0]!;
    expect(v).toMatchObject({
      index: 0,
      codec: 'avc',
      codedWidth: 1920,
      displayWidth: 1920,
      decodable: true,
      // frame rate needs an explicit scan
      frameRate: null,
    });
    // 'und' is not a meaningful language tag.
    expect(v.language).toBeNull();
    expect(probe.audioTracks[0]!.language).toBe('eng');
  });

  it('falls back to a packet scan when metadata has no duration', async () => {
    const { engine, calls } = fakeEngine({ computedDuration: 12.25 });
    const probe = await probeVideoFileWith(engine, file());
    expect(probe.durationSeconds).toBe(12.25);
    expect(probe.durationFromMetadata).toBe(false);
    expect(calls).toContain('computeDuration');
  });

  it('reports an unknown duration instead of inventing one', async () => {
    const { engine } = fakeEngine({ computedDuration: null });
    const probe = await probeVideoFileWith(engine, file());
    expect(probe.durationSeconds).toBeNull();
    expect(probe.durationFromMetadata).toBe(false);
  });

  it('honours scanFrames, readTags and checkDecode', async () => {
    const { engine } = fakeEngine({ tags: { title: 'T' } });
    const probe = await probeVideoFileWith(engine, file(), {
      scanFrames: true,
      readTags: false,
      checkDecode: false,
    });
    expect(probe.videoTracks[0]!.frameRate).toBe(30);
    expect(probe.videoTracks[0]!.decodable).toBe(false);
    expect(probe.audioTracks[0]!.decodable).toBe(false);
    expect(probe.tags).toBeNull();
  });

  it('degrades optional getters instead of failing the probe', async () => {
    const { engine } = fakeEngine({
      videoTracks: [
        videoTrack({
          getDisplayWidth: async () => {
            throw new Error('absent');
          },
          getAverageBitrate: async () => {
            throw new Error('absent');
          },
          getLanguageCode: async () => {
            throw new Error('absent');
          },
          getRotation: async () => 90,
        }),
      ],
    });
    const probe = await probeVideoFileWith(engine, file());
    expect(probe.videoTracks[0]).toMatchObject({
      displayWidth: 1920, // fell back to coded width
      averageBitrate: null,
      language: null,
      rotation: 90,
    });
  });

  it('rejects an unsupported container with a helpful hint', async () => {
    const { engine } = fakeEngine({ formatThrows: true });
    await expect(probeVideoFileWith(engine, file('notes.txt'))).rejects.toMatchObject({
      name: 'ToolError',
      hint: expect.stringMatching(/containers/i),
    });
  });

  it('rejects a file with no video track', async () => {
    const { engine } = fakeEngine({ videoTracks: [], audioTracks: [audioTrack()] });
    await expect(probeVideoFileWith(engine, file('song.mp3'))).rejects.toThrow(/no video track/i);
  });

  it('rejects a truncated file whose tracks cannot be read', async () => {
    const { engine, isDisposed } = fakeEngine({ tracksThrow: true });
    await expect(probeVideoFileWith(engine, file())).rejects.toThrow(/truncated or corrupt/i);
    expect(isDisposed()).toBe(true);
  });

  it('emits monotonic progress ending at 1', async () => {
    const { engine } = fakeEngine();
    const fractions: number[] = [];
    await probeVideoFileWith(engine, file(), {
      onProgress: (fraction) => fractions.push(fraction),
    });
    expect(fractions.length).toBeGreaterThan(2);
    expect(fractions.at(-1)).toBe(1);
    for (let i = 1; i < fractions.length; i++) {
      expect(fractions[i]!).toBeGreaterThanOrEqual(fractions[i - 1]!);
    }
  });

  it('aborts without producing a result', async () => {
    const { engine } = fakeEngine();
    const controller = new AbortController();
    controller.abort();
    const options: VideoProbeOptions = { signal: controller.signal };
    await expect(probeVideoFileWith(engine, file(), options)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});

/* -------------------------------------------------------------------------- */
/*  openVideoWith                                                             */
/* -------------------------------------------------------------------------- */

describe('openVideoWith', () => {
  it('hands back a live input, primary tracks and a working dispose', async () => {
    const { engine, isDisposed } = fakeEngine({ durationFromMetadata: 8 });
    const opened = await openVideoWith(engine, file('clip.mp4'));

    expect(opened.formatName).toBe('MP4');
    expect(opened.durationSeconds).toBe(8);
    expect(opened.videoTrack).toBeTruthy();
    expect(opened.audioTrack).toBeTruthy();
    expect(isDisposed()).toBe(false);
    opened.dispose();
    expect(isDisposed()).toBe(true);
  });

  it('disposes the input when the container cannot be read', async () => {
    const { engine, isDisposed } = fakeEngine({ formatThrows: true });
    await expect(openVideoWith(engine, file('nope.txt'))).rejects.toThrow(/not a video container/i);
    expect(isDisposed()).toBe(true);
  });

  it('honours an already-aborted signal', async () => {
    const { engine, isDisposed } = fakeEngine();
    const controller = new AbortController();
    controller.abort();
    await expect(
      openVideoWith(engine, file(), { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(isDisposed()).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/*  Pure formatting                                                           */
/* -------------------------------------------------------------------------- */
describe('video formatting helpers', () => {
  it('formats timecodes, including sub-second precision', () => {
    expect(formatTimecode(0)).toBe('0:00.000');
    expect(formatTimecode(65.5)).toBe('1:05.500');
    expect(formatTimecode(3661.25)).toBe('1:01:01.250');
    expect(formatTimecode(59.9999)).toBe('1:00.000');
    expect(formatTimecode(null)).toBe('—');
    expect(formatTimecode(-1)).toBe('—');
    expect(formatTimecode(Number.NaN)).toBe('—');
  });

  it('formats frame rates and bitrates', () => {
    expect(formatFrameRate(30)).toBe('30 fps');
    expect(formatFrameRate(29.97)).toBe('29.97 fps');
    expect(formatFrameRate(0)).toBe('—');
    expect(formatFrameRate(null)).toBe('—');

    expect(formatBitrate(128_000)).toBe('128 kbps');
    expect(formatBitrate(5_000_000)).toBe('5.00 Mbps');
    expect(formatBitrate(900)).toBe('900 bps');
    expect(formatBitrate(0)).toBe('—');
    expect(formatBitrate(undefined)).toBe('—');
  });

  it('names codecs, including raw parameter strings', () => {
    expect(describeVideoCodec('avc', 'avc1.640028')).toBe('H.264 / AVC (avc1.640028)');
    expect(describeVideoCodec('vp9', 'vp09.00.10.08')).toBe('VP9 (vp09.00.10.08)');
    expect(describeVideoCodec('avc', 'avc')).toBe('H.264 / AVC');
    expect(describeVideoCodec(null)).toBe('Unknown');
    expect(describeVideoCodec('weird')).toBe('WEIRD');

    expect(describeAudioCodec('aac', 'mp4a.40.2')).toBe('AAC (mp4a.40.2)');
    expect(describeAudioCodec('pcm-s16')).toBe('PCM S16');
    expect(describeAudioCodec(null)).toBe('Unknown');
  });

  it('describes resolution with coded size and rotation only when they differ', () => {
    const base: VideoTrackInfo = {
      index: 0,
      codec: 'avc',
      codecString: null,
      codedWidth: 1920,
      codedHeight: 1080,
      displayWidth: 1920,
      displayHeight: 1080,
      rotation: 0,
      frameRate: null,
      averageBitrate: null,
      decodable: true,
      language: null,
    };
    expect(formatResolution(base)).toBe('1920 × 1080');
    expect(formatResolution({ ...base, codedWidth: 1088 })).toBe('1920 × 1080 (coded 1088 × 1080)');
    expect(formatResolution({ ...base, rotation: 90 })).toBe('1920 × 1080 (rotated 90°)');
  });
});

/* -------------------------------------------------------------------------- */
/*  Report builder                                                            */
/* -------------------------------------------------------------------------- */

describe('buildVideoProbeReport', () => {
  it('renders known and unknown values honestly', () => {
    const report = buildVideoProbeReport({
      fileName: 'café ☕.mov',
      fileSize: 1500,
      format: 'QuickTime File Format',
      formatMime: 'video/quicktime',
      mimeType: 'video/quicktime',
      durationSeconds: 62,
      durationFromMetadata: false,
      webCodecs: false,
      videoTracks: [
        {
          index: 0,
          codec: 'hevc',
          codecString: 'hvc1.1.6.L93.B0',
          codedWidth: 3840,
          codedHeight: 2160,
          displayWidth: 3840,
          displayHeight: 2160,
          rotation: 0,
          frameRate: null,
          averageBitrate: null,
          decodable: false,
          language: 'en',
        },
      ],
      audioTracks: [],
      tags: null,
    });

    expect(report.headers).toEqual(['Property', 'Value']);
    const map = new Map(report.rows as [string, string][]);
    expect(map.get('File name')).toBe('café ☕.mov');
    expect(map.get('File size')).toBe('1.46 KB (1,500 bytes)');
    expect(map.get('Duration')).toBe('1:02.000');
    expect(map.get('Duration source')).toBe('Packet scan');
    expect(map.get('WebCodecs decoding')).toBe('Not available in this browser');
    expect(map.get('Video tracks')).toBe('1');
    expect(map.get('Audio tracks')).toBe('0');
    expect(map.get('Video track 1 · Codec')).toBe('H.265 / HEVC (hvc1.1.6.L93.B0)');
    expect(map.get('Video track 1 · Frame rate')).toMatch(/Not measured/);
    expect(map.get('Video track 1 · Bitrate')).toBe('—');
    expect(map.get('Video track 1 · Decodable here')).toBe('No');
    expect(map.get('Video track 1 · Language')).toBe('en');

    // Every row is a header/value pair — the table renderer requires two columns.
    for (const row of report.rows) expect(row).toHaveLength(2);
  });

  it('labels missing durations and tags clearly', () => {
    const report = buildVideoProbeReport({
      fileName: 'x.webm',
      fileSize: 10,
      format: 'WebM',
      formatMime: 'video/webm',
      mimeType: 'video/webm',
      durationSeconds: null,
      durationFromMetadata: false,
      webCodecs: true,
      videoTracks: [],
      audioTracks: [],
      tags: { title: 'Clip' },
    });
    const map = new Map(report.rows as [string, string][]);
    expect(map.get('Duration')).toBe('Not available');
    expect(map.get('Duration source')).toBe('—');
    expect(map.get('Title')).toBe('Clip');
  });
});
