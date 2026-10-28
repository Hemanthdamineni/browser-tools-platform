import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolError, type OptionValues } from '@/lib/types';
import tool, {
  setAudioDecoder,
  setTranscriber,
  WHISPER_SAMPLE_RATE,
  type DecodedAudio,
  type Transcriber,
} from './speech-to-text.tool';
import { MAX_INPUT_BYTES, MAX_INPUT_SECONDS } from '../../components/panels/speech-to-text-panel';

// Imported transitively through the shared panel module; the tool never runs it.
vi.mock('@/lib/worker/client', () => ({ runToolById: vi.fn() }));

/* -------------------------------------------------------------------------- */
/*  Fakes                                                                      */
/* -------------------------------------------------------------------------- */

/** A fake decoder: a 1-second, 16 kHz mono clip. No `OfflineAudioContext`. */
const FAKE_AUDIO: DecodedAudio = {
  channels: [new Float32Array(WHISPER_SAMPLE_RATE)],
  sampleRate: WHISPER_SAMPLE_RATE,
};

const transcriber = vi.fn<Transcriber>();

/** The default transcription the fake pipeline returns. */
const DEFAULT_SEGMENTS = [
  { start: 0, end: 1.5, text: 'Hello there' },
  { start: 1.5, end: 3, text: 'How are you' },
];

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function audioFile(name = 'clip.wav', size?: number): File {
  const file = new File([new Uint8Array(0)], name, { type: 'audio/wav' });
  if (size !== undefined) Object.defineProperty(file, 'size', { value: size });
  return file;
}

async function runWith(options: OptionValues = {}) {
  return tool.run({ files: [audioFile()], options, onProgress: () => {} });
}

beforeEach(() => {
  transcriber.mockReset();
  transcriber.mockImplementation(async () => DEFAULT_SEGMENTS);
  setTranscriber(transcriber);
  setAudioDecoder(async () => FAKE_AUDIO);
});

afterEach(() => {
  setTranscriber(null);
  setAudioDecoder(null);
});

describe('speech-to-text run', () => {
  it('rejects when no file is provided', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(ToolError);
  });

  it('warns but still processes a file over the soft byte cap', async () => {
    const big = audioFile('big.wav', MAX_INPUT_BYTES + 1);
    const result = await tool.run({ files: [big], options: {}, onProgress: () => {} });
    expect(result.warnings?.some((w) => /larger than/.test(w))).toBe(true);
    expect(transcriber).toHaveBeenCalled();
  });

  it('warns but still processes a recording over the soft duration cap', async () => {
    setAudioDecoder(async () => ({
      channels: [new Float32Array(WHISPER_SAMPLE_RATE * (MAX_INPUT_SECONDS + 1))],
      sampleRate: WHISPER_SAMPLE_RATE,
    }));
    const result = await runWith();
    expect(result.warnings?.some((w) => /cap is/.test(w))).toBe(true);
    expect(transcriber).toHaveBeenCalled();
  });

  it('transcribes with the faked pipeline and exports TXT, SRT and VTT', async () => {
    const result = await runWith();

    expect(transcriber).toHaveBeenCalledTimes(1);
    const call = transcriber.mock.calls[0]![0];
    expect(call.samples).toBeInstanceOf(Float32Array);
    expect(call.modelId).toBe('Xenova/whisper-tiny.en');

    expect(result.outputs.map((o) => o.filename)).toEqual(['clip.txt', 'clip.srt', 'clip.vtt']);

    expect(await result.outputs[0]!.blob.text()).toBe('Hello there\nHow are you');
    expect(await result.outputs[1]!.blob.text()).toBe(
      '1\n00:00:00,000 --> 00:00:01,500\nHello there\n\n2\n00:00:01,500 --> 00:00:03,000\nHow are you\n\n',
    );
    expect(await result.outputs[2]!.blob.text()).toBe(
      'WEBVTT\n\n00:00:00.000 --> 00:00:01.500\nHello there\n\n00:00:01.500 --> 00:00:03.000\nHow are you\n\n',
    );

    expect(result.report?.output).toBe('Hello there\nHow are you');
    expect(result.stats?.model).toBe('Xenova/whisper-tiny.en');
    expect(result.stats?.segments).toBe(2);
  });

  it('passes the chosen language to a multilingual model and skips it for tiny.en', async () => {
    await runWith({ model: 'base', language: 'fr' });
    const call = transcriber.mock.calls[0]![0];
    expect(call.modelId).toBe('Xenova/whisper-base');
    expect(call.language).toBe('fr');

    transcriber.mockClear();
    await runWith({ model: 'tiny.en', language: 'fr' });
    expect(transcriber.mock.calls[0]![0].language).toBe('auto');
  });

  it('warns when no speech is recognised', async () => {
    transcriber.mockResolvedValue([]);
    const result = await runWith();
    expect(result.warnings).toEqual(['No speech was detected in this clip.']);
    expect(result.stats?.segments).toBe(0);
  });

  it('maps a pipeline failure to a friendly ToolError', async () => {
    transcriber.mockRejectedValue(new Error('boom'));
    await expect(runWith()).rejects.toThrow(/could not be transcribed/);
  });
});
