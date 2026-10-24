import { describe, it, expect, vi } from 'vitest';
import { ToolError } from '@/lib/types';
import type { OptionValues } from '@/lib/types';
import type { VideoEngine } from '@/lib/video';
import {
  buildTrimReport,
  classifyTrimMode,
  describeDiscardReason,
  formatTrimTime,
  parseTrimTime,
  resolveContainerSpec,
  resolveCopyMode,
  resolveTrimFormat,
  resolveTrimSettings,
  trimOutputFilename,
  TRIM_COPY_MODES,
  TRIM_FORMATS,
  TRIM_MIN_SECONDS,
  type TrimContainerSpec,
  type TrimModeVerdict,
} from './video-trim.core';
import tool, { runVideoTrim, trimVideo, type TrimResult } from './video-trim.tool';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const file = (name = 'clip.mp4', bytes = 2048): File =>
  new File([new Uint8Array(bytes)], name, { type: 'video/mp4' });

/* -------------------------------------------------------------------------- */
/*  A stand-in for the Mediabunny engine                                       */
/* -------------------------------------------------------------------------- */

/** What happens to a track of the conversion. */
type TrackOutcome = 'copy' | 'reencode' | 'drop' | 'none';

interface FakeEngineConfig {
  /** Length of the clip in seconds. */
  durationSeconds?: number;
  /** The container name the engine reports, e.g. "MP4". */
  formatName?: string;
  /** Whether the file has a video track. */
  hasVideoTrack?: boolean;
  /** Whether the file has an audio track. */
  hasAudioTrack?: boolean;
  /** Codec string of the input video track (`null` = the container does not say). */
  videoCodec?: string | null;
  /** Codec string of the input audio track (`null` = unknown). */
  audioCodec?: string | null;
  /** What happens to the video track. */
  video?: TrackOutcome;
  /** What happens to the audio track. */
  audio?: TrackOutcome;
  /** The codec string the video track ends up with when it was re-encoded. */
  reencodedVideoCodec?: string;
  /** The codec string the audio track ends up with when it was re-encoded. */
  reencodedAudioCodec?: string;
  /** Tracks the engine refused to include. */
  discarded?: { type: 'video' | 'audio'; reason: string }[];
  /** Whether the conversion is invalid (nothing could be written). */
  invalid?: boolean;
  /** An error thrown while the conversion runs. */
  executeError?: Error;
  /** Whether the conversion hangs until it is cancelled. */
  hang?: boolean;
  /** How many bytes the finished file has. */
  bytes?: number;
}

interface FakeOutputTrack {
  type: 'video' | 'audio';
  source: unknown;
  codec: string;
  isVideoTrack(): boolean;
  isAudioTrack(): boolean;
}

/**
 * A structural stand-in for the Mediabunny engine: no real codec, but the
 * same shape the tool talks to. The output tracks say whether the packets
 * were copied, and the MIME type carries the resulting codec strings.
 */
