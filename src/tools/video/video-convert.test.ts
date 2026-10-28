import { describe, it, expect, vi } from 'vitest';
import { ToolError } from '@/lib/types';
import type { OptionValues, FileRunInput } from '@/lib/types';
import type { VideoEngine } from '@/lib/video';
import tool, { convertVideo, runVideoConvert, type ConvertResult } from './video-convert.tool';
import {
  buildConvertReport,
  classifyConvertMode,
  convertOutputFilename,
  describeDiscardReason,
  resolveContainerSpec,
  resolveConvertFormat,
  resolveConvertSettings,
  resolveCopyMode,
  CONVERT_COPY_MODES,
  CONVERT_FORMATS,
  type ConvertContainerSpec,
  type ConvertModeVerdict,
  type ConvertSettings,
  type ConvertTrackFacts,
} from './video-convert.core';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
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
  /** MIME type of the output file (carries codec strings). */
  outputMime?: string;
}

/** A structural stand-in for the Mediabunny engine: no real codec, but the
 * same shape the tool talks to. The output tracks say whether the packets
 * were copied, and the MIME type carries the resulting codec strings. */
function fakeEngine(config: FakeEngineConfig = {}): VideoEngine {
  const {
    durationSeconds = 10,
    formatName = 'MP4',
    hasVideoTrack = true,
    hasAudioTrack = true,
    videoCodec = 'avc1.640028',
    audioCodec = 'mp4a.40.2',
    video: videoOutcome = 'copy',
    audio: audioOutcome = 'copy',
    outputMime = 'video/mp4; codecs="avc1.640028, mp4a.40.2"',
  } = config;

  const videoTrack = hasVideoTrack
    ? {
        getDecoderConfig: async () => ({ codec: videoCodec! }),
        kind: 'video',
        ...(videoOutcome === 'copy' && { copied: true }),
        ...(videoOutcome === 'reencode' && { copied: false }),
      }
    : null;

  const audioTrack = hasAudioTrack
    ? {
        getDecoderConfig: async () => ({ codec: audioCodec! }),
        kind: 'audio',
        ...(audioOutcome === 'copy' && { copied: true }),
        ...(audioOutcome === 'reencode' && { copied: false }),
      }
    : null;

  return {
    VideoDecoder: class {},
    VideoEncoder: class {},
    AudioDecoder: class {},
    AudioEncoder: class {},
    Demuxer: class {
      async demux() {
        return [
          { type: 'video', track: videoTrack },
          { type: 'audio', track: audioTrack },
        ].filter((t) => t.track);
      }
    } as any,
    Muxer: class {} as any,
    OutputFormat: class {
      kind = 'mp4';
      mimeType = outputMime;
    } as any,
    Output: class {
      tracks = [videoTrack, audioTrack].filter((t) => t) as any;
      async close() {
        return new Blob(['fake'], { type: outputMime });
      }
    } as any,
    chooseVideoEncoder: vi.fn().mockResolvedValue({
      create: vi.fn().mockReturnValue({
        encode: vi.fn(),
        data: new Uint8Array(),
        mime: outputMime,
      }),
    }),
    chooseAudioEncoder: vi.fn().mockResolvedValue({
      create: vi.fn().mockReturnValue({
        encode: vi.fn(),
        data: new Uint8Array(),
        mime: outputMime,
      }),
    }),
  } as unknown as VideoEngine;
}

/** A minimal File factory. */
function makeFile(name = 'clip.mp4', size = 2048): File {
  return new File([new Uint8Array(size)], name, { type: 'video/mp4' });
}

const run = (input: Partial<FileRunInput> = {}) =>
  runVideoConvert({
    files: [makeFile()],
    options: {},
    signal: undefined,
    onProgress: undefined,
    ...input,
  } as FileRunInput);

/* -------------------------------------------------------------------------- */
/*  Meta                                                                       */
/* -------------------------------------------------------------------------- */

describe('video-convert meta', () => {
  it('exports the meta', () => {
    expect(tool.meta).toBeDefined();
    expect(tool.meta.id).toBe('video-convert');
    expect(tool.meta.name).toBe('Convert Video');
  });
});

/* -------------------------------------------------------------------------- */
/*  Core helpers                                                               */
/* -------------------------------------------------------------------------- */

describe('resolveConvertFormat', () => {
  it('accepts valid formats', () => {
    expect(resolveConvertFormat('mp4').id).toBe('mp4');
    expect(resolveConvertFormat('webm').id).toBe('webm');
    expect(resolveConvertFormat('mov').id).toBe('mov');
    expect(resolveConvertFormat('mkv').id).toBe('mkv');
  });

  it('rejects unknown format', () => {
    expect(() => resolveConvertFormat('flv')).toThrow(ToolError);
  });
});

describe('resolveContainerSpec', () => {
  it('resolves "source" to the source container', () => {
    const spec = resolveContainerSpec(resolveConvertFormat('source'), 'MP4');
    expect(spec.kind).toBe('mp4');
    expect(spec.extension).toBe('.mp4');
  });

  it('resolves explicit container', () => {
    const spec = resolveContainerSpec(resolveConvertFormat('webm'), 'MP4');
    expect(spec.kind).toBe('webm');
    expect(spec.extension).toBe('.webm');
  });
});

