import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import type { VideoEngine } from '@/lib/video';
import {
  encodeWavPcm16,
  estimateWavBytes,
  EXTRACT_FORMATS,
  EXTRACT_MAX_DURATION_SECONDS,
  EXTRACT_MAX_OUTPUT_BYTES,
  EXTRACT_MAX_SOURCE_BYTES,
  EXTRACT_WARN_DURATION_SECONDS,
  extractOutputFilename,
  QUALITY_BITRATES,
  remixChannels,
  resolveAudioFormat,
  resolveChannelMode,
  resolveExtractSettings,
  resolveQuality,
  type ExtractSettings,
  type ExtractSourceInfo,
} from './video-extract-audio.core';
import tool, {
  extractEncoded,
  extractWav,
  openAudioSource,
  runVideoExtractAudio,
  type ExtractDeps,
  type ExtractedAudio,
  type ExtractRunContext,
  type OpenedAudioSource,
} from './video-extract-audio.tool';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const file = (name = 'clip.mp4', bytes = 1024): File =>
  new File([new Uint8Array(bytes)], name, { type: 'video/mp4' });

const source = (overrides: Partial<ExtractSourceInfo> = {}): ExtractSourceInfo => ({
  durationSeconds: 10,
  channels: 2,
  sampleRate: 48_000,
  codec: 'aac',
  fileSize: 10 * 1024 * 1024,
  ...overrides,
});

/** Build a fake `OpenedAudioSource` that yields the given channel data. */
function fakeSource(
  overrides: Partial<OpenedAudioSource> = {},
  chunks: { channels: Float32Array[]; sampleRate: number }[] = [],
): OpenedAudioSource {
  return {
    dispose: () => {},
    channels: 2,
    sampleRate: 48_000,
    codec: 'aac',
    codecLabel: 'AAC (mp4a.40.2)',
    durationSeconds: null,
    async *buffers() {
      for (const chunk of chunks) yield chunk;
    },
    ...overrides,
  };
}

/** N chunks of `frames` frames of stereo silence at 48 kHz. */
function stereoChunks(
  count: number,
  frames = 480,
): { channels: Float32Array[]; sampleRate: number }[] {
  return Array.from({ length: count }, () => ({
    channels: [new Float32Array(frames), new Float32Array(frames)],
    sampleRate: 48_000,
  }));
}

const extractedOf = (overrides: Partial<ExtractedAudio> = {}): ExtractedAudio => ({
  bytes: new Uint8Array(1024),
  mimeType: 'audio/wav',
  formatId: 'wav',
  codec: 'pcm-s16',
  channelCount: 2,
  sampleRate: 48_000,
  warnings: [],
  ...overrides,
});

/* -------------------------------------------------------------------------- */
/*  Format table + option resolution                                           */
/* -------------------------------------------------------------------------- */

describe('resolveAudioFormat', () => {
  it('accepts the three formats and defaults to wav', () => {
    expect(resolveAudioFormat('wav')).toBe('wav');
    expect(resolveAudioFormat('mp3')).toBe('mp3');
    expect(resolveAudioFormat('aac')).toBe('aac');
    expect(resolveAudioFormat(undefined)).toBe('wav');
    expect(resolveAudioFormat('')).toBe('wav');
  });

  it('rejects an unknown format instead of guessing', () => {
    expect(() => resolveAudioFormat('flac')).toThrow(/not a format this tool can write/i);
    expect(() => resolveAudioFormat('ogg')).toThrow(ToolError);
  });
});

describe('resolveChannelMode / resolveQuality', () => {
  it('accepts the three channel layouts and defaults to original', () => {
    expect(resolveChannelMode('mono')).toBe('mono');
    expect(resolveChannelMode('stereo')).toBe('stereo');
    expect(resolveChannelMode(undefined)).toBe('original');
  });

  it('rejects an unknown channel layout', () => {
    expect(() => resolveChannelMode('quad')).toThrow(/not a channel layout/i);
  });

  it('accepts the three quality levels and defaults to medium', () => {
    expect(resolveQuality('high')).toBe('high');
    expect(resolveQuality(undefined)).toBe('medium');
    expect(() => resolveQuality('ultra')).toThrow(/not a known quality/i);
  });
});

/* -------------------------------------------------------------------------- */
/*  Settings                                                                   */
/* -------------------------------------------------------------------------- */

describe('resolveExtractSettings', () => {
  it('plans a lossless WAV with the source layout and rate by default', () => {
    const settings = resolveExtractSettings({}, source());
    expect(settings.formatId).toBe('wav');
    expect(settings.format).toBe(EXTRACT_FORMATS.wav);
    expect(settings.channelMode).toBe('original');
    expect(settings.channelCount).toBe(2);
    expect(settings.bitrate).toBe(0); // PCM has no bitrate
    // 10 s · 48 kHz · 2 ch · 2 B + 44-byte header.
    expect(settings.estimatedBytes).toBe(44 + 10 * 48_000 * 2 * 2);
  });

  it('passes the source sample rate through unchanged (no resampling)', () => {
    for (const rate of [8_000, 22_050, 44_100, 96_000]) {
      const settings = resolveExtractSettings({}, source({ sampleRate: rate, durationSeconds: 1 }));
      // The estimate is built from the source rate verbatim.
      expect(settings.estimatedBytes).toBe(44 + rate * 2 * 2);
    }
  });

  it('resolves mono and stereo to 1 and 2 channels', () => {
    expect(resolveExtractSettings({ channels: 'mono' }, source()).channelCount).toBe(1);
    expect(resolveExtractSettings({ channels: 'stereo' }, source()).channelCount).toBe(2);
    expect(resolveExtractSettings({ channels: 'mono' }, source({ channels: 6 })).channelCount).toBe(
      1,
    );
  });

  it('keeps the original channel count when the source reports one', () => {
    expect(resolveExtractSettings({}, source({ channels: 6 })).channelCount).toBe(6);
  });

  it('falls back to stereo for the size estimate when the layout is unknown', () => {
    const settings = resolveExtractSettings({}, source({ channels: null }));
    expect(settings.channelCount).toBeNull();
    expect(settings.estimatedBytes).toBe(44 + 10 * 48_000 * 2 * 2);
  });

  it('sets the bitrate from the quality level for the compressed formats', () => {
    expect(resolveExtractSettings({ format: 'mp3', quality: 'high' }, source()).bitrate).toBe(
      QUALITY_BITRATES.high,
    );
    expect(resolveExtractSettings({ format: 'mp3' }, source()).bitrate).toBe(
      QUALITY_BITRATES.medium,
    );
    const aac = resolveExtractSettings({ format: 'aac', quality: 'low' }, source());
    expect(aac.bitrate).toBe(QUALITY_BITRATES.low);
    const mp3Low = resolveExtractSettings({ format: 'mp3', quality: 'low' }, source());
    expect(mp3Low.bitrate).toBe(QUALITY_BITRATES.low);
  });

  it('estimates compressed sizes from the bitrate alone', () => {
    const settings = resolveExtractSettings({ format: 'mp3' }, source());
    expect(settings.estimatedBytes).toBe((QUALITY_BITRATES.medium * 10) / 8);
  });

  it('rejects an empty file and an absurd duration', () => {
    expect(() => resolveExtractSettings({}, source({ fileSize: 0 }))).toThrow(/empty/i);
    expect(() =>
      resolveExtractSettings({}, source({ durationSeconds: EXTRACT_MAX_DURATION_SECONDS + 1 })),
    ).toThrow(/longer than the 60 minute limit/i);
    expect(() => resolveExtractSettings({}, source({ durationSeconds: -1 }))).toThrow(
      /invalid duration/i,
    );
  });

  it('warns about a long clip and a length it cannot read', () => {
    const long = resolveExtractSettings(
      {},
      source({ durationSeconds: EXTRACT_WARN_DURATION_SECONDS + 1 }),
    );
    expect(long.warnings.join(' ')).toMatch(/minutes long/i);
    const unknown = resolveExtractSettings({}, source({ durationSeconds: null }));
    expect(unknown.warnings.join(' ')).toMatch(/could not be read/i);
  });

  it('rejects a WAV that would not fit in memory', () => {
    expect(() =>
      resolveExtractSettings(
        {},
        source({
          durationSeconds: (EXTRACT_MAX_OUTPUT_BYTES + 1024) / (48_000 * 2 * 2),
        }),
      ),
    ).toThrow(/over the .*limit/i);
  });

  it('warns when the produced WAV is big', () => {
    const settings = resolveExtractSettings(
      {},
      source({ durationSeconds: (64 * 1024 * 1024 + 1) / (48_000 * 2 * 2) }),
    );
    expect(settings.warnings.join(' ')).toMatch(/kept in memory/i);
  });

  it('accepts the options as strings, the way the form delivers them', () => {
    const settings = resolveExtractSettings(
      { format: 'mp3', quality: 'high', channels: 'mono' },
      source(),
    );
    expect(settings.formatId).toBe('mp3');
    expect(settings.bitrate).toBe(QUALITY_BITRATES.high);
    expect(settings.channelCount).toBe(1);
  });

  it('rejects an unknown format through the settings path too', () => {
    expect(() => resolveExtractSettings({ format: 'wma' }, source())).toThrow(ToolError);
  });
});

/* -------------------------------------------------------------------------- */
/*  Channel remix                                                              */
/* -------------------------------------------------------------------------- */

describe('remixChannels', () => {
  it('returns the input unchanged when the count already matches', () => {
    const chans = [new Float32Array([1]), new Float32Array([2])];
    expect(remixChannels(chans, 2)).toBe(chans);
  });

  it('downmixes stereo to mono by averaging', () => {
    const left = new Float32Array([1, 0.5]);
    const right = new Float32Array([0, 0.5]);
    const [mono] = remixChannels([left, right], 1);
    expect(mono![0]).toBeCloseTo(0.5);
    expect(mono![1]).toBeCloseTo(0.5);
  });

  it('downmixes 6 channels to stereo in round-robin groups', () => {
    const chans = Array.from({ length: 6 }, (_, i) => new Float32Array([i + 1]));
    const [l, r] = remixChannels(chans, 2);
    // Group 0 = channels 0, 2, 4 → (1 + 3 + 5) / 3 = 3; group 1 = (2 + 4 + 6) / 3 = 4.
    expect(l![0]).toBeCloseTo(3);
    expect(r![0]).toBeCloseTo(4);
  });

  it('upmixes mono to stereo by repeating the source', () => {
    const [l, r] = remixChannels([new Float32Array([0.25, -0.5])], 2);
    expect(l![1]).toBe(-0.5);
    expect(r![0]).toBe(0.25);
    expect(r![1]).toBe(-0.5);
  });

  it('refuses nonsense targets', () => {
    expect(() => remixChannels([new Float32Array(1)], 0)).toThrow();
    expect(() => remixChannels([], 2)).toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/*  WAV writer                                                                 */
/* -------------------------------------------------------------------------- */

describe('encodeWavPcm16', () => {
  it('writes a canonical 44-byte RIFF header with the given rate and layout', () => {
    const left = new Float32Array([0, 0, 0, 0]);
    const right = new Float32Array([0, 0, 0, 0]);
    const bytes = encodeWavPcm16([left, right], 44_100);
    const view = new DataView(bytes.buffer);

    expect(bytes.byteLength).toBe(44 + 4 * 2 * 2);
    // 'RIFF' + little-endian size (fileBytes - 8) + 'WAVE'.
    expect(bytes[0]).toBe(0x52); // R
    expect(bytes[1]).toBe(0x49); // I
    expect(bytes[2]).toBe(0x46); // F
    expect(bytes[3]).toBe(0x46); // F
    expect(view.getUint32(4, true)).toBe(bytes.byteLength - 8);
    expect(bytes[8]).toBe(0x57); // W
    expect(bytes[9]).toBe(0x41); // A
    expect(bytes[10]).toBe(0x56); // V
    expect(bytes[11]).toBe(0x45); // E
    // fmt chunk.
    expect(bytes[12]).toBe(0x66); // f
    expect(bytes[13]).toBe(0x6d); // m
    expect(bytes[14]).toBe(0x74); // t
    expect(bytes[15]).toBe(0x20); // space
    expect(view.getUint32(16, true)).toBe(16); // PCM fmt chunk size
    expect(view.getUint16(20, true)).toBe(1); // format: PCM
    expect(view.getUint16(22, true)).toBe(2); // channels
    expect(view.getUint32(24, true)).toBe(44_100); // sample rate, verbatim
    expect(view.getUint32(28, true)).toBe(44_100 * 4); // byte rate
    expect(view.getUint16(32, true)).toBe(4); // block align
    expect(view.getUint16(34, true)).toBe(16); // bits per sample
    expect(view.getUint32(40, true)).toBe(16); // data chunk size
  });

  it('interleaves the channels sample by sample', () => {
    const left = new Float32Array([1, -1]);
    const right = new Float32Array([0, 0.5]);
    const bytes = encodeWavPcm16([left, right], 8_000);
    const view = new DataView(bytes.buffer, 44);
    // Interleaved: L0, R0, L1, R1 — asymmetric scaling keeps 0 dBFS at full scale.
    expect(view.getInt16(0, true)).toBe(32_767); // +1.0
    expect(view.getInt16(2, true)).toBe(0); // 0.0
    expect(view.getInt16(4, true)).toBe(-32_768); // −1.0
    expect(view.getInt16(6, true)).toBeCloseTo(16_384, 0); // 0.5
  });

  it('clamps out-of-range samples instead of wrapping', () => {
    const loud = new Float32Array([2, -2]);
    const bytes = encodeWavPcm16([loud], 8_000);
    const view = new DataView(bytes.buffer, 44);
    expect(view.getInt16(0, true)).toBe(32_767);
    expect(view.getInt16(2, true)).toBe(-32_768);
  });

  it('keeps odd sample rates verbatim (passthrough, no resampling)', () => {
    const bytes = encodeWavPcm16([new Float32Array(4)], 44_317);
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(24, true)).toBe(44_317);
    expect(view.getUint32(28, true)).toBe(44_317 * 2);
  });

  it('zero-pads shorter channels', () => {
    const a = new Float32Array([1, 1, 1]);
    const b = new Float32Array([1]);
    const bytes = encodeWavPcm16([a, b], 8_000);
    const view = new DataView(bytes.buffer, 44);
    expect(view.getInt16(0, true)).toBe(32_767); // L0
    expect(view.getInt16(2, true)).toBe(32_767); // R0 present
    expect(view.getInt16(6, true)).toBe(0); // R1 missing → silence
    expect(view.getInt16(10, true)).toBe(0); // R2 missing → silence
  });

  it('refuses no channels and a non-rate', () => {
    expect(() => encodeWavPcm16([], 44_100)).toThrow();
    expect(() => encodeWavPcm16([new Float32Array(1)], 0)).toThrow();
  });

  it('estimateWavBytes matches the writer byte for byte', () => {
    const left = new Float32Array(48_000);
    const right = new Float32Array(48_000);
    expect(estimateWavBytes(1, 48_000, 2)).toBe(encodeWavPcm16([left, right], 48_000).byteLength);
  });
});

/* -------------------------------------------------------------------------- */
/*  Output filename                                                            */
/* -------------------------------------------------------------------------- */

describe('extractOutputFilename', () => {
  it('swaps the extension and adds the -audio suffix', () => {
    expect(extractOutputFilename('holiday clip.mp4', 'wav')).toBe('holiday clip-audio.wav');
    expect(extractOutputFilename('a.b.c.mov', 'mp3')).toBe('a.b.c-audio.mp3');
  });

  it('keeps extension-less names usable, preserves Unicode, drops path separators', () => {
    expect(extractOutputFilename('noext', 'wav')).toBe('noext-audio.wav');
    expect(extractOutputFilename('音乐 视频.mp4', 'wav')).toBe('音乐 视频-audio.wav');
    expect(extractOutputFilename('a/b\\c.mp4', 'wav')).toBe('a_b_c-audio.wav');
  });
});

/* -------------------------------------------------------------------------- */
/*  Meta                                                                       */
/* -------------------------------------------------------------------------- */

describe('video-extract-audio meta', () => {
  it('is a beta file tool in the video category', () => {
    expect(tool.meta.id).toBe('video-extract-audio');
    expect(tool.meta.category).toBe('video');
    expect(tool.meta.input).toBe('file');
    expect(tool.meta.status).toBe('beta');
    expect(tool.meta.summary.length).toBeLessThanOrEqual(120);
    expect(tool.meta.privacy).toEqual({ processing: 'on-device', network: 'none', offline: true });
  });

  it('offers wav, mp3 and aac with per-format quality pickers', () => {
    const options = tool.meta.options ?? [];
    const byKey = new Map(options.map((option) => [option.key, option]));
    const format = byKey.get('format');
    expect(format?.type).toBe('select');
    expect(format?.default).toBe('wav');
    expect((format as { choices: { value: string }[] }).choices.map((c) => c.value)).toEqual([
      'wav',
      'mp3',
      'aac',
    ]);
    expect(byKey.get('quality')?.showWhen).toEqual({ key: 'format', value: 'mp3' });
    expect(byKey.get('aacQuality')?.showWhen).toEqual({ key: 'format', value: 'aac' });
    expect(byKey.get('channels')?.default).toBe('original');
  });

  it('labels every control and explains it', () => {
    for (const option of tool.meta.options ?? []) {
      expect(option.label.length).toBeGreaterThan(0);
      expect(option.help?.length).toBeGreaterThan(0);
    }
  });

  it('credits the bundled engine and points at the sibling tools', () => {
    expect(tool.meta.credits?.find((credit) => credit.name === 'mediabunny')?.license).toBe(
      'MPL-2.0',
    );
    expect(tool.meta.related).toContain('video-compress');
    expect(tool.meta.related).toContain('audio-convert');
  });
});

/* -------------------------------------------------------------------------- */
/*  WAV extraction                                                             */
/* -------------------------------------------------------------------------- */

describe('extractWav', () => {
  const settings = (
    options: Record<string, string | number | boolean> = {},
    overrides: Partial<ExtractSourceInfo> = {},
  ): ExtractSettings => resolveExtractSettings(options, source(overrides));

  it('concatenates chunks, keeps the source sample rate and reports the layout', async () => {
    const chunks = stereoChunks(3, 480); // 1440 frames at 48 kHz
    const result = await extractWav(fakeSource({}, chunks), settings(), {});

    expect(result.formatId).toBe('wav');
    expect(result.codec).toBe('pcm-s16');
    expect(result.mimeType).toBe('audio/wav');
    expect(result.sampleRate).toBe(48_000); // passthrough
    expect(result.channelCount).toBe(2);
    // 44-byte header + 1440 frames · 2 ch · 2 B.
    expect(result.bytes.byteLength).toBe(44 + 1440 * 4);
  });

  it('carries real sample values through the writer', async () => {
    const left = new Float32Array([0.5]);
    const right = new Float32Array([-0.5]);
    const result = await extractWav(
      fakeSource({}, [{ channels: [left, right], sampleRate: 44_100 }]),
      settings(),
      {},
    );
    const view = new DataView(result.bytes.buffer, 44);
    expect(view.getInt16(0, true)).toBeCloseTo(16_384, 0);
    expect(view.getInt16(2, true)).toBeCloseTo(-16_384, 0);
  });

  it('downmixes a 6-channel track when stereo is requested', async () => {
    const chans = Array.from({ length: 6 }, () => new Float32Array([0.6]));
    const result = await extractWav(
      fakeSource({}, [{ channels: chans, sampleRate: 48_000 }]),
      settings({ channels: 'stereo' }),
      {},
    );
    expect(result.channelCount).toBe(2);
    const view = new DataView(result.bytes.buffer, 44);
    expect(view.getInt16(0, true)).toBeCloseTo(0.6 * 0x7fff, 0);
    expect(view.getInt16(2, true)).toBeCloseTo(0.6 * 0x7fff, 0);
  });

  it('upmixes a mono track when stereo is requested', async () => {
    const result = await extractWav(
      fakeSource({}, [{ channels: [new Float32Array([0.25])], sampleRate: 48_000 }]),
      settings({ channels: 'stereo' }),
      {},
    );
    expect(result.channelCount).toBe(2);
    const view = new DataView(result.bytes.buffer, 44);
    expect(view.getInt16(0, true)).toBeCloseTo(0.25 * 0x7fff, 0);
    expect(view.getInt16(2, true)).toBeCloseTo(0.25 * 0x7fff, 0);
  });

  it('passes a mono request through with one channel', async () => {
    const result = await extractWav(
      fakeSource({}, [
        {
          channels: [new Float32Array([0.1]), new Float32Array([0.3])],
          sampleRate: 48_000,
        },
      ]),
      settings({ channels: 'mono' }),
      {},
    );
    expect(result.channelCount).toBe(1);
    const view = new DataView(result.bytes.buffer, 44);
    expect(view.getInt16(0, true)).toBeCloseTo(0.2 * 0x7fff, 0); // averaged
  });

  it('throws a clear error when no samples come out', async () => {
    await expect(extractWav(fakeSource(), settings(), {})).rejects.toThrow(
      /no readable audio samples/i,
    );
  });

  it('keeps a cancelled run a cancellation', async () => {
    const controller = new AbortController();
    controller.abort();
    const ctx: ExtractRunContext = { signal: controller.signal };
    await expect(
      extractWav(fakeSource({}, stereoChunks(2)), settings(), ctx),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('reports monotonically non-decreasing progress inside the 0.1–0.95 band', async () => {
    const fractions: number[] = [];
    const opened = fakeSource({ durationSeconds: 1, sampleRate: 48_000 }, stereoChunks(20, 4800));
    await extractWav(opened, settings(), {
      onProgress: (f) => fractions.push(f),
    });
    expect(fractions.length).toBeGreaterThan(1);
    expect(fractions[0]).toBeGreaterThanOrEqual(0.1);
    for (let i = 1; i < fractions.length; i++) {
      expect(fractions[i]!).toBeGreaterThanOrEqual(fractions[i - 1]!);
    }
    expect(fractions.at(-1)!).toBeLessThanOrEqual(1);
  });
});

/* -------------------------------------------------------------------------- */
/*  The tool                                                                   */
/* -------------------------------------------------------------------------- */

describe('runVideoExtractAudio', () => {
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

  it('rejects a file past the size ceiling before the engine is loaded', async () => {
    await expect(
      tool.run({ files: [file('huge.mp4', EXTRACT_MAX_SOURCE_BYTES + 1)], options: {} }),
    ).rejects.toThrow(/larger than the .* limit/i);
  });

  it('returns the WAV file, the notes and the summary table', async () => {
    const deps: ExtractDeps = {
      open: async () => fakeSource({ durationSeconds: 1, sampleRate: 48_000 }, stereoChunks(100)),
    };
    const result = await runVideoExtractAudio(
      { files: [file('road trip.mp4')], options: {} },
      deps,
    );

    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]!.filename).toBe('road trip-audio.wav');
    expect(result.outputs[0]!.blob.type).toBe('audio/wav');
    expect(result.outputs[0]!.blob.size).toBe(44 + 48_000 * 4);
    expect(result.report?.render).toBe('table');
    const table = JSON.parse(result.report!.output) as { rows: string[][] };
    expect(table.rows.find((row) => row[0] === 'Output format')?.[1]).toContain('WAV');
    expect(table.rows.find((row) => row[0] === 'Sample rate')?.[1]).toContain('48,000 Hz');
    expect(table.rows.find((row) => row[0] === 'Channels')?.[1]).toBe('Stereo');
    expect(result.notes?.join(' ')).toMatch(/48,000 Hz/);
    expect(result.stats).toMatchObject({
      sourceBytes: 1024,
      format: 'wav',
      channelCount: 2,
      sampleRate: 48_000,
    });
  });

  it('routes mp3 to the encoded path and the mp3 quality picker', async () => {
    let seenSettings: ExtractSettings | undefined;
    const deps: ExtractDeps = {
      open: async () => fakeSource({ durationSeconds: 2 }),
      extractEncoded: async (_file, settings) => {
        seenSettings = settings;
        return extractedOf({
          bytes: new Uint8Array(32_000),
          mimeType: 'audio/mpeg',
          formatId: 'mp3',
          codec: 'mp3',
        });
      },
    };
    const result = await runVideoExtractAudio(
      { files: [file()], options: { format: 'mp3', quality: 'high' } },
      deps,
    );
    expect(seenSettings?.formatId).toBe('mp3');
    expect(seenSettings?.bitrate).toBe(QUALITY_BITRATES.high);
    expect(result.outputs[0]!.filename).toBe('clip-audio.mp3');
    expect(result.outputs[0]!.blob.type).toBe('audio/mpeg');
  });

  it('routes aac to the encoded path with the aac quality picker', async () => {
    let seenSettings: ExtractSettings | undefined;
    const deps: ExtractDeps = {
      open: async () => fakeSource(),
      extractEncoded: async (_file, settings) => {
        seenSettings = settings;
        return extractedOf({
          bytes: new Uint8Array(32_000),
          mimeType: 'audio/aac',
          formatId: 'aac',
          codec: 'aac',
        });
      },
    };
    await runVideoExtractAudio(
      { files: [file()], options: { format: 'aac', aacQuality: 'low' } },
      deps,
    );
    expect(seenSettings?.formatId).toBe('aac');
    expect(seenSettings?.bitrate).toBe(QUALITY_BITRATES.low);
  });

  it('reports an unavailable encoder as a ToolError, not a crash', async () => {
    const deps: ExtractDeps = {
      open: async () => fakeSource(),
      extractEncoded: async () =>
        // What the real path does when the browser has no encoder.
        Promise.reject(
          new ToolError(
            'This browser cannot encode MP3.',
            'Pick WAV instead — it is produced by this tool itself and always works.',
          ),
        ),
    };
    await expect(
      runVideoExtractAudio({ files: [file()], options: { format: 'mp3' } }, deps),
    ).rejects.toThrow(/cannot encode MP3/);
  });

  it('surfaces the no-audio-track error from the open step', async () => {
    const deps: ExtractDeps = {
      open: async () =>
        Promise.reject(new ToolError('This file has no audio track.', 'Pick a clip with sound.')),
    };
    await expect(runVideoExtractAudio({ files: [file()], options: {} }, deps)).rejects.toThrow(
      /no audio track/i,
    );
  });

  it('disposes the source exactly once, even when extraction fails', async () => {
    let disposed = 0;
    const deps: ExtractDeps = {
      open: async () => fakeSource({ dispose: () => (disposed += 1) }),
      extractWav: async () => Promise.reject(new ToolError('boom')),
    };
    await expect(runVideoExtractAudio({ files: [file()], options: {} }, deps)).rejects.toThrow(
      'boom',
    );
    expect(disposed).toBe(1);
  });

  it('keeps a pre-cancelled run a cancellation', async () => {
    const controller = new AbortController();
    controller.abort();
    const deps: ExtractDeps = { open: async () => fakeSource() };
    await expect(
      runVideoExtractAudio({ files: [file()], options: {}, signal: controller.signal }, deps),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('reports progress that only ever moves forward', async () => {
    const fractions: number[] = [];
    const deps: ExtractDeps = {
      open: async () => fakeSource({ durationSeconds: 1 }, stereoChunks(50)),
    };
    await runVideoExtractAudio(
      {
        files: [file()],
        options: {},
        onProgress: (fraction) => fractions.push(fraction),
      },
      deps,
    );
    expect(fractions.length).toBeGreaterThan(2);
    expect(fractions.at(-1)).toBe(1);
    for (let i = 1; i < fractions.length; i++) {
      expect(fractions[i]!).toBeGreaterThanOrEqual(fractions[i - 1]!);
    }
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
      /not a video container|could not be opened/i,
    );
  });

  it('says plainly when the browser cannot decode the audio codec', async () => {
    // jsdom has no WebCodecs, so `canDecode()` is false on the real path —
    // but the explicit undecodable branch is exercised through the fake
    // engine below (`fails loudly when the audio codec is not decodable`).
    // Here we only assert the WAV writer path tolerates a null codec label.
    const opened = fakeSource({ codec: null, codecLabel: null }, stereoChunks(2));
    const result = await extractWav(opened, resolveExtractSettings({}, source()), {});
    expect(result.bytes.byteLength).toBe(44 + 2 * 480 * 4);
  });
});

/* -------------------------------------------------------------------------- */
/*  The fake engine end to end                                                 */
/* -------------------------------------------------------------------------- */

describe('the fake engine end to end', () => {
  /**
   * A structural stand-in for Mediabunny with just the surface the tool
   * drives on the WAV path: `Input`, `AudioSampleSink`, `openVideoWith`.
   */
  async function fakeEngine(config: { hasAudio?: boolean; decodable?: boolean } = {}) {
    const hasAudio = config.hasAudio ?? true;
    const decodable = config.decodable ?? true;
    const chunks = stereoChunks(10, 4800);
    const engine = {
      Input: class FakeInput {
        constructor(public options: Record<string, unknown>) {}
        async getFormat() {
          return { name: 'MP4', mimeType: 'video/mp4' };
        }
        async getPrimaryVideoTrack() {
          return { getCodedWidth: async () => 640, getCodedHeight: async () => 360 };
        }
        async getPrimaryAudioTrack() {
          if (!hasAudio) return null;
          return {
            getNumberOfChannels: async () => 2,
            getSampleRate: async () => 48_000,
            getCodec: async () => 'aac',
            getCodecParameterString: async () => 'mp4a.40.2',
            canDecode: async () => decodable,
          };
        }
        async getDurationFromMetadata() {
          return 1;
        }
        async computeDuration() {
          return 1;
        }
        async getMimeType() {
          return 'video/mp4';
        }
        dispose() {}
      },
      BlobSource: class FakeBlobSource {
        constructor(public blob: Blob) {}
      },
      /**
       * Mirrors `AudioSampleSink`: yields fake `AudioSample`s whose data is
       * read back as planar f32 through `allocationSize`/`copyTo`/`close` —
       * the same surface the tool drives, no `AudioBuffer` involved.
       */
      AudioSampleSink: class FakeAudioSampleSink {
        constructor(_track: unknown) {}
        async *samples() {
          for (const chunk of chunks) {
            yield {
              format: 'f32-planar',
              numberOfChannels: chunk.channels.length,
              numberOfFrames: chunk.channels[0]?.length ?? 0,
              sampleRate: chunk.sampleRate,
              timestamp: 0,
              closed: false,
              allocationSize(options: { planeIndex: number }) {
                if (this.closed) throw new Error('AudioSample is closed.');
                const ch = chunk.channels[options.planeIndex];
                return (ch?.length ?? 0) * 4;
              },
              copyTo(destination: Uint8Array, options: { planeIndex: number }) {
                if (this.closed) throw new Error('AudioSample is closed.');
                const ch = chunk.channels[options.planeIndex];
                destination.set(new Uint8Array((ch ?? new Float32Array()).buffer));
              },
              close() {
                this.closed = true;
              },
            };
          }
        }
      },
      ALL_FORMATS: [],
      getFirstEncodableAudioCodec: async (codecs: string[]) => codecs[0] ?? null,
    } as unknown as VideoEngine;
    return { engine, chunks };
  }

  it('decodes the track through the engine and hands back a valid WAV', async () => {
    const { engine } = await fakeEngine();
    const sourceOpened = await openAudioSource(file('clip.mp4', 4096), {}, engine);
    const settings = resolveExtractSettings({}, source());
    const result = await extractWav(sourceOpened, settings, {});
    sourceOpened.dispose();

    const view = new DataView(result.bytes.buffer);
    expect(view.getUint16(22, true)).toBe(2); // stereo
    expect(view.getUint32(24, true)).toBe(48_000); // rate passthrough
    expect(result.bytes.byteLength).toBe(44 + 10 * 4800 * 4);
    expect(result.channelCount).toBe(2);
    expect(result.sampleRate).toBe(48_000);
  });

  it('fails loudly when the file has no audio track', async () => {
    const { engine } = await fakeEngine({ hasAudio: false });
    await expect(openAudioSource(file('clip.mp4', 4096), {}, engine)).rejects.toThrow(
      /no audio track/i,
    );
  });

  it('fails loudly when the audio codec is not decodable', async () => {
    const { engine } = await fakeEngine({ decodable: false });
    await expect(openAudioSource(file('clip.mp4', 4096), {}, engine)).rejects.toThrow(
      /cannot decode the audio codec/i,
    );
  });

  it('runs the whole tool on the fake engine and produces a downloadable WAV', async () => {
    const { engine } = await fakeEngine();
    const deps: ExtractDeps = {
      open: (f, ctx) => openAudioSource(f, ctx, engine),
    };
    const result = await runVideoExtractAudio({ files: [file('song.mp4')], options: {} }, deps);
    expect(result.outputs[0]!.filename).toBe('song-audio.wav');
    expect(result.outputs[0]!.blob.type).toBe('audio/wav');
    const table = JSON.parse(result.report!.output) as { rows: string[][] };
    expect(table.rows.find((row) => row[0] === 'Bit depth')?.[1]).toBe('16-bit PCM');
    expect(result.warnings).toBeUndefined();
  });

  it('checks the encoder through the engine before encoding', async () => {
    const { engine } = await fakeEngine();
    const checked: string[][] = [];
    // The fake engine is a structural stand-in; its codec query is a plain
    // function, so the property is assigned before the tool reads it.
    const query = async (codecs: string[]) => {
      checked.push(codecs);
      return null; // nothing encodable — the browser has no encoder
    };
    Object.defineProperty(engine, 'getFirstEncodableAudioCodec', { value: query });
    await expect(
      extractEncoded(file(), resolveExtractSettings({ format: 'mp3' }, source()), {}, engine),
    ).rejects.toThrow(/cannot encode MP3/i);
    expect(checked).toEqual([['mp3']]);
  });
});
