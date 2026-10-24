import { describe, it, expect, vi } from 'vitest';
import { ToolError } from '@/lib/types';
import type { VideoEngine, VideoProbe } from '@/lib/video';
import {
  checkConvertOutputSize,
  CONTAINERS,
  convertOutputFilename,
  decideConvertPlan,
  estimateTranscodeBytes,
  resolveContainer,
  resolveConvertOptions,
  transcodeVideoBitrate,
  CONVERT_MAX_OUTPUT_BYTES,
  CONVERT_MAX_SOURCE_BYTES,
  type ConvertCapabilities,
  type ConvertSource,
} from './video-convert.core';
import tool, {
  convertCapabilities,
  convertSourceFromProbe,
  convertVideo,
  probeConvertSource,
  runVideoConvert,
  type ConvertDeps,
  type ConvertedVideo,
} from './video-convert.tool';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const file = (name = 'clip.mp4', bytes = 1024): File =>
  new File([new Uint8Array(bytes)], name, { type: 'video/mp4' });

const source = (overrides: Partial<ConvertSource> = {}): ConvertSource => ({
  fileSize: 10 * 1024 * 1024,
  formatName: 'MP4',
  durationSeconds: 10,
  width: 1920,
  height: 1080,
  frameRate: 30,
  videoCodec: 'avc',
  videoCodecLabel: 'H.264 / AVC',
  videoDecodable: true,
  videoBitrate: 8_000_000,
  hasAudio: true,
  audioCodec: 'aac',
  audioDecodable: true,
  audioChannels: 2,
  audioSampleRate: 48_000,
  ...overrides,
});

const caps = (overrides: Partial<ConvertCapabilities> = {}): ConvertCapabilities => ({
  webCodecs: true,
  encodableVideo: ['avc', 'vp9', 'vp8'],
  encodableAudio: ['aac', 'opus'],
  ...overrides,
});

const prefs = (overrides: Partial<Parameters<typeof decideConvertPlan>[1]> = {}) => ({
  container: 'mp4' as const,
  videoCodec: 'auto',
  keepAudio: true,
  ...overrides,
});

/* -------------------------------------------------------------------------- */
/*  Meta                                                                       */
/* -------------------------------------------------------------------------- */

describe('video-convert meta', () => {
  it('is a beta file tool in the video category', () => {
    expect(tool.meta.id).toBe('video-convert');
    expect(tool.meta.category).toBe('video');
    expect(tool.meta.input).toBe('file');
    expect(tool.meta.status).toBe('beta');
    expect(tool.meta.summary.length).toBeLessThanOrEqual(120);
    expect(tool.meta.privacy).toEqual({ processing: 'on-device', network: 'none', offline: true });
  });

  it('offers the four containers the engine can write', () => {
    const options = tool.meta.options ?? [];
    const byKey = new Map(options.map((option) => [option.key, option]));
    const container = byKey.get('container');
    expect(container?.type).toBe('select');
    expect(container?.default).toBe('mp4');
    // The select options are a union member; the narrow view is read once here.
    const choices = (container as { choices: { value: string }[] }).choices;
    expect(choices.map((c) => c.value)).toEqual(['mp4', 'webm', 'mov', 'mkv']);
    expect(byKey.get('videoCodec')?.type).toBe('select');
    expect(byKey.get('videoCodec')?.default).toBe('auto');
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
    expect(tool.meta.related).toContain('video-compress');
    expect(tool.meta.related).toContain('video-info');
  });
});

/* -------------------------------------------------------------------------- */
/*  Containers                                                                 */
/* -------------------------------------------------------------------------- */

describe('CONTAINERS', () => {
  it('maps each container onto its extension and MIME type', () => {
    expect(CONTAINERS.mp4).toMatchObject({ extension: 'mp4', mimeType: 'video/mp4' });
    expect(CONTAINERS.webm).toMatchObject({ extension: 'webm', mimeType: 'video/webm' });
    expect(CONTAINERS.mov).toMatchObject({ extension: 'mov', mimeType: 'video/quicktime' });
    expect(CONTAINERS.mkv).toMatchObject({ extension: 'mkv', mimeType: 'video/x-matroska' });
  });

  it('only lists remux codecs the container genuinely holds', () => {
    for (const codec of CONTAINERS.mp4.remuxVideoCodecs) {
      expect(CONTAINERS.mp4.videoCodecs).toContain(codec);
    }
    for (const codec of CONTAINERS.webm.remuxVideoCodecs) {
      expect(CONTAINERS.webm.videoCodecs).toContain(codec);
    }
    // H.264 is *not* a reliable WebM codec — that is the whole point of the matrix.
    expect(CONTAINERS.webm.remuxVideoCodecs).not.toContain('avc');
    expect(CONTAINERS.mp4.remuxVideoCodecs).not.toContain('vp9');
  });
});

describe('resolveContainer', () => {
  it('accepts the four containers it can write', () => {
    expect(resolveContainer('mp4')).toBe('mp4');
    expect(resolveContainer('webm')).toBe('webm');
    expect(resolveContainer('mov')).toBe('mov');
    expect(resolveContainer('mkv')).toBe('mkv');
    expect(resolveContainer(undefined)).toBe('mp4');
  });

  it('refuses an unknown container instead of guessing', () => {
    expect(() => resolveContainer('avi')).toThrow(/not a container this tool can write/i);
  });
});

/* -------------------------------------------------------------------------- */
/*  Option resolution                                                          */
/* -------------------------------------------------------------------------- */

describe('resolveConvertOptions', () => {
  it('defaults to auto everything', () => {
    expect(resolveConvertOptions({})).toEqual({
      container: 'mp4',
      videoCodec: 'auto',
      keepAudio: true,
    });
  });

  it('maps the human codec names onto codec ids', () => {
    expect(resolveConvertOptions({ videoCodec: 'h264' }).videoCodec).toBe('avc');
    expect(resolveConvertOptions({ videoCodec: 'h265' }).videoCodec).toBe('hevc');
    expect(resolveConvertOptions({ videoCodec: 'vp9' }).videoCodec).toBe('vp9');
  });

  it('reads the audio switch the way the form delivers it', () => {
    expect(resolveConvertOptions({ audio: false }).keepAudio).toBe(false);
    expect(resolveConvertOptions({ audio: 'false' }).keepAudio).toBe(false);
    expect(resolveConvertOptions({ audio: true }).keepAudio).toBe(true);
  });

  it('accepts the values as strings, the way the form delivers them', () => {
    const resolved = resolveConvertOptions({ container: 'webm', videoCodec: 'vp9' });
    expect(resolved.container).toBe('webm');
    expect(resolved.videoCodec).toBe('vp9');
  });

  it('rejects an unknown codec instead of guessing', () => {
    expect(() => resolveConvertOptions({ videoCodec: 'mpeg2' })).toThrow(
      /not a video codec this tool can target/i,
    );
  });
});

/* -------------------------------------------------------------------------- */
/*  The decision matrix                                                        */
/* -------------------------------------------------------------------------- */

describe('decideConvertPlan — the container↔codec matrix', () => {
  it('remuxes H.264 into MP4', () => {
    const plan = decideConvertPlan(source({ videoCodec: 'avc' }), prefs({ container: 'mp4' }), caps());
    expect(plan.video).toEqual({ path: 'remux', codec: 'avc' });
    expect(plan.audio).toEqual({ path: 'remux', codec: 'aac' });
    expect(plan.bitrate).toBeNull();
  });

  it('transcodes H.264 into WebM', () => {
    const plan = decideConvertPlan(
      source({ videoCodec: 'avc' }),
      prefs({ container: 'webm' }),
      caps({ encodableVideo: ['avc', 'vp9'] }),
    );
    expect(plan.video).toEqual({ path: 'transcode', codec: 'vp9' });
    expect(plan.bitrate).toBe(8_000_000);
  });

  it('remuxes VP9 into WebM', () => {
    const plan = decideConvertPlan(
      source({ videoCodec: 'vp9', audioCodec: 'opus' }),
      prefs({ container: 'webm' }),
      caps(),
    );
    expect(plan.video).toEqual({ path: 'remux', codec: 'vp9' });
    expect(plan.audio).toEqual({ path: 'remux', codec: 'opus' });
  });

  it('transcodes VP9 into MP4', () => {
    const plan = decideConvertPlan(
      source({ videoCodec: 'vp9' }),
      prefs({ container: 'mp4' }),
      caps({ encodableVideo: ['avc', 'vp9'] }),
    );
    expect(plan.video).toEqual({ path: 'transcode', codec: 'avc' });
  });

  it('remuxes almost anything into MKV', () => {
    const plan = decideConvertPlan(
      source({ videoCodec: 'hevc', audioCodec: 'flac' }),
      prefs({ container: 'mkv' }),
      caps(),
    );
    expect(plan.video).toEqual({ path: 'remux', codec: 'hevc' });
    expect(plan.audio).toEqual({ path: 'remux', codec: 'flac' });
  });

  it('remuxes H.264 into MOV and MKV', () => {
    for (const container of ['mov', 'mkv'] as const) {
      const plan = decideConvertPlan(source(), prefs({ container }), caps());
      expect(plan.video).toEqual({ path: 'remux', codec: 'avc' });
    }
  });

  it('remuxes ProRes into MOV (the Apple editor case)', () => {
    const plan = decideConvertPlan(
      source({ videoCodec: 'prores', videoCodecLabel: 'Apple ProRes' }),
      prefs({ container: 'mov' }),
      caps(),
    );
    expect(plan.video).toEqual({ path: 'remux', codec: 'prores' });
  });

  it('errors on an unknown video codec that cannot be decoded', () => {
    expect(() =>
      decideConvertPlan(
        source({ videoCodec: null, videoDecodable: false, videoCodecLabel: 'Unknown' }),
        prefs({ container: 'mp4' }),
        caps(),
      ),
    ).toThrow(/cannot decode it for re-encoding/i);
  });

  it('errors when an undecodable exotic codec meets a container it does not fit', () => {
    expect(() =>
      decideConvertPlan(
        source({ videoCodec: 'prores', videoDecodable: false, videoCodecLabel: 'Apple ProRes' }),
        prefs({ container: 'webm' }),
        caps(),
      ),
    ).toThrow(/cannot decode it for re-encoding/i);
  });

  it('transcodes an undecodable-codec-free exotic codec into MP4 only when decodable', () => {
    // VP9 is decodable and the browser can encode H.264: transcode to MP4.
    const plan = decideConvertPlan(
      source({ videoCodec: 'vp9' }),
      prefs({ container: 'mp4' }),
      caps(),
    );
    expect(plan.video).toEqual({ path: 'transcode', codec: 'avc' });
  });

  it('uses the explicit codec when it fits the container and the browser', () => {
    const plan = decideConvertPlan(
      source({ videoCodec: 'vp9' }),
      prefs({ container: 'mp4', videoCodec: 'avc' }),
      caps(),
    );
    expect(plan.video).toEqual({ path: 'transcode', codec: 'avc' });
  });

  it('refuses an explicit codec the container cannot hold', () => {
    expect(() =>
      decideConvertPlan(source(), prefs({ container: 'webm', videoCodec: 'h264' }), caps()),
    ).toThrow(/cannot be stored in WebM/i);
  });

  it('refuses an explicit codec the browser cannot encode — never a silent fallback', () => {
    expect(() =>
      decideConvertPlan(source(), prefs({ container: 'mp4', videoCodec: 'hevc' }), caps()),
    ).toThrow(/cannot encode H\.265/i);
  });

  it('refuses to re-encode when the browser can encode nothing the container needs', () => {
    expect(() =>
      decideConvertPlan(
        source({ videoCodec: 'vp9' }),
        prefs({ container: 'mp4' }),
        caps({ encodableVideo: [] }),
      ),
    ).toThrow(/cannot encode any video format MP4 needs/i);
  });

  it('keeps the audio when it fits and re-encodes it when it does not', () => {
    const plan = decideConvertPlan(
      source({ audioCodec: 'flac' }),
      prefs({ container: 'mp4' }),
      caps(),
    );
    expect(plan.audio).toEqual({ path: 'transcode', codec: 'aac' });
  });

  it('drops the audio when asked to, with a warning', () => {
    const plan = decideConvertPlan(source(), prefs({ keepAudio: false }), caps());
    expect(plan.audio).toEqual({ path: 'drop', codec: null });
    expect(plan.warnings.join(' ')).toMatch(/audio track was dropped/i);
  });

  it('drops the audio without drama when there is none', () => {
    const plan = decideConvertPlan(
      source({ hasAudio: false, audioCodec: null, audioDecodable: false }),
      prefs(),
      caps(),
    );
    expect(plan.audio).toEqual({ path: 'drop', codec: null });
    expect(plan.warnings).toHaveLength(0);
  });

  it('drops an unencodable audio track with a warning instead of failing the run', () => {
    const plan = decideConvertPlan(
      source({ audioCodec: 'dts' }),
      prefs({ container: 'webm' }),
      caps({ encodableAudio: [] }),
    );
    expect(plan.audio).toEqual({ path: 'drop', codec: null });
    expect(plan.warnings.join(' ')).toMatch(/sound track was dropped/i);
  });

  it('drops an undecodable audio codec that does not fit, with a warning', () => {
    const plan = decideConvertPlan(
      source({ audioCodec: 'dts', audioDecodable: false }),
      prefs({ container: 'webm' }),
      caps(),
    );
    expect(plan.audio).toEqual({ path: 'drop', codec: null });
    expect(plan.warnings.join(' ')).toMatch(/sound was left out/i);
  });
});

/* -------------------------------------------------------------------------- */
/*  Bitrate and size                                                           */
/* -------------------------------------------------------------------------- */

describe('transcodeVideoBitrate', () => {
  it('keeps the source bitrate for a like-for-like re-encode', () => {
    expect(transcodeVideoBitrate(source({ videoBitrate: 8_000_000 }))).toBe(8_000_000);
  });

  it('falls back to the default when the source bitrate is unknown', () => {
    expect(transcodeVideoBitrate(source({ videoBitrate: null }))).toBe(4_000_000);
  });

  it('clamps to the supported range', () => {
    expect(transcodeVideoBitrate(source({ videoBitrate: 1_000 }))).toBe(256_000);
    expect(transcodeVideoBitrate(source({ videoBitrate: 999_000_000 }))).toBe(80_000_000);
  });
});

describe('estimateTranscodeBytes', () => {
  it('estimates from the bitrate and the duration', () => {
    const src = source({ videoBitrate: 8_000_000 });
    const plan = decideConvertPlan(
      src,
      prefs({ container: 'webm' }),
      caps({ encodableVideo: ['avc', 'vp9'] }),
    );
    // (8 Mbps video + 128 kbps audio) / 8 × 10 s.
    expect(estimateTranscodeBytes(src, plan)).toBe(10_160_000);
  });

  it('returns null when the duration or the bitrate is unknown', () => {
    const src = source({ videoBitrate: null, durationSeconds: null });
    const plan = decideConvertPlan(src, prefs({ container: 'webm' }), caps());
    expect(estimateTranscodeBytes(src, plan)).toBeNull();
  });
});

describe('checkConvertOutputSize', () => {
  it('passes a normal remux through untouched', () => {
    const src = source();
    const plan = decideConvertPlan(src, prefs({ container: 'mp4' }), caps());
    expect(checkConvertOutputSize(src, plan)).toEqual([]);
  });

  it('warns when the output is large but allowed', () => {
    const src = source({ fileSize: 100 * 1024 * 1024 });
    const plan = decideConvertPlan(src, prefs({ container: 'mp4' }), caps());
    expect(checkConvertOutputSize(src, plan).join(' ')).toMatch(/held in memory/i);
  });

  it('refuses an output that would not fit in memory', () => {
    const src = source({ fileSize: CONVERT_MAX_OUTPUT_BYTES + 1024 });
    const plan = decideConvertPlan(src, prefs({ container: 'mkv' }), caps());
    expect(() => checkConvertOutputSize(src, plan)).toThrow(/512 MB/i);
  });

  it('warns instead of guessing when the transcode size is unpredictable', () => {
    const src = source({ videoBitrate: null, durationSeconds: null });
    const plan = decideConvertPlan(
      src,
      prefs({ container: 'webm' }),
      caps({ encodableVideo: ['avc', 'vp9'] }),
    );
    expect(checkConvertOutputSize(src, plan).join(' ')).toMatch(/cannot be predicted/i);
  });
});

/* -------------------------------------------------------------------------- */
/*  Reporting                                                                  */
/* -------------------------------------------------------------------------- */

describe('convertOutputFilename', () => {
  it('adds the -converted suffix and the new extension', () => {
    expect(convertOutputFilename('clip.mkv', 'mp4')).toBe('clip-converted.mp4');
    expect(convertOutputFilename('my holiday.mp4', 'webm')).toBe('my holiday-converted.webm');
    expect(convertOutputFilename('archive.part.mp4', 'mov')).toBe('archive.part-converted.mov');
  });

  it('keeps names without an extension usable and preserves Unicode', () => {
    expect(convertOutputFilename('noext', 'mkv')).toBe('noext-converted.mkv');
    expect(convertOutputFilename('', 'mp4')).toBe('video-converted.mp4');
    expect(convertOutputFilename('презентация 日本語 🎥.webm', 'mkv')).toBe(
      'презентация 日本語 🎥-converted.mkv',
    );
  });

  it('never keeps a path separator', () => {
    expect(convertOutputFilename('dir/clip.mp4', 'mp4')).toBe('dir_clip-converted.mp4');
  });
});

/* -------------------------------------------------------------------------- */
/*  A fake video engine                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The fake engine writes a tiny, self-describing binary format instead of a
 * real video: a magic number, the track description and the codec strings the
 * conversion was asked for. That is enough to prove that the conversion really
 * ran and that the output really can be read back.
 */
const FAKE_MAGIC = 0x434f4e56; // 'CONV'

function encodeFakeVideo(videoCodec: string, audioCodec: string | null): Uint8Array {
  const header = new TextEncoder().encode(`${videoCodec}|${audioCodec ?? ''}`);
  const bytes = new Uint8Array(8 + header.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, FAKE_MAGIC);
  view.setUint32(4, header.length);
  bytes.set(header, 8);
  return bytes;
}

function looksLikeFakeVideo(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength >= 8 &&
    new DataView(bytes.buffer, bytes.byteOffset, 8).getUint32(0) === FAKE_MAGIC
  );
}

function decodeFakeVideo(bytes: Uint8Array): { videoCodec: string; audioCodec: string | null } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const header = new TextDecoder().decode(bytes.slice(8, 8 + view.getUint32(4)));
  const [videoCodec, audioCodec] = header.split('|');
  return { videoCodec: videoCodec!, audioCodec: audioCodec || null };
}

interface FakeEngineConfig {
  videoCodec?: string | null;
  audioCodec?: string | null;
  videoDecodable?: boolean;
  hasAudio?: boolean;
  encodableVideo?: string[];
  encodableAudio?: string[];
  containerFormats?: Record<string, { video: string[]; audio: string[]; mime: string; ext: string }>;
}

const DEFAULT_CONTAINER_FORMATS: Record<
  string,
  { video: string[]; audio: string[]; mime: string; ext: string }
> = {
  Mp4OutputFormat: {
    video: ['avc', 'hevc', 'vp9', 'av1', 'vp8'],
    audio: ['aac', 'opus'],
    mime: 'video/mp4',
    ext: 'mp4',
  },
  WebMOutputFormat: { video: ['vp9', 'vp8', 'av1'], audio: ['opus', 'vorbis'], mime: 'video/webm', ext: 'webm' },
  MovOutputFormat: {
    video: ['avc', 'hevc', 'vp9', 'av1', 'vp8', 'prores'],
    audio: ['aac', 'opus'],
    mime: 'video/quicktime',
    ext: 'mov',
  },
  MkvOutputFormat: {
    video: ['avc', 'hevc', 'vp9', 'vp8', 'av1', 'prores'],
    audio: ['aac', 'opus', 'flac'],
    mime: 'video/x-matroska',
    ext: 'mkv',
  },
};

function fakeEngine(config: FakeEngineConfig = {}) {
  const videoCodec = config.videoCodec ?? 'avc';
  const audioCodec = config.audioCodec ?? 'aac';
  const hasAudio = config.hasAudio ?? true;
  const encodableVideo = config.encodableVideo ?? ['avc', 'vp9', 'vp8'];
  const encodableAudio = config.encodableAudio ?? ['aac', 'opus'];
  const formats = config.containerFormats ?? DEFAULT_CONTAINER_FORMATS;

  const conversions: Record<string, any>[] = [];
  const disposed: unknown[] = [];

  class FakeBlobSource {
    constructor(public blob: Blob) {}
  }

  class FakeInput {
    constructor(public options: { source: FakeBlobSource }) {}

    /**
     * The codecs the blob actually carries: a converted output holds the
     * codec the conversion wrote, a fresh source the configured ones.
     */
    private async blobCodecs(): Promise<{ videoCodec: string; audioCodec: string | null }> {
      const bytes = new Uint8Array(await this.options.source.blob.arrayBuffer());
      if (looksLikeFakeVideo(bytes)) return decodeFakeVideo(bytes);
      return { videoCodec: videoCodec, audioCodec: hasAudio ? audioCodec : null };
    }

    async getFormat() {
      return { name: 'MP4', mimeType: 'video/mp4' };
    }

    async getVideoTracks() {
      const codecs = await this.blobCodecs();
      return [
        {
          getCodec: async () => codecs.videoCodec,
          getCodecParameterString: async () => 'avc1.640028',
          getCodedWidth: async () => 1920,
          getCodedHeight: async () => 1080,
          getDisplayWidth: async () => 1920,
          getDisplayHeight: async () => 1080,
          getRotation: async () => 0,
          getAverageBitrate: async () => 8_000_000,
          canDecode: async () => config.videoDecodable ?? true,
          getLanguageCode: async () => 'und',
          computeFrameRateMetrics: async () => ({ bestGuessFrameRate: 30 }),
        },
      ];
    }

    async getAudioTracks() {
      const codecs = await this.blobCodecs();
      if (!codecs.audioCodec) return [];
      return [
        {
          getCodec: async () => codecs.audioCodec,
          getCodecParameterString: async () => 'mp4a.40.2',
          getNumberOfChannels: async () => 2,
          getSampleRate: async () => 48_000,
          getAverageBitrate: async () => 128_000,
          canDecode: async () => true,
          getLanguageCode: async () => 'und',
        },
      ];
    }

    async getDurationFromMetadata() {
      return 10;
    }

    async computeDuration() {
      return 10;
    }

    async getMetadataTags() {
      return {};
    }

    async getMimeType() {
      return 'video/mp4; codecs="avc1.640028"';
    }

    async getPrimaryVideoTrack() {
      return (await this.getVideoTracks())[0] ?? null;
    }

    async getPrimaryAudioTrack() {
      return (await this.getAudioTracks())[0] ?? null;
    }

    dispose() {
      disposed.push(this);
    }
  }

  class FakeBufferTarget {
    buffer: ArrayBuffer | null = null;
  }

  class FakeFormat {
    constructor(public key: string) {}
    get spec() {
      return formats[this.key]!;
    }
    get fileExtension() {
      return this.spec.ext;
    }
    get mimeType() {
      return this.spec.mime;
    }
    getSupportedCodecs() {
      return [...this.spec.video, ...this.spec.audio];
    }
    getSupportedVideoCodecs() {
      return this.spec.video;
    }
    getSupportedAudioCodecs() {
      return this.spec.audio;
    }
    get supportsVideoTransformationMetadata() {
      return true;
    }
  }

  class FakeOutput {
    constructor(public options: { format: FakeFormat; target: FakeBufferTarget }) {}
    async getMimeType() {
      return this.options.format.mimeType;
    }
  }

  class FakeQuality {
    constructor(public options: { bitrate?: number }) {}
  }

  class FakeConversion {
    onProgress?: (progress: number, processedTime: number) => void;
    isValid = true;
    utilizedTracks: unknown[] = [];
    discardedTracks: { track: { type: string }; reason: string }[] = [];
    state = 'idle';

    constructor(public options: Record<string, any>) {
      conversions.push(options);
    }

    static async init(options: Record<string, any>) {
      const conversion = new FakeConversion(options);
      const videoOptions = options.video as Record<string, any> | undefined;
      const audioOptions = options.audio as Record<string, any> | undefined;
      if (videoOptions?.discard) {
        conversion.discardedTracks.push({
          track: { type: 'video' },
          reason: 'discarded_by_user',
        });
        conversion.isValid = false;
      }
      if (audioOptions?.discard) {
        conversion.discardedTracks.push({
          track: { type: 'audio' },
          reason: 'discarded_by_user',
        });
      }
      return conversion;
    }

    async execute() {
      const output = this.options.output as FakeOutput;
      const videoOptions = this.options.video as Record<string, any> | undefined;
      const audioOptions = this.options.audio as Record<string, any> | undefined;
      const outVideoCodec = videoOptions?.discard
        ? 'none'
        : (videoOptions?.codec ?? videoCodec);
      const outAudioCodec = !hasAudio || audioOptions?.discard
        ? null
        : (audioOptions?.codec ?? audioCodec);
      const target = output.options.target;
      target.buffer = encodeFakeVideo(outVideoCodec, outAudioCodec).buffer as ArrayBuffer;
      this.onProgress?.(0, 0);
      this.onProgress?.(1, 10);
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
        super('Mp4OutputFormat');
      }
    },
    WebMOutputFormat: class extends FakeFormat {
      constructor() {
        super('WebMOutputFormat');
      }
    },
    MovOutputFormat: class extends FakeFormat {
      constructor() {
        super('MovOutputFormat');
      }
    },
    MkvOutputFormat: class extends FakeFormat {
      constructor() {
        super('MkvOutputFormat');
      }
    },
    ALL_FORMATS: [],
    VIDEO_CODECS: ['avc', 'hevc', 'vp9', 'av1', 'vp8', 'prores'],
    AUDIO_CODECS: ['aac', 'opus', 'vorbis', 'flac'],
    getEncodableVideoCodecs: async () => encodableVideo,
    getEncodableAudioCodecs: async () => encodableAudio,
  } as unknown as VideoEngine;

  return { engine, conversions, disposed };
}