function fakeEngine(config: FakeEngineConfig = {}): VideoEngine {
  const duration = config.durationSeconds ?? 10;
  const formatName = config.formatName ?? 'MP4';
  const videoCodec = config.videoCodec === undefined ? 'avc1.640028' : config.videoCodec;
  const audioCodec = config.audioCodec === undefined ? 'mp4a.40.2' : config.audioCodec;
  const videoOutcome = config.video ?? 'copy';
  const audioOutcome = config.audio ?? 'copy';
  const outputBytes = config.bytes ?? 4096;

  class EncodedVideoPacketSource {
    constructor(public codec: string) {}
  }
  class VideoSampleSource {
    constructor(public codec: string) {}
  }
  class EncodedAudioPacketSource {
    constructor(public codec: string) {}
  }
  class AudioSampleSource {
    constructor(public codec: string) {}
  }

  class BufferTarget {
    buffer: ArrayBuffer | null = null;
  }

  class Output {
    tracks: FakeOutputTrack[] = [];
    constructor(public options: { format: unknown; target: BufferTarget }) {}

    addVideoTrack(source: unknown): FakeOutputTrack {
      const track: FakeOutputTrack = {
        type: 'video',
        source,
        codec: '',
        isVideoTrack: () => true,
        isAudioTrack: () => false,
      };
      this.tracks.push(track);
      return track;
    }

    addAudioTrack(source: unknown): FakeOutputTrack {
      const track: FakeOutputTrack = {
        type: 'audio',
        source,
        codec: '',
        isVideoTrack: () => false,
        isAudioTrack: () => true,
      };
      this.tracks.push(track);
      return track;
    }

    async getMimeType(): Promise<string> {
      const codecs = this.tracks.map((track) => track.codec).filter(Boolean);
      return codecs.length ? `video/mp4; codecs="${codecs.join(', ')}"` : 'video/mp4';
    }

    /** The real engine writes the file when the output is finalized. */
    finalize(): void {
      this.options.target.buffer = new Uint8Array(outputBytes).buffer;
    }
  }

  class Conversion {
    isValid = true;
    discardedTracks: { track: { type: string }; reason: string; trackOptions: unknown }[] = [];
    onProgress?: (fraction: number, processedTime: number) => unknown;
    state: 'idle' | 'executing' | 'done' | 'canceled' = 'idle';
    private cancelRun: (() => void) | null = null;

    constructor(private options: Record<string, unknown>) {
      this.setup();
    }

    static async init(options: Record<string, unknown>): Promise<Conversion> {
      return new Conversion(options);
    }

    /** Mirror the real engine: the output tracks are created up front. */
    private setup(): void {
      const opts = this.options;
      const output = opts.output as Output;
      const audioOptions = (opts.audio ?? {}) as { discard?: boolean };
      const copy = opts.copy as { mode?: string } | false | undefined;
      const neverCopy = copy === false;
      const video = neverCopy && videoOutcome === 'copy' ? 'reencode' : videoOutcome;
      const audio = audioOptions.discard
        ? 'none'
        : neverCopy && audioOutcome === 'copy'
          ? 'reencode'
          : audioOutcome;

      if (video !== 'drop') {
        const track = output.addVideoTrack(
          video === 'copy' ? new EncodedVideoPacketSource('avc') : new VideoSampleSource('avc'),
        );
        track.codec =
          video === 'copy'
            ? (videoCodec ?? 'avc1.640028')
            : (config.reencodedVideoCodec ?? 'avc1.42E01E');
      }

      if (audio !== 'none' && audio !== 'drop' && !audioOptions.discard) {
        const track = output.addAudioTrack(
          audio === 'copy' ? new EncodedAudioPacketSource('aac') : new AudioSampleSource('aac'),
        );
        track.codec =
          audio === 'copy'
            ? (audioCodec ?? 'mp4a.40.2')
            : (config.reencodedAudioCodec ?? 'mp4a.40.2');
      }

      for (const entry of config.discarded ?? []) {
        this.discardedTracks.push({
          track: { type: entry.type },
          reason: entry.reason,
          trackOptions: {},
        });
      }
      if (config.invalid) this.isValid = false;
    }

    async execute(): Promise<void> {
      this.state = 'executing';
      if (config.executeError) throw config.executeError;
      if (config.hang) {
        await new Promise<void>((_resolve, reject) => {
          this.cancelRun = () => reject(new DOMException('cancelled', 'AbortError'));
        });
      }
      this.onProgress?.(0.5, 1);
      this.onProgress?.(1, 2);
      (this.options.output as Output).finalize();
      this.state = 'done';
    }

    async cancel(): Promise<void> {
      this.state = 'canceled';
      this.cancelRun?.();
    }
  }

  class OutputFormat {
    constructor(public kind: string) {}
    get fileExtension(): string {
      return '.mp4';
    }
    get mimeType(): string {
      return 'video/mp4';
    }
  }
  class Mp4OutputFormat extends OutputFormat {
    constructor() {
      super('mp4');
    }
  }
  class WebMOutputFormat extends OutputFormat {
    constructor() {
      super('webm');
    }
  }
  class MkvOutputFormat extends OutputFormat {
    constructor() {
      super('mkv');
    }
  }
  class MovOutputFormat extends OutputFormat {
    constructor() {
      super('mov');
    }
  }

  const videoTrack = {
    type: 'video' as const,
    getDisplayWidth: async () => 640,
    getDisplayHeight: async () => 360,
    getDecoderConfig: async () => (videoCodec ? { codec: videoCodec } : null),
  };
  const audioTrack = {
    type: 'audio' as const,
    getDecoderConfig: async () => (audioCodec ? { codec: audioCodec } : null),
  };

  class Input {
    constructor(public options: unknown) {}
    getFormat = async () => ({ name: formatName, mimeType: 'video/mp4' });
    getDurationFromMetadata = async () => duration;
    computeDuration = async () => duration;
    getMetadataTags = async () => ({});
    getMimeType = async () => 'video/mp4';
    getPrimaryVideoTrack = async () => (config.hasVideoTrack === false ? null : videoTrack);
    getPrimaryAudioTrack = async () => (config.hasAudioTrack === false ? null : audioTrack);
    dispose = () => {};
  }
  class BlobSource {
    constructor(public blob: Blob) {}
  }

  return {
    Input,
    BlobSource,
    Output,
    BufferTarget,
    Conversion,
    Mp4OutputFormat,
    WebMOutputFormat,
    MkvOutputFormat,
    MovOutputFormat,
    EncodedVideoPacketSource,
    EncodedAudioPacketSource,
    VideoSampleSource,
    AudioSampleSource,
    ALL_FORMATS: [],
  } as unknown as VideoEngine;
}

/* -------------------------------------------------------------------------- */
/*  Meta                                                                       */
/* -------------------------------------------------------------------------- */

describe('video-trim meta', () => {
  it('is a beta file tool in the video category with its own panel', () => {
    expect(tool.meta.id).toBe('video-trim');
    expect(tool.meta.category).toBe('video');
    expect(tool.meta.input).toBe('file');
    expect(tool.meta.panel).toBe('video-trim');
    expect(tool.meta.status).toBe('beta');
    expect(tool.meta.accept).toContain('video/*');
    expect(tool.meta.summary.length).toBeLessThanOrEqual(120);
    expect(tool.meta.privacy).toEqual({
      processing: 'on-device',
      network: 'none',
      offline: true,
    });
  });

  it('declares at least three examples, each valid for this tool\u2019s input', () => {
    const examples = tool.meta.examples ?? [];
    expect(examples.length).toBeGreaterThanOrEqual(3);
    const knownKeys = new Set((tool.meta.options ?? []).map((option) => option.key));
    for (const example of examples) {
      expect(example.title.length).toBeGreaterThan(0);
      for (const key of Object.keys(example.options ?? {})) {
        expect(knownKeys.has(key)).toBe(true);
      }
    }
  });

  it('offers a start time, an end time, a container and a copy mode', () => {
    const options = tool.meta.options ?? [];
    const byKey = new Map(options.map((option) => [option.key, option]));
    expect(byKey.get('start')?.type).toBe('text');
    expect(byKey.get('end')?.type).toBe('text');
    expect(byKey.get('format')?.type).toBe('select');
    expect(byKey.get('format')?.default).toBe('source');
    expect(byKey.get('copyMode')?.type).toBe('select');
    expect(byKey.get('copyMode')?.default).toBe('preferred');
    expect(byKey.get('keepAudio')?.type).toBe('boolean');
    expect(byKey.get('keepAudio')?.default).toBe(true);
  });

  it('labels every option and explains it', () => {
    for (const option of tool.meta.options ?? []) {
      expect(option.label.length).toBeGreaterThan(0);
      expect(option.help?.length).toBeGreaterThan(0);
    }
  });

  it('credits mediabunny with its licence', () => {
    expect(tool.meta.credits?.find((credit) => credit.name === 'mediabunny')?.license).toBe(
      'MPL-2.0',
    );
  });
});

/* -------------------------------------------------------------------------- */
/*  Time parsing                                                               */
/* -------------------------------------------------------------------------- */

describe('parseTrimTime', () => {
  it('reads plain seconds', () => {
    expect(parseTrimTime('12')).toBe(12);
    expect(parseTrimTime('12.5')).toBe(12.5);
    expect(parseTrimTime(' 7 ')).toBe(7);
  });

  it('reads M:SS and H:MM:SS', () => {
    expect(parseTrimTime('1:30')).toBe(90);
    expect(parseTrimTime('0:01:30')).toBe(90);
    expect(parseTrimTime('1:02:03')).toBe(3723);
    expect(parseTrimTime('90:00')).toBe(5400);
  });

  it('rejects an empty or unparseable time', () => {
    expect(() => parseTrimTime('')).toThrow(ToolError);
    expect(() => parseTrimTime('   ')).toThrow(/empty/i);
    expect(() => parseTrimTime('later')).toThrow(/invalid time/i);
    expect(() => parseTrimTime('1:2:3:4')).toThrow(/invalid time/i);
    expect(() => parseTrimTime('1:xx')).toThrow(/invalid time/i);
  });

  it('rejects a negative time', () => {
    expect(() => parseTrimTime('-5')).toThrow(/0 seconds or more/i);
    expect(() => parseTrimTime('-0:30')).toThrow(/0 seconds or more/i);
  });

  it('rejects a seconds field of 60 or more', () => {
    expect(() => parseTrimTime('1:90')).toThrow(/seconds part/i);
    expect(() => parseTrimTime('0:90:30')).toThrow(/minutes part/i);
  });

  it('names the field it could not read', () => {
    expect(() => parseTrimTime('nope', 'The in point')).toThrow(/the in point/i);
  });
});

describe('formatTrimTime', () => {
  it('writes the times back in the form the parser reads', () => {
    expect(formatTrimTime(0)).toBe('0:00');
    expect(formatTrimTime(90)).toBe('1:30');
    expect(formatTrimTime(3723)).toBe('1:02:03');
    expect(formatTrimTime(1.5)).toBe('0:01.500');
  });

  it('round-trips through the parser', () => {
    for (const seconds of [0, 5, 61, 599, 3600, 3723.25]) {
      expect(parseTrimTime(formatTrimTime(seconds))).toBeCloseTo(seconds, 3);
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  Container and copy mode                                                    */
/* -------------------------------------------------------------------------- */

describe('resolveTrimFormat', () => {
  it('knows the four containers', () => {
    expect(TRIM_FORMATS.map((format) => format.id)).toEqual(['source', 'mp4', 'webm', 'mkv']);
    expect(resolveTrimFormat('mp4').id).toBe('mp4');
    expect(resolveTrimFormat('webm').id).toBe('webm');
    expect(resolveTrimFormat('mkv').id).toBe('mkv');
    expect(resolveTrimFormat('source').id).toBe('source');
  });

  it('falls back to the source container for an empty value', () => {
    expect(resolveTrimFormat('').id).toBe('source');
    expect(resolveTrimFormat(undefined).id).toBe('source');
  });

  it('rejects an unknown container', () => {
    expect(() => resolveTrimFormat('avi')).toThrow(ToolError);
    expect(() => resolveTrimFormat('avi')).toThrow(/not a known output format/i);
  });
});

describe('resolveContainerSpec', () => {
  const spec = (id: string, sourceName = ''): TrimContainerSpec =>
    resolveContainerSpec(resolveTrimFormat(id), sourceName);

  it('follows the source container when the user picks "same as the source"', () => {
    expect(spec('source', 'MP4')).toMatchObject({
      kind: 'mp4',
      extension: '.mp4',
      mimeType: 'video/mp4',
    });
    expect(spec('source', 'WebM').kind).toBe('webm');
    expect(spec('source', 'Matroska').kind).toBe('mkv');
    expect(spec('source', 'QuickTime').kind).toBe('mov');
    // MPEG-TS has no matching output container — MP4 is the safe answer.
    expect(spec('source', 'MPEG-TS').kind).toBe('mp4');
  });

  it('uses the chosen container whatever the source is', () => {
    expect(spec('webm', 'MP4')).toMatchObject({
      kind: 'webm',
      extension: '.webm',
      mimeType: 'video/webm',
    });
    expect(spec('mkv', 'WebM').kind).toBe('mkv');
  });
});

describe('resolveCopyMode', () => {
  it('knows the three strategies', () => {
    expect(TRIM_COPY_MODES.map((mode) => mode.id)).toEqual(['preferred', 'forced', 'never']);
    expect(resolveCopyMode('forced')).toBe('forced');
    expect(resolveCopyMode(undefined)).toBe('preferred');
  });

  it('rejects an unknown strategy', () => {
    expect(() => resolveCopyMode('maybe')).toThrow(/not a known way to cut/i);
  });
});

/* -------------------------------------------------------------------------- */
/*  Settings                                                                   */
/* -------------------------------------------------------------------------- */

describe('resolveTrimSettings', () => {
  const source = { durationSeconds: 10, formatName: 'MP4' };

  it('cuts the whole clip by default', () => {
    const settings = resolveTrimSettings({}, source);
    expect(settings.startSeconds).toBe(0);
    expect(settings.endSeconds).toBe(10);
    expect(settings.rangeSeconds).toBe(10);
    expect(settings.format.id).toBe('source');
    expect(settings.copyMode).toBe('preferred');
    expect(settings.keepAudio).toBe(true);
  });

  it('honours an explicit range', () => {
    const settings = resolveTrimSettings({ start: 2, end: 5 }, source);
    expect(settings.startSeconds).toBe(2);
    expect(settings.endSeconds).toBe(5);
    expect(settings.rangeSeconds).toBe(3);
  });

  it('accepts the times the way the form and the panel deliver them', () => {
    const settings = resolveTrimSettings(
      { start: '0:10', end: '0:20' },
      { durationSeconds: 60, formatName: 'MP4' },
    );
    expect(settings.startSeconds).toBe(10);
    expect(settings.endSeconds).toBe(20);
  });

  it('treats an empty field as "not set"', () => {
    const settings = resolveTrimSettings({ start: '', end: '' }, source);
    expect(settings.startSeconds).toBe(0);
    expect(settings.endSeconds).toBe(10);
  });

  it('rejects a range that starts after it ends', () => {
    expect(() => resolveTrimSettings({ start: 5, end: 2 }, source)).toThrow(ToolError);
    expect(() => resolveTrimSettings({ start: 5, end: 2 }, source)).toThrow(/before the end time/i);
  });

  it('rejects a zero-length range', () => {
    expect(() => resolveTrimSettings({ start: 3, end: 3 }, source)).toThrow(/before the end time/i);
  });

  it('rejects a negative start', () => {
    expect(() => resolveTrimSettings({ start: -1 }, source)).toThrow(ToolError);
    expect(() => resolveTrimSettings({ start: '-1' }, source)).toThrow(/0 seconds or more/i);
  });

  it('rejects an end past the end of the clip', () => {
    expect(() => resolveTrimSettings({ end: 30 }, source)).toThrow(/past the end of the clip/i);
  });

  it('rejects a start past the end of the clip', () => {
    expect(() => resolveTrimSettings({ start: 30 }, source)).toThrow(/past the end of the clip/i);
  });

  it('rejects an unparseable time', () => {
    expect(() => resolveTrimSettings({ start: 'soon' }, source)).toThrow(/invalid time/i);
    expect(() => resolveTrimSettings({ end: 'later' }, source)).toThrow(/invalid time/i);
  });

  it('rejects a range that is too short to hold a frame', () => {
    expect(() => resolveTrimSettings({ start: 1, end: 1 + TRIM_MIN_SECONDS / 2 }, source)).toThrow(
      /too short/i,
    );
  });

  it('refuses to guess when the duration is unknown', () => {
    expect(() => resolveTrimSettings({}, { durationSeconds: null, formatName: 'MP4' })).toThrow(
      /length of this clip could not be read/i,
    );
    // An explicit end time still works — the clip is simply not checked.
    const settings = resolveTrimSettings({ end: 4 }, { durationSeconds: null, formatName: 'MP4' });
    expect(settings.endSeconds).toBe(4);
  });

  it('rejects a clip with no duration at all', () => {
    expect(() => resolveTrimSettings({}, { durationSeconds: 0, formatName: 'MP4' })).toThrow(
      /no duration/i,
    );
  });

  it('drops the audio when it is asked to', () => {
    expect(resolveTrimSettings({ keepAudio: false }, source).keepAudio).toBe(false);
    expect(resolveTrimSettings({ keepAudio: 'false' }, source).keepAudio).toBe(false);
    expect(resolveTrimSettings({ keepAudio: true }, source).keepAudio).toBe(true);
  });

  it('rejects an unknown container or copy mode', () => {
    expect(() => resolveTrimSettings({ format: 'avi' }, source)).toThrow(ToolError);
    expect(() => resolveTrimSettings({ copyMode: 'maybe' }, source)).toThrow(ToolError);
  });
});

/* -------------------------------------------------------------------------- */
/*  Copy vs re-encode                                                          */
/* -------------------------------------------------------------------------- */

describe('classifyTrimMode', () => {
  const copied = {
    inputCodec: 'avc1.640028',
    outputCodec: 'avc1.640028',
    copied: true,
  };

  it('calls an unchanged codec a lossless stream copy', () => {
    const verdict = classifyTrimMode({
      video: copied,
      audio: { inputCodec: 'mp4a.40.2', outputCodec: 'mp4a.40.2', copied: true },
      copyMode: 'preferred',
    });
    expect(verdict.kind).toBe('copy');
    expect(verdict.lossless).toBe(true);
    expect(verdict.label).toMatch(/stream copy/i);
    expect(verdict.label).toMatch(/lossless/i);
    expect(verdict.video).toBe('copied');
    expect(verdict.audio).toBe('copied');
  });

  it('never calls a changed codec a stream copy', () => {
    const verdict = classifyTrimMode({
      video: { inputCodec: 'avc1.640028', outputCodec: 'avc1.42E01E', copied: true },
      audio: null,
      copyMode: 'preferred',
    });
    expect(verdict.kind).toBe('reencode');
    expect(verdict.lossless).toBe(false);
    expect(verdict.label).not.toMatch(/stream copy/i);
    expect(verdict.video).toBe('reencoded');
  });

  it('never calls a re-encoded track a stream copy', () => {
    const verdict = classifyTrimMode({
      video: { ...copied, copied: false },
      audio: null,
      copyMode: 'preferred',
    });
    expect(verdict.kind).toBe('reencode');
    expect(verdict.lossless).toBe(false);
  });

  it('reports a mixed cut when only some tracks were copied', () => {
    const verdict = classifyTrimMode({
      video: copied,
      audio: { inputCodec: 'mp4a.40.2', outputCodec: 'opus', copied: false },
      copyMode: 'preferred',
    });
    expect(verdict.kind).toBe('mixed');
    expect(verdict.lossless).toBe(false);
    expect(verdict.video).toBe('copied');
    expect(verdict.audio).toBe('reencoded');
  });

  it('never claims a copy in "always re-encode" mode', () => {
    const verdict = classifyTrimMode({
      video: copied,
      audio: { inputCodec: 'mp4a.40.2', outputCodec: 'mp4a.40.2', copied: true },
      copyMode: 'never',
    });
    expect(verdict.kind).toBe('reencode');
    expect(verdict.lossless).toBe(false);
    expect(verdict.video).toBe('reencoded');
  });

  it('does not claim losslessness when the codec cannot be checked', () => {
    const verdict = classifyTrimMode({
      video: { inputCodec: null, outputCodec: null, copied: true },
      audio: null,
      copyMode: 'preferred',
    });
    expect(verdict.kind).toBe('copy');
    expect(verdict.lossless).toBe(false);
    expect(verdict.video).toBe('unknown');
    expect(verdict.label).toMatch(/could not be verified/i);
  });

  it('treats a clip without an audio track as a clean copy', () => {
    const verdict = classifyTrimMode({
      video: copied,
      audio: null,
      copyMode: 'preferred',
    });
    expect(verdict.kind).toBe('copy');
    expect(verdict.lossless).toBe(true);
    expect(verdict.audio).toBe('absent');
  });

  it('compares codec strings without caring about their case', () => {
    const verdict = classifyTrimMode({
      video: { inputCodec: 'avc1.42E01E', outputCodec: 'avc1.42e01e', copied: true },
      audio: null,
      copyMode: 'preferred',
    });
    expect(verdict.kind).toBe('copy');
    expect(verdict.lossless).toBe(true);
  });

  it('mentions a track that was left out', () => {
    const verdict = classifyTrimMode({
      video: copied,
      audio: null,
      copyMode: 'forced',
      discarded: [{ type: 'audio', reason: 'cannot_copy' }],
    });
    expect(verdict.label).toMatch(/audio track was left out/i);
    expect(verdict.label).toMatch(/cannot be copied/i);
  });
});

describe('describeDiscardReason', () => {
  it('turns the engine reasons into words', () => {
    expect(describeDiscardReason('cannot_copy')).toMatch(/cannot be copied/i);
    expect(describeDiscardReason('no_encodable_target_codec')).toMatch(/cannot encode/i);
    expect(describeDiscardReason('undecodable_source_codec')).toMatch(/cannot decode/i);
    expect(describeDiscardReason('something_new')).toBe('something_new');
  });
});

/* -------------------------------------------------------------------------- */
/*  The report                                                                 */
/* -------------------------------------------------------------------------- */

describe('buildTrimReport', () => {
  const verdict: TrimModeVerdict = {
    kind: 'copy',
    lossless: true,
    label: 'Stream copy — lossless.',
    video: 'copied',
    audio: 'copied',
  };

  const facts = {
    fileName: 'holiday clip.mp4',
    inputSizeBytes: 10 * 1024 * 1024,
    outputSizeBytes: 4 * 1024 * 1024,
    inputDurationSeconds: 120,
    startSeconds: 12.5,
    endSeconds: 42.5,
    rangeSeconds: 30,
    container: { kind: 'mp4' as const, extension: '.mp4', mimeType: 'video/mp4', label: 'MP4' },
    verdict,
    inputVideoCodec: 'avc1.640028',
    outputVideoCodec: 'avc1.640028',
    inputAudioCodec: 'mp4a.40.2',
    outputAudioCodec: 'mp4a.40.2',
    discarded: [],
  };

  it('reports the duration, the range and the sizes', () => {
    const report = buildTrimReport(facts);
    expect(report.headers).toEqual(['Property', 'Value']);
    const row = (label: string): string => {
      const found = report.rows.find((entry) => entry[0] === label);
      expect(found, `row ${label}`).toBeDefined();
      return found![1]!;
    };
    expect(row('File name')).toBe('holiday clip.mp4');
    expect(row('Input size')).toMatch(/MB/);
    expect(row('Output size')).toMatch(/MB/);
    expect(row('Size change')).toMatch(/smaller/);
    expect(row('Input duration')).toBe('2:00.000');
    expect(row('Selected range')).toContain('0:12.500');
    expect(row('Selected range')).toContain('0:42.500');
    expect(row('Output duration')).toBe('0:30.000');
    expect(row('Output container')).toContain('MP4');
    expect(row('How the cut was made')).toMatch(/stream copy/i);
    expect(row('Video codec')).toBe('avc1.640028 (unchanged — copied)');
    expect(row('Audio codec')).toBe('mp4a.40.2 (unchanged — copied)');
  });

  it('shows a re-encoded codec as a change', () => {
    const report = buildTrimReport({
      ...facts,
      verdict: { ...verdict, kind: 'reencode', lossless: false, label: 'Re-encoded.' },
      outputVideoCodec: 'avc1.42E01E',
    });
    const row = report.rows.find((entry) => entry[0] === 'Video codec');
    expect(row![1]).toMatch(/avc1\.640028 → avc1\.42E01E/);
    expect(row![1]).toMatch(/re-encoded/i);
  });

  it('lists the tracks that were left out', () => {
    const report = buildTrimReport({
      ...facts,
      discarded: [{ type: 'audio', reason: 'cannot_copy' }],
    });
    const row = report.rows.find((entry) => entry[0] === 'Tracks left out');
    expect(row![1]).toMatch(/audio/);
    expect(row![1]).toMatch(/cannot be copied/i);
  });

  it('says when the output grew', () => {
    const report = buildTrimReport({ ...facts, outputSizeBytes: 20 * 1024 * 1024 });
    const row = report.rows.find((entry) => entry[0] === 'Size change');
    expect(row![1]).toMatch(/larger/);
  });
});

/* -------------------------------------------------------------------------- */
/*  The file name                                                              */
/* -------------------------------------------------------------------------- */

describe('trimOutputFilename', () => {
  it('adds the suffix and the new extension', () => {
    expect(trimOutputFilename('clip.mp4', '.mp4')).toBe('clip-trim.mp4');
    expect(trimOutputFilename('my holiday.MOV', '.mp4')).toBe('my holiday-trim.mp4');
    expect(trimOutputFilename('archive.part.mp4', '.webm')).toBe('archive.part-trim.webm');
    expect(trimOutputFilename('clip.mp4', 'webm')).toBe('clip-trim.webm');
  });

  it('keeps names without an extension usable', () => {
    expect(trimOutputFilename('noext', '.mp4')).toBe('noext-trim.mp4');
    expect(trimOutputFilename('', '.mp4')).toBe('video-trim.mp4');
  });

  it('preserves Unicode names', () => {
    expect(trimOutputFilename('презентация 日本語 🎥.mkv', '.mp4')).toBe(
      'презентация 日本語 🎥-trim.mp4',
    );
  });

  it('never keeps a path separator', () => {
    expect(trimOutputFilename('dir/clip.mp4', '.mp4')).toBe('dir_clip-trim.mp4');
    expect(trimOutputFilename('..\\clip.mp4', '.mp4')).toBe('.._clip-trim.mp4');
  });
});

/* -------------------------------------------------------------------------- */
/*  The cut                                                                    */
/* -------------------------------------------------------------------------- */

describe('trimVideo', () => {
  const options: OptionValues = { start: '0:02', end: '0:06' };

  it('copies the encoded packets when the container allows it', async () => {
    const engine = fakeEngine();
    const result = await trimVideo(file(), options, {}, engine);
    expect(result.verdict.kind).toBe('copy');
    expect(result.verdict.lossless).toBe(true);
    expect(result.verdict.video).toBe('copied');
    expect(result.verdict.audio).toBe('copied');
    expect(result.startSeconds).toBe(2);
    expect(result.endSeconds).toBe(6);
    expect(result.rangeSeconds).toBe(4);
    expect(result.filename).toBe('clip-trim.mp4');
    expect(result.mimeType).toBe('video/mp4');
    expect(result.bytes.byteLength).toBe(4096);
    expect(result.inputSizeBytes).toBe(2048);
    expect(result.outputSizeBytes).toBe(4096);
    expect(result.inputVideoCodec).toBe('avc1.640028');
    expect(result.outputVideoCodec).toBe('avc1.640028');
    expect(result.inputAudioCodec).toBe('mp4a.40.2');
    expect(result.outputAudioCodec).toBe('mp4a.40.2');
  });

  it('reports a re-encode when the packets could not be reused', async () => {
    const engine = fakeEngine({
      video: 'reencode',
      audio: 'reencode',
      reencodedVideoCodec: 'avc1.42E01E',
      reencodedAudioCodec: 'opus',
    });
    const result = await trimVideo(file(), options, {}, engine);
    expect(result.verdict.kind).toBe('reencode');
    expect(result.verdict.lossless).toBe(false);
    expect(result.outputVideoCodec).toBe('avc1.42E01E');
  });

  it('reports a mixed cut when only the audio was re-encoded', async () => {
    const engine = fakeEngine({ audio: 'reencode', reencodedAudioCodec: 'opus' });
    const result = await trimVideo(file(), options, {}, engine);
    expect(result.verdict.kind).toBe('mixed');
    expect(result.verdict.video).toBe('copied');
    expect(result.verdict.audio).toBe('reencoded');
  });

  it('never claims a copy in "always re-encode" mode', async () => {
    const engine = fakeEngine();
    const result = await trimVideo(file(), { ...options, copyMode: 'never' }, {}, engine);
    expect(result.verdict.kind).toBe('reencode');
    expect(result.verdict.lossless).toBe(false);
  });

  it('leaves the audio out when it is asked to', async () => {
    const engine = fakeEngine();
    const result = await trimVideo(file(), { ...options, keepAudio: false }, {}, engine);
    expect(result.verdict.audio).toBe('absent');
    expect(result.audioDropped).toBe(true);
    expect(result.outputAudioCodec).toBeNull();
  });

  it('writes the container the user asked for', async () => {
    const engine = fakeEngine();
    const result = await trimVideo(file(), { ...options, format: 'webm' }, {}, engine);
    expect(result.mimeType).toBe('video/webm');
    expect(result.filename).toBe('clip-trim.webm');
  });

  it('keeps the container of the source file when asked to', async () => {
    const engine = fakeEngine({ formatName: 'WebM' });
    const result = await trimVideo(file('clip.webm'), { ...options, format: 'source' }, {}, engine);
    expect(result.mimeType).toBe('video/webm');
    expect(result.filename).toBe('clip-trim.webm');
  });

  it('reports progress while the clip is cut', async () => {
    const engine = fakeEngine();
    const progress: number[] = [];
    const messages: string[] = [];
    await trimVideo(
      file(),
      options,
      {
        onProgress: (fraction, message) => {
          progress.push(fraction);
          if (message) messages.push(message);
        },
      },
      engine,
    );
    expect(progress.length).toBeGreaterThan(0);
    expect(progress.at(-1)).toBe(1);
    for (let i = 1; i < progress.length; i++) {
      expect(progress[i]!).toBeGreaterThanOrEqual(progress[i - 1]!);
    }
    expect(messages.join(' ')).toMatch(/cutting/i);
  });

  it('refuses a file without a video track', async () => {
    const engine = fakeEngine({ hasVideoTrack: false });
    await expect(trimVideo(file('tone.wav'), options, {}, engine)).rejects.toThrow(
      /no video track/i,
    );
  });

  it('refuses an empty file before anything else happens', async () => {
    await expect(trimVideo(file('empty.mp4', 0), options, {}, fakeEngine())).rejects.toThrow(
      /empty/i,
    );
  });

  it('reports a conversion that cannot be run', async () => {
    const engine = fakeEngine({
      invalid: true,
      discarded: [{ type: 'audio', reason: 'no_encodable_target_codec' }],
    });
    await expect(trimVideo(file(), options, {}, engine)).rejects.toThrow(ToolError);
    await expect(trimVideo(file(), options, {}, engine)).rejects.toThrow(
      /cannot be cut into the chosen output format/i,
    );
  });

  it('turns a failure of the engine into a friendly error', async () => {
    const engine = fakeEngine({ executeError: new Error('the encoder exploded') });
    await expect(trimVideo(file(), options, {}, engine)).rejects.toThrow(/could not be cut/i);
  });

  it('keeps a cancellation a cancellation', async () => {
    const controller = new AbortController();
    const engine = fakeEngine({ hang: true });
    const promise = trimVideo(file(), options, { signal: controller.signal }, engine);
    setTimeout(() => controller.abort(), 10);
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('refuses a range that lies outside the clip', async () => {
    const engine = fakeEngine({ durationSeconds: 5 });
    await expect(trimVideo(file(), { start: '0:01', end: '0:30' }, {}, engine)).rejects.toThrow(
      /past the end of the clip/i,
    );
  });
});

/* -------------------------------------------------------------------------- */
/*  Tool plumbing                                                              */
/* -------------------------------------------------------------------------- */

describe('runVideoTrim', () => {
  const result = (overrides: Partial<TrimResult> = {}): TrimResult => ({
    bytes: new Uint8Array([1, 2, 3, 4]),
    filename: 'clip-trim.mp4',
    mimeType: 'video/mp4',
    startSeconds: 2,
    endSeconds: 6,
    rangeSeconds: 4,
    inputDurationSeconds: 10,
    inputSizeBytes: 1024,
    outputSizeBytes: 4,
    container: { kind: 'mp4', extension: '.mp4', mimeType: 'video/mp4', label: 'MP4' },
    verdict: {
      kind: 'copy',
      lossless: true,
      label: 'Stream copy — lossless.',
      video: 'copied',
      audio: 'copied',
    },
    inputVideoCodec: 'avc1.640028',
    outputVideoCodec: 'avc1.640028',
    inputAudioCodec: 'mp4a.40.2',
    outputAudioCodec: 'mp4a.40.2',
    audioDropped: false,
    discarded: [],
    keepAudio: true,
    ...overrides,
  });

  it('rejects an empty selection', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(ToolError);
  });

  it('rejects a multi-file selection', async () => {
    const trim = vi.fn();
    await expect(
      runVideoTrim({ files: [file('a.mp4'), file('b.mp4')], options: {} }, trim),
    ).rejects.toThrow(/one video file/i);
    expect(trim).not.toHaveBeenCalled();
  });

  it('passes the resolved options to the converter', async () => {
    let seen: OptionValues | undefined;
    const trim = vi.fn(async (_f: File, options: OptionValues) => {
      seen = options;
      return result();
    });
    await runVideoTrim({ files: [file()], options: {} }, trim);
    expect(seen).toMatchObject({
      start: '',
      end: '',
      format: 'source',
      copyMode: 'preferred',
      keepAudio: true,
    });
  });

  it('returns the trimmed file and a report table', async () => {
    const trim = vi.fn(async () => result());
    const out = await runVideoTrim({ files: [file()], options: {} }, trim);

    expect(out.outputs).toHaveLength(1);
    expect(out.outputs[0]!.filename).toBe('clip-trim.mp4');
    expect(out.outputs[0]!.blob.size).toBe(4);
    expect(out.report?.render).toBe('table');
    const report = JSON.parse(out.report!.output) as { headers: string[]; rows: string[][] };
    expect(report.headers).toEqual(['Property', 'Value']);
    const method = report.rows.find((row) => row[0] === 'How the cut was made');
    expect(method![1]).toMatch(/stream copy/i);
    expect(out.notes?.join(' ')).toMatch(/lossless/i);
    expect(out.stats?.method).toBe('copy');
    expect(out.stats?.durationSeconds).toBe(4);
  });

  it('says in the notes when the clip was re-encoded', async () => {
    const trim = vi.fn(async () =>
      result({
        verdict: {
          kind: 'reencode',
          lossless: false,
          label: 'Re-encoded.',
          video: 'reencoded',
          audio: 'reencoded',
        },
      }),
    );
    const out = await runVideoTrim({ files: [file()], options: {} }, trim);
    expect(out.notes?.join(' ')).toMatch(/decoded and encoded again/i);
    expect(out.stats?.method).toBe('reencode');
  });

  it('warns when a track was left out', async () => {
    const trim = vi.fn(async () =>
      result({ discarded: [{ type: 'audio', reason: 'cannot_copy' }] }),
    );
    const out = await runVideoTrim({ files: [file()], options: {} }, trim);
    expect(out.warnings?.join(' ')).toMatch(/audio/i);
    expect(out.warnings?.join(' ')).toMatch(/cannot be copied/i);
  });

  it('warns when the trimmed file is bigger than the original', async () => {
    const trim = vi.fn(async () => result({ inputSizeBytes: 1024, outputSizeBytes: 4096 }));
    const out = await runVideoTrim({ files: [file()], options: {} }, trim);
    expect(out.warnings?.join(' ')).toMatch(/larger than the original/i);
  });

  it('keeps a Unicode file name in the download', async () => {
    const trim = vi.fn(async () => result({ filename: 'презентация 日本語 🎥-trim.mp4' }));
    const out = await runVideoTrim(
      { files: [file('презентация 日本語 🎥.mkv')], options: {} },
      trim,
    );
    expect(out.outputs[0]!.filename).toBe('презентация 日本語 🎥-trim.mp4');
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
});
