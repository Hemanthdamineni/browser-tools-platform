import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { encodeWavPCM16, wavDataUri } from '@/lib/audio';
import { meta } from './metronome-click.meta';

export interface ClickTrack {
  channel: Float32Array;
  sampleRate: number;
}

export function generateClickTrack(options: Record<string, string | number | boolean>): ClickTrack {
  const bpm = Number(options.bpm ?? 120);
  const bars = Number(options.bars ?? 4);
  const beatsPerBar = Number(options.beatsPerBar ?? 4);
  const accentFirst = options.accentFirst !== false;
  const clickHz = Number(options.clickHz ?? 1000);
  const accentHz = Number(options.accentHz ?? 1500);
  const sampleRate = Number(options.sampleRate ?? 44100);

  if (!Number.isFinite(bpm) || bpm < 20 || bpm > 300)
    throw new ToolError('Tempo must be between 20 and 300 BPM.');
  if (!Number.isInteger(bars) || bars < 1 || bars > 64)
    throw new ToolError('Bars must be a whole number between 1 and 64.');
  if (!Number.isInteger(beatsPerBar) || beatsPerBar < 1 || beatsPerBar > 16)
    throw new ToolError('Beats per bar must be a whole number between 1 and 16.');
  if (![22050, 44100, 48000].includes(sampleRate))
    throw new ToolError('Choose a supported sample rate.');

  const secondsPerBeat = 60 / bpm;
  const totalBeats = bars * beatsPerBar;
  const totalFrames = Math.round(totalBeats * secondsPerBeat * sampleRate);
  const channel = new Float32Array(totalFrames);

  const clickFrames = Math.round(0.03 * sampleRate);
  const clickBuffer = (hz: number): Float32Array => {
    const buf = new Float32Array(clickFrames);
    for (let i = 0; i < clickFrames; i++) {
      const t = i / sampleRate;
      const decay = Math.exp(-t / 0.008); // ~8 ms time constant
      buf[i] = Math.sin(2 * Math.PI * hz * t) * decay;
    }
    return buf;
  };
  const normalClick = clickBuffer(clickHz);
  const accentClick = clickBuffer(accentHz);

  for (let beat = 0; beat < totalBeats; beat++) {
    const isAccent = accentFirst && beat % beatsPerBar === 0;
    const buffer = isAccent ? accentClick : normalClick;
    const start = Math.round(beat * secondsPerBeat * sampleRate);
    for (let i = 0; i < buffer.length && start + i < totalFrames; i++)
      channel[start + i] = buffer[i]!;
  }
  return { channel, sampleRate };
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const { channel, sampleRate } = generateClickTrack(o);
  const output = wavDataUri(encodeWavPCM16([channel], sampleRate));
  const durationSec = channel.length / sampleRate;
  return {
    output,
    render: 'audio',
    filename: 'metronome.wav',
    stats: {
      bpm: Number(o.bpm ?? 120),
      bars: Number(o.bars ?? 4),
      duration: `${durationSec.toFixed(2)} s`,
      sampleRate,
    },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
