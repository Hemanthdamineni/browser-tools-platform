import { describe, it, expect, vi } from 'vitest';
import { ToolError } from '@/lib/types';
import { encodeWavPCM16 } from '@/lib/audio';
import { getTool, redirectTarget } from '@/lib/registry';
import { getContent } from '@/lib/content';
import {
  encodeWav,
  FORMAT_EXT,
  FORMAT_MIME,
  mp3FrameCount,
  Mp3ByteCounter,
  opusSupported,
  outputExtension,
  outputFilename,
  outputMime,
  resolveBitrate,
  resolveChannelMode,
  resolveFormat,
  resolveSampleRate,
} from './audio-convert.core';

/** One second of 440 Hz at 8 kHz, used by the mocked decoder. */
const decoded = {
  channels: [
    Float32Array.from({ length: 8000 }, (_, i) => Math.sin((2 * Math.PI * 440 * i) / 8000)),
  ],
  sampleRate: 8000,
  byteSize: 1644,
  mimeType: 'audio/wav',
};

vi.mock('./lib', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib')>();
  return { ...actual, decodeFile: vi.fn(async () => decoded) };
});

import tool from './audio-convert.tool';
import { meta } from './audio-convert.meta';

describe('audio-convert core — WAV bytes', () => {
  it('reuses the shared writer byte-for-byte', () => {
    const channels = [Float32Array.of(0, 0.5), Float32Array.of(0.5, -1)];
    const ours = encodeWav(channels, 44100);
    const reference = encodeWavPCM16(channels, 44100);
    expect(Array.from(ours)).toEqual(Array.from(reference));
  });

  it('writes the canonical 44-byte header for a 1-sample mono file', () => {
    const bytes = encodeWav([Float32Array.of(0.5)], 8000);
    expect(bytes.length).toBe(46); // 44 header + 2 data
    expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...bytes.subarray(8, 12))).toBe('WAVE');
    expect(String.fromCharCode(...bytes.subarray(36, 40))).toBe('data');
    expect(bytes[4]).toBe(38); // RIFF size
    expect(bytes[16]).toBe(16); // fmt chunk size
    expect(bytes[20]).toBe(1); // PCM
    expect(bytes[22]).toBe(1); // mono
    const dv = new DataView(bytes.buffer);
    expect(dv.getUint32(24, true)).toBe(8000); // sample rate
    expect(dv.getUint32(28, true)).toBe(16000); // byte rate
    expect(dv.getUint16(32, true)).toBe(2); // block align
    expect(dv.getUint16(34, true)).toBe(16); // bits per sample
    expect(dv.getUint32(40, true)).toBe(2); // data size
    expect(dv.getInt16(44, true)).toBe(0x4000); // 0.5 → 16384
  });
});

describe('audio-convert core — format selection', () => {
  it('accepts the three supported formats', () => {
    expect(resolveFormat('wav')).toBe('wav');
    expect(resolveFormat('mp3')).toBe('mp3');
    expect(resolveFormat('opus')).toBe('opus');
    expect(resolveFormat('MP3')).toBe('mp3'); // case-insensitive
    expect(resolveFormat(undefined)).toBe('wav'); // default
  });

  it('rejects an unsupported format', () => {
    expect(() => resolveFormat('flac')).toThrow(ToolError);
  });
});

describe('audio-convert core — output naming', () => {
  const table = [
    { format: 'wav', ext: FORMAT_EXT.wav, mime: FORMAT_MIME.wav, name: 'tone.wav' },
    { format: 'mp3', ext: FORMAT_EXT.mp3, mime: FORMAT_MIME.mp3, name: 'tone.mp3' },
    { format: 'opus', ext: FORMAT_EXT.opus, mime: FORMAT_MIME.opus, name: 'tone.opus' },
  ] as const;

  it.each(table)('maps $format to .$ext / $mime', ({ format, ext, mime, name }) => {
    expect(outputExtension(format)).toBe(ext);
    expect(outputMime(format)).toBe(mime);
    expect(outputFilename('tone.input', format)).toBe(name);
  });

  it('keeps the base name and strips every trailing extension', () => {
    expect(outputFilename('my song.v2.mp3', 'wav')).toBe('my song.v2.wav');
    expect(outputFilename('noext', 'opus')).toBe('noext.opus');
    expect(outputFilename('.hidden.wav', 'mp3')).toBe('.hidden.mp3');
  });

  it('falls back to "audio" for an input with no base name', () => {
    expect(outputFilename('.wav', 'wav')).toBe('audio.wav');
  });
});

describe('audio-convert core — MP3 frame bookkeeping', () => {
  it('counts frames of 1152 samples', () => {
    expect(mp3FrameCount(0)).toBe(0);
    expect(mp3FrameCount(1)).toBe(1);
    expect(mp3FrameCount(1152)).toBe(1);
    expect(mp3FrameCount(1153)).toBe(2);
    expect(mp3FrameCount(44100)).toBe(Math.ceil(44100 / 1152));
  });

  it('accumulates bytes, frames and progress', () => {
    const counter = new Mp3ByteCounter(2304); // exactly two frames
    expect(counter.expectedFrames).toBe(2);
    expect(counter.progress).toBe(0);
    expect(counter.add(new Uint8Array(100))).toBe(100);
    expect(counter.size).toBe(100);
    expect(counter.count).toBe(1);
    expect(counter.progress).toBe(0.5);
    expect(counter.add(new Uint8Array(50))).toBe(150);
    expect(counter.count).toBe(2);
    expect(counter.progress).toBe(1);
  });

  it('reports full progress for empty input', () => {
    expect(new Mp3ByteCounter(0).progress).toBe(1);
  });
});

describe('audio-convert core — Opus feature detect', () => {
  const table = [
    { label: 'no WebCodecs at all', env: {}, expected: false },
    { label: 'encoder is a class', env: { AudioEncoder: class {} }, expected: true },
    { label: 'encoder is a function', env: { AudioEncoder: () => {} }, expected: true },
    { label: 'encoder is a string (bad shim)', env: { AudioEncoder: 'nope' }, expected: false },
    { label: 'encoder is null', env: { AudioEncoder: null }, expected: false },
  ];

  it.each(table)('$label → $expected', ({ env, expected }) => {
    expect(opusSupported(env)).toBe(expected);
  });
});

describe('audio-convert core — option resolution', () => {
  it('resolves sample rates', () => {
    expect(resolveSampleRate('original', 22050)).toBe(22050);
    expect(resolveSampleRate('48000', 22050)).toBe(48000);
    expect(() => resolveSampleRate('0', 22050)).toThrow(ToolError);
    expect(() => resolveSampleRate('abc', 22050)).toThrow(ToolError);
  });

  it('resolves the channel mode', () => {
    expect(resolveChannelMode('mono')).toBe(1);
    expect(resolveChannelMode('stereo')).toBe(2);
    expect(resolveChannelMode('original')).toBeNull();
    expect(resolveChannelMode(undefined)).toBeNull();
  });

  it('clamps bitrates', () => {
    expect(resolveBitrate('192')).toBe(192);
    expect(resolveBitrate(undefined)).toBe(128);
    expect(resolveBitrate('9999')).toBe(320);
    expect(resolveBitrate('1')).toBe(32);
    expect(resolveBitrate('abc')).toBe(128);
  });
});

describe('audio-convert run', () => {
  it('rejects when no file is provided', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(ToolError);
  });

  it('defaults to WAV and produces a canonical file', async () => {
    const result = await tool.run({ files: [new File(['x'], 'tone.input')], options: {} });
    const output = result.outputs[0];
    expect(output).toBeDefined();
    expect(output!.filename).toBe('tone.wav');
    expect(output!.blob.type).toBe('audio/wav');
    const bytes = new Uint8Array(await output!.blob.arrayBuffer());
    expect(bytes.length).toBe(44 + decoded.channels[0]!.length * 2);
    expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...bytes.subarray(8, 12))).toBe('WAVE');
  });

  it('honours the sample rate and channel options', async () => {
    const result = await tool.run({
      files: [new File(['x'], 'tone.wav')],
      options: { format: 'wav', sampleRate: '16000', channels: 'stereo' },
    });
    const bytes = new Uint8Array(await result.outputs[0]!.blob.arrayBuffer());
    const dv = new DataView(bytes.buffer);
    expect(dv.getUint16(22, true)).toBe(2); // stereo
    expect(dv.getUint32(24, true)).toBe(16000);
    expect(bytes.length).toBe(44 + 16000 * 2 * 2); // 16000 frames × 2 ch × 2 B
  });

  it('rejects an unsupported output format', async () => {
    await expect(
      tool.run({ files: [new File(['x'], 'tone.wav')], options: { format: 'flac' } }),
    ).rejects.toThrow(ToolError);
  });

  it('says Opus is unsupported when WebCodecs AudioEncoder is absent', async () => {
    // jsdom has no WebCodecs, so the detect must fail rather than write junk.
    expect(opusSupported()).toBe(false);
    await expect(
      tool.run({ files: [new File(['x'], 'tone.wav')], options: { format: 'opus' } }),
    ).rejects.toThrow(/Opus export is not supported/i);
  });
});

describe('audio-convert metadata contract', () => {
  it('declares the required content', () => {
    expect(meta.id).toBe('audio-convert');
    expect(meta.hidden).not.toBe(true);
    expect(meta.redirectTo).toBeUndefined();
    expect(meta.examples!.length).toBeGreaterThanOrEqual(3);
    expect(getContent(meta.id)?.faq?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(getContent(meta.id)?.article?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(getContent(meta.id)?.article?.length ?? 0).toBeLessThanOrEqual(5);
    expect(meta.credits?.some((c) => c.license === 'LGPL-3.0')).toBe(true);
    // Related ids must be visible tools.
    for (const rel of meta.related ?? []) {
      expect(getTool(rel)?.meta.hidden, `${rel} should be visible`).not.toBe(true);
    }
  });
});

describe('audio-to-wav alias', () => {
  it('redirects to audio-convert', () => {
    const alias = getTool('audio-to-wav');
    expect(alias, 'audio-to-wav should still resolve').toBeTruthy();
    expect(alias!.meta.hidden).toBe(true);
    expect(alias!.meta.redirectTo).toBe('audio-convert');
    expect(redirectTarget(alias!.meta)?.meta.id).toBe('audio-convert');
  });

  it('points at a real, visible, non-alias replacement', () => {
    const target = getTool('audio-convert');
    expect(target?.meta.hidden).not.toBe(true);
    expect(target?.meta.redirectTo).toBeUndefined();
  });
});