/* -------------------------------------------------------------------------- */
/*  A fake WebCodecs environment                                               */
/* -------------------------------------------------------------------------- */

/**
 * Stub the WebCodecs globals a Chromium-like browser would have. The fake
 * encoder accepts every config, which is what the engine's codec queries need
 * to report a non-empty encoder list.
 */
async function withWebCodecsAsync<T>(fn: () => Promise<T>): Promise<T> {
  vi.stubGlobal('VideoDecoder', class FakeVideoDecoder {});
  vi.stubGlobal(
    'VideoEncoder',
    class FakeVideoEncoder {
      static async isConfigSupported() {
        return { supported: true };
      }
      configure(): void {}
      encode(): void {}
      async flush(): Promise<void> {}
      close(): void {}
    },
  );
  vi.stubGlobal(
    'AudioEncoder',
    class FakeAudioEncoder {
      static async isConfigSupported() {
        return { supported: true };
      }
      configure(): void {}
      encode(): void {}
      async flush(): Promise<void> {}
      close(): void {}
    },
  );
  vi.stubGlobal('VideoFrame', class FakeVideoFrame { close(): void {} });
  try {
    return await fn();
  } finally {
    vi.unstubAllGlobals();
  }
}

/* -------------------------------------------------------------------------- */
/*  Probing with the fake engine                                               */
/* -------------------------------------------------------------------------- */

describe('probeConvertSource / convertSourceFromProbe', () => {
  it('reads the source description from the container', async () => {
    const { engine } = fakeEngine({ videoCodec: 'avc' });
    const probe = await probeConvertSource(file(), {}, engine);
    const info = convertSourceFromProbe(probe);
    expect(info.videoCodec).toBe('avc');
    expect(info.videoDecodable).toBe(true);
    expect(info.hasAudio).toBe(true);
    expect(info.audioCodec).toBe('aac');
    expect(info.width).toBe(1920);
    expect(info.durationSeconds).toBe(10);
  });

  it('reports an audio-only file as an error', async () => {
    const { engine } = fakeEngine();
    const probe = await probeConvertSource(file(), {}, engine);
    expect(() => convertSourceFromProbe({ ...probe, videoTracks: [] })).toThrow(/no video track/i);
  });

  it('rejects a file that is not a video container at all', async () => {
    const garbage = new File([new Uint8Array([1, 2, 3, 4])], 'broken.mp4', { type: 'video/mp4' });
    await expect(tool.run({ files: [garbage], options: {} })).rejects.toThrow(
      /not a video container/i,
    );
  });
});

/* -------------------------------------------------------------------------- */
/*  Capabilities                                                               */
/* -------------------------------------------------------------------------- */

describe('convertCapabilities', () => {
  it('reports an empty set without WebCodecs', async () => {
    vi.stubGlobal('VideoDecoder', undefined);
    try {
      await expect(convertCapabilities()).resolves.toEqual({
        webCodecs: false,
        encodableVideo: [],
        encodableAudio: [],
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('asks the engine what it can encode', async () => {
    const { engine } = fakeEngine({ encodableVideo: ['vp9'] });
    vi.stubGlobal('VideoDecoder', class {});
    try {
      await expect(convertCapabilities(engine)).resolves.toEqual({
        webCodecs: true,
        encodableVideo: ['vp9'],
        encodableAudio: ['aac', 'opus'],
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  The conversion                                                             */
/* -------------------------------------------------------------------------- */

describe('convertVideo', () => {
  it('copies the source codec on a remux and the new codec on a transcode', async () => {
    const { engine } = fakeEngine();
    const src = source();
    await withWebCodecsAsync(async () => {
      // Remux: the output carries whatever the source had.
      const remux = await convertVideo(
        file(),
        decideConvertPlan(src, prefs({ container: 'mp4' }), caps()),
        src,
        {},
        engine,
      );
      expect(remux.videoPath).toBe('remux');
      expect(decodeFakeVideo(remux.bytes).videoCodec).toBe('avc');

      // Transcode: the output carries the codec the plan asked for.
      const transcode = await convertVideo(
        file(),
        decideConvertPlan(
          src,
          prefs({ container: 'webm' }),
          caps({ encodableVideo: ['avc', 'vp9'] }),
        ),
        src,
        {},
        engine,
      );
      expect(transcode.videoPath).toBe('transcode');
      // AAC does not fit WebM, so the audio is re-encoded to Opus as well.
      expect(decodeFakeVideo(transcode.bytes)).toEqual({ videoCodec: 'vp9', audioCodec: 'opus' });
    });
  });

  it('passes the discard options for a dropped audio track', async () => {
    const { engine, conversions } = fakeEngine();
    const src = source();
    await withWebCodecsAsync(async () => {
      await convertVideo(
        file(),
        decideConvertPlan(src, prefs({ keepAudio: false }), caps()),
        src,
        {},
        engine,
      );
      expect(conversions[0]!.audio).toMatchObject({ discard: true });
      expect(conversions[0]!.video).toEqual({});
    });
  });

  it('configures the encoder when transcoding', async () => {
    const { engine, conversions } = fakeEngine();
    const src = source({ videoBitrate: 6_000_000 });
    await withWebCodecsAsync(async () => {
      await convertVideo(
        file(),
        decideConvertPlan(
          src,
          prefs({ container: 'webm' }),
          caps({ encodableVideo: ['avc', 'vp9'] }),
        ),
        src,
        {},
        engine,
      );
      expect(conversions[0]!.video).toMatchObject({ codec: 'vp9' });
      expect(conversions[0]!.video.quality.options.bitrate).toBe(6_000_000);
      // AAC does not fit WebM, so the audio is re-encoded to Opus as well.
      expect(conversions[0]!.audio).toMatchObject({ codec: 'opus' });
    });
  });

  it('reports progress that only ever moves forward', async () => {
    const { engine } = fakeEngine();
    const src = source();
    const fractions: number[] = [];
    await withWebCodecsAsync(async () => {
      await convertVideo(
        file(),
        decideConvertPlan(src, prefs({ container: 'mp4' }), caps()),
        src,
        { onProgress: (fraction) => fractions.push(fraction) },
        engine,
      );
    });
    expect(fractions.length).toBeGreaterThan(1);
    for (let i = 1; i < fractions.length; i++) {
      expect(fractions[i]!).toBeGreaterThanOrEqual(fractions[i - 1]!);
    }
  });

  it('keeps a cancelled run a cancellation', async () => {
    const { engine } = fakeEngine();
    const controller = new AbortController();
    controller.abort();
    await withWebCodecsAsync(async () => {
      await expect(
        convertVideo(
          file(),
          decideConvertPlan(source(), prefs({ container: 'mp4' }), caps()),
          source(),
          { signal: controller.signal },
          engine,
        ),
      ).rejects.toMatchObject({ name: 'AbortError' });
    });
  });
});

/* -------------------------------------------------------------------------- */
/*  Tool plumbing                                                              */
/* -------------------------------------------------------------------------- */

describe('runVideoConvert', () => {
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

  const convertedOf = (bytes: Uint8Array, overrides: Record<string, unknown> = {}) =>
    ({
      bytes,
      mimeType: 'video/mp4',
      videoPath: 'remux',
      videoCodec: 'avc',
      audioCodec: 'aac',
      audioPath: 'remux',
      probe: probeOf({ fileSize: bytes.byteLength }),
      ...overrides,
    }) as ConvertedVideo;

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

  it('returns the converted file, the notes and the conversion table', async () => {
    const deps: ConvertDeps = {
      probe: async () => probeOf(),
      convert: async () => convertedOf(new Uint8Array(1024 * 1024)),
    };
    const result = await runVideoConvert({ files: [file()], options: {} }, deps);

    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]!.filename).toBe('clip-converted.mp4');
    expect(result.outputs[0]!.blob.type).toBe('video/mp4');
    expect(result.notes?.join(' ')).toMatch(/Remuxed \(stream copy\)/);
    expect(result.notes?.join(' ')).toMatch(/Source 1 MB → converted 1 MB/);
    expect(result.stats).toMatchObject({
      videoPath: 'remux',
      container: 'mp4',
      videoCodec: 'avc',
    });
    expect(result.report?.render).toBe('table');
    const table = JSON.parse(result.report!.output) as { headers: string[]; rows: string[][] };
    expect(table.rows.find((row) => row[0] === 'Conversion')?.[1]).toBe('Remux (stream copy)');
  });

  it('reports a transcode clearly when the codecs do not fit', async () => {
    const result = await withWebCodecsAsync(async () => {
      const deps: ConvertDeps = {
        probe: async () => probeOf(),
        convert: async () =>
          convertedOf(new Uint8Array(1024), {
            videoPath: 'transcode',
            videoCodec: 'vp9',
            audioPath: 'transcode',
            audioCodec: 'opus',
          }),
      };
      return runVideoConvert(
        { files: [file('clip.mp4')], options: { container: 'webm' } },
        deps,
      );
    });
    expect(result.outputs[0]!.filename).toBe('clip-converted.webm');
    expect(result.notes?.join(' ')).toMatch(/Re-encoded to VP9/);
    expect(result.notes?.join(' ')).toMatch(/Re-encoded to OPUS/i);
    expect(result.stats).toMatchObject({ videoPath: 'transcode', container: 'webm' });
    const table = JSON.parse(result.report!.output) as { rows: string[][] };
    expect(table.rows.find((row) => row[0] === 'Conversion')?.[1]).toBe('Transcode (re-encode)');
  });

  it('warns when the audio was dropped on purpose', async () => {
    const deps: ConvertDeps = {
      probe: async () => probeOf(),
      convert: async () =>
        convertedOf(new Uint8Array(1024), { audioPath: 'drop', audioCodec: null }),
    };
    const result = await runVideoConvert({ files: [file()], options: { audio: false } }, deps);
    expect(result.warnings?.join(' ')).toMatch(/audio track was dropped/i);
  });

  it('passes the resolved options through to the plan', async () => {
    let seenContainer: string | undefined;
    const deps: ConvertDeps = {
      probe: async () => probeOf(),
      convert: async (_f, plan) => {
        seenContainer = plan.container;
        return convertedOf(new Uint8Array(1024));
      },
    };
    await runVideoConvert({ files: [file()], options: { container: 'mkv' } }, deps);
    expect(seenContainer).toBe('mkv');
  });

  it('rejects an unknown container before any work starts', async () => {
    await expect(
      tool.run({ files: [file()], options: { container: 'avi' } }),
    ).rejects.toThrow(/not a container this tool can write/i);
  });

  it('rejects an unknown codec before any work starts', async () => {
    await expect(
      tool.run({ files: [file()], options: { videoCodec: 'mpeg2' } }),
    ).rejects.toThrow(/not a video codec this tool can target/i);
  });

  it('reports progress that only ever moves forward', async () => {
    const fractions: number[] = [];
    const deps: ConvertDeps = {
      probe: async () => probeOf(),
      convert: async () => convertedOf(new Uint8Array(1024)),
    };
    await runVideoConvert(
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
    const deps: ConvertDeps = {
      probe: async () => probeOf(),
      convert: async () => convertedOf(new Uint8Array(1024)),
    };
    await expect(
      runVideoConvert({ files: [file()], options: {}, signal: controller.signal }, deps),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});

/* -------------------------------------------------------------------------- */
/*  The fake engine end to end                                                 */
/* -------------------------------------------------------------------------- */

describe('the fake engine end to end', () => {
  it('plans, converts and hands back a readable file', async () => {
    const { engine } = fakeEngine({ videoCodec: 'avc', audioCodec: 'aac' });
    const deps: ConvertDeps = {
      probe: (sourceFile, ctx) => probeConvertSource(sourceFile, ctx, engine),
      convert: (sourceFile, plan, info, ctx) =>
        convertVideo(sourceFile, plan, info, ctx, engine),
    };

    const result = await withWebCodecsAsync(() =>
      runVideoConvert(
        { files: [file('holiday.mkv', 4096)], options: { container: 'mp4' } },
        deps,
      ),
    );

    // H.264 into MP4 remuxes: the output carries the source codec untouched.
    expect(result.outputs[0]!.filename).toBe('holiday-converted.mp4');
    const written = decodeFakeVideo(
      new Uint8Array(await result.outputs[0]!.blob.arrayBuffer()),
    );
    expect(written).toEqual({ videoCodec: 'avc', audioCodec: 'aac' });
    expect(result.stats).toMatchObject({ videoPath: 'remux' });
  });

  it('transcodes H.264 into WebM when asked', async () => {
    const { engine, conversions } = fakeEngine({ videoCodec: 'avc' });
    const deps: ConvertDeps = {
      probe: (sourceFile, ctx) => probeConvertSource(sourceFile, ctx, engine),
      convert: (sourceFile, plan, info, ctx) =>
        convertVideo(sourceFile, plan, info, ctx, engine),
    };

    const result = await withWebCodecsAsync(() =>
      runVideoConvert(
        { files: [file('holiday.mp4', 4096)], options: { container: 'webm' } },
        deps,
      ),
    );

    expect(result.stats).toMatchObject({ videoPath: 'transcode', container: 'webm' });
    const written = decodeFakeVideo(
      new Uint8Array(await result.outputs[0]!.blob.arrayBuffer()),
    );
    expect(written.videoCodec).toBe('vp9');
    // The encoder was asked for the source's own bitrate, so quality holds.
    expect(conversions[0]!.video.quality.options.bitrate).toBe(8_000_000);
  });

  it('fails clearly when the browser cannot decode the source at all', async () => {
    const { engine } = fakeEngine({ videoCodec: 'prores', videoDecodable: false });
    const deps: ConvertDeps = {
      probe: (sourceFile, ctx) => probeConvertSource(sourceFile, ctx, engine),
      convert: (sourceFile, plan, info, ctx) =>
        convertVideo(sourceFile, plan, info, ctx, engine),
    };
    await withWebCodecsAsync(async () => {
      await expect(
        runVideoConvert(
          { files: [file('prores.mov', 4096)], options: { container: 'webm' } },
          deps,
        ),
      ).rejects.toThrow(/cannot decode it for re-encoding/i);
    });
  });
});

/* -------------------------------------------------------------------------- */
/*  Limits                                                                     */
/* -------------------------------------------------------------------------- */

describe('limits', () => {
  it('matches the shared probe ceiling', () => {
    expect(CONVERT_MAX_SOURCE_BYTES).toBe(2 * 1024 ** 3);
  });

  it('refuses a source file past the ceiling up front', async () => {
    const big = new File([new Uint8Array(8)], 'huge.mp4');
    Object.defineProperty(big, 'size', { value: CONVERT_MAX_SOURCE_BYTES + 1 });
    await expect(tool.run({ files: [big], options: {} })).rejects.toThrow(
      /larger than the 2 GB limit/i,
    );
  });
});