describe('resolveCopyMode', () => {
  it('accepts valid copy modes', () => {
    expect(resolveCopyMode('preferred')).toBe('preferred');
    expect(resolveCopyMode('forced')).toBe('forced');
    expect(resolveCopyMode('never')).toBe('never');
  });

  it('rejects unknown copy mode', () => {
    expect(() => resolveCopyMode('magic')).toThrow(ToolError);
  });
});

describe('resolveConvertSettings', () => {
  it('defaults to preferred copy and keep audio', () => {
    const source = { formatName: 'MP4', hasVideo: true, hasAudio: true, videoCodec: 'avc1.640028', audioCodec: 'mp4a.40.2', durationSeconds: 10 };
    const settings = resolveConvertSettings({}, source);
    expect(settings.copyMode).toBe('preferred');
    expect(settings.keepAudio).toBe(true);
  });

  it('respects explicit options', () => {
    const source = { formatName: 'MP4', hasVideo: true, hasAudio: true, videoCodec: 'avc1.640028', audioCodec: 'mp4a.40.2', durationSeconds: 10 };
    const settings = resolveConvertSettings({ copyMode: 'never', keepAudio: false }, source);
    expect(settings.copyMode).toBe('never');
    expect(settings.keepAudio).toBe(false);
  });
});

describe('classifyConvertMode', () => {
  it('reports Remux when both tracks copied', () => {
    const videoFacts: ConvertTrackFacts = { inputCodec: 'avc1.640028', outputCodec: 'avc1.640028', copied: true };
    const audioFacts: ConvertTrackFacts = { inputCodec: 'mp4a.40.2', outputCodec: 'mp4a.40.2', copied: true };
    const verdict = classifyConvertMode({
      video: videoFacts,
      audio: audioFacts,
      copyMode: 'preferred',
      discarded: [],
    });
    expect(verdict.kind).toBe('copy');
    expect(verdict.label).toContain('Remux');
  });

  it('reports Mixed when one track copied and one re-encoded', () => {
    const videoFacts: ConvertTrackFacts = { inputCodec: 'avc1.640028', outputCodec: 'vp9', copied: false };
    const audioFacts: ConvertTrackFacts = { inputCodec: 'mp4a.40.2', outputCodec: 'mp4a.40.2', copied: true };
    const verdict = classifyConvertMode({
      video: videoFacts,
      audio: audioFacts,
      copyMode: 'preferred',
      discarded: [],
    });
    expect(verdict.kind).toBe('mixed');
    expect(verdict.label).toContain('Mixed');
  });
});

describe('describeDiscardReason', () => {
  it('maps known reasons', () => {
    expect(describeDiscardReason('container')).toContain('container');
    expect(describeDiscardReason('codec')).toContain('codec');
  });

  it('falls back to raw reason', () => {
    expect(describeDiscardReason('mystery')).toBe('mystery');
  });
});

describe('convertOutputFilename', () => {
  it('replaces extension', () => {
    expect(convertOutputFilename('clip.mp4', 'webm')).toBe('clip.webm');
    expect(convertOutputFilename('my movie.mov', 'mkv')).toBe('my movie.mkv');
  });

  it('handles missing extension', () => {
    expect(convertOutputFilename('clip', 'mp4')).toBe('clip.mp4');
  });
});

describe('buildConvertReport', () => {
  it('produces a table with headers', () => {
    const report = buildConvertReport({
      fileName: 'test.mp4',
      inputSizeBytes: 1000,
      outputSizeBytes: 900,
      inputDurationSeconds: 10,
      container: { kind: 'mp4', extension: '.mp4', mimeType: 'video/mp4', label: 'MP4' },
      verdict: { kind: 'copy', lossless: true, label: 'Remux', video: 'copied', audio: 'copied' },
      inputVideoCodec: 'avc1.640028',
      outputVideoCodec: 'avc1.640028',
      inputAudioCodec: 'mp4a.40.2',
      outputAudioCodec: 'mp4a.40.2',
      discarded: [],
    });
    expect(report.headers).toContain('Property');
    expect(report.headers).toContain('Value');
    expect(Array.isArray(report.rows)).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/*  The conversion                                                             */
/* -------------------------------------------------------------------------- */

describe('convertVideo', () => {
  it('aborts on signal', async () => {
    const engine = fakeEngine();
    const file = makeFile('clip.mp4');
    const controller = new AbortController();
    controller.abort();
    await expect(
      convertVideo(file, { format: 'source', copyMode: 'preferred', keepAudio: true }, { signal: controller.signal }, engine),
    ).rejects.toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/*  Tool plumbing                                                              */
/* -------------------------------------------------------------------------- */

describe('runVideoConvert', () => {
  it('validates input file', async () => {
    await expect(run({ files: [] })).rejects.toThrow(ToolError);
  });

  it('rejects multiple files', async () => {
    const files = [makeFile('a.mp4'), makeFile('b.mp4')];
    await expect(run({ files })).rejects.toThrow(ToolError);
  });

  it('rejects empty file', async () => {
    const file = new File([], 'empty.mp4', { type: 'video/mp4' });
    await expect(run({ files: [file] })).rejects.toThrow(ToolError);
  });
});