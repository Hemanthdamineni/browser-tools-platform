import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToolError } from '@/lib/types';
import { DENOISE_FRAME_SIZE, setDenoiserFactory } from '@/components/panels/noise-reduction-panel';

// `decodeFile` needs `OfflineAudioContext`, which jsdom does not provide, so the
// decoder is faked and everything downstream (resampling, framing, the blend,
// the WAV writer) runs for real.
vi.mock('./lib', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib')>();
  return { ...actual, decodeFile: vi.fn() };
});

import tool from './noise-reduction.tool';
import { decodeFile } from './lib';

const mockedDecode = vi.mocked(decodeFile);

/** Build a decoded-audio object for the faked decoder. */
function decoded(samples: Float32Array, sampleRate = 16000, channels = 1) {
  const chans: Float32Array[] = [];
  for (let c = 0; c < channels; c++) chans.push(samples.slice(0));
  return { channels: chans, sampleRate, byteSize: samples.length * 4, mimeType: 'audio/wav' };
}

function ramp(n: number): Float32Array {
  return Float32Array.from({ length: n }, (_, i) => (i % 97) / 97 - 0.5);
}

function file(name = 'clip.wav'): File {
  return new File([new Uint8Array(8)], name, { type: 'audio/wav' });
}

async function wavSamples(blob: Blob): Promise<DataView> {
  return new DataView(await blob.arrayBuffer());
}

/** Install a fake denoiser built from a per-frame function. */
function installSeam(process: (frame: Float32Array) => Float32Array): void {
  setDenoiserFactory(() => Promise.resolve(() => ({ process, close: () => {} })));
}

afterEach(() => {
  setDenoiserFactory(undefined);
  mockedDecode.mockReset();
});

describe('noise-reduction run', () => {
  it('rejects when no file is provided', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(ToolError);
  });

  it('denoises a 16 kHz mono file into a WAV and reports the comparison', async () => {
    const pcm = ramp(DENOISE_FRAME_SIZE * 2 + 100);
    mockedDecode.mockResolvedValue(decoded(pcm));
    installSeam((frame) => frame.slice(0));

    const result = await tool.run({
      files: [file('talk.wav')],
      options: { strength: 1, passes: '1' },
    });

    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]!.filename).toBe('talk-denoised.wav');
    expect(result.outputs[0]!.blob.type).toBe('audio/wav');

    const view = await wavSamples(result.outputs[0]!.blob);
    expect(view.byteLength).toBe(44 + pcm.length * 2);
    expect(String.fromCharCode(...new Uint8Array(view.buffer, 0, 4))).toBe('RIFF');
    expect(view.getUint32(24, true)).toBe(16000); // sample rate
    expect(view.getUint16(22, true)).toBe(1); // mono
    // An identity denoiser at full strength leaves the samples in place.
    expect(view.getInt16(44, true)).toBe(
      Math.round(pcm[0]! < 0 ? pcm[0]! * 0x8000 : pcm[0]! * 0x7fff),
    );

    expect(result.report?.render).toBe('image');
    expect(result.report?.output.startsWith('data:image/svg+xml;base64,')).toBe(true);
    expect(result.stats).toMatchObject({ sampleRate: 16000, frames: 3, passes: 1, strength: 1 });
  });

  it('keeps the original samples when strength is 0', async () => {
    const pcm = ramp(DENOISE_FRAME_SIZE);
    mockedDecode.mockResolvedValue(decoded(pcm));
    // The denoiser is destructive; strength 0 must undo it.
    installSeam((frame) => new Float32Array(frame.length));

    const result = await tool.run({ files: [file()], options: { strength: 0, passes: '1' } });
    const view = await wavSamples(result.outputs[0]!.blob);
    expect(view.getInt16(44, true)).toBe(
      Math.round(pcm[0]! < 0 ? pcm[0]! * 0x8000 : pcm[0]! * 0x7fff),
    );
  });

  it('runs the denoiser once per requested pass', async () => {
    const pcm = ramp(DENOISE_FRAME_SIZE);
    mockedDecode.mockResolvedValue(decoded(pcm));
    installSeam((frame) => {
      const out = new Float32Array(frame.length);
      for (let i = 0; i < frame.length; i++) out[i] = frame[i]! / 2;
      return out;
    });

    const one = await tool.run({ files: [file()], options: { strength: 1, passes: '1' } });
    const two = await tool.run({ files: [file()], options: { strength: 1, passes: '2' } });
    const v1 = await wavSamples(one.outputs[0]!.blob);
    const v2 = await wavSamples(two.outputs[0]!.blob);
    expect(v2.getInt16(44, true)).toBeCloseTo(v1.getInt16(44, true) / 2, -1);
  });

  it('mixes a stereo source down to one channel', async () => {
    mockedDecode.mockResolvedValue(decoded(ramp(DENOISE_FRAME_SIZE), 48000, 2));
    installSeam((frame) => frame.slice(0));
    const result = await tool.run({ files: [file('stereo.wav')], options: {} });
    const view = await wavSamples(result.outputs[0]!.blob);
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(16000); // resampled from 48 kHz
  });

  it('honours an aborted signal', async () => {
    mockedDecode.mockResolvedValue(decoded(ramp(10)));
    const controller = new AbortController();
    controller.abort();
    await expect(
      tool.run({ files: [file()], options: {}, signal: controller.signal }),
    ).rejects.toThrow(/abort/i);
  });

  it('rejects a file that decodes to nothing', async () => {
    mockedDecode.mockResolvedValue(decoded(new Float32Array(0)));
    await expect(tool.run({ files: [file()], options: {} })).rejects.toThrow(ToolError);
  });
});
