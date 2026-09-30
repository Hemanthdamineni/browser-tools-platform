import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { encodeWavPCM16, wavDataUri } from '@/lib/audio';
import { meta } from './tone-generator.meta';

/** One-pole pink-noise approximation (low-pass filtered white noise). */
function makePinkNoise(length: number): Float32Array {
  const out = new Float32Array(length);
  let filtered = 0;
  const alpha = 0.985;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    filtered = alpha * filtered + (1 - alpha) * white;
    out[i] = filtered * 8; // restore perceived level after low-pass filtering
  }
  return out;
}

export function generateTone(options: Record<string, string | number | boolean>): { channels: Float32Array[]; sampleRate: number } {
  const waveform = String(options.waveform ?? 'sine');
  const frequency = Number(options.frequency ?? 440);
  const durationMs = Number(options.durationMs ?? 2000);
  const amplitude = Number(options.amplitude ?? 50) / 100;
  const sampleRate = Number(options.sampleRate ?? 44100);
  const fadeMs = Number(options.fadeMs ?? 10);
  const channelCount = String(options.channels ?? 'mono') === 'stereo' ? 2 : 1;
  if (!Number.isFinite(durationMs) || durationMs < 50 || durationMs > 30000) throw new ToolError('Duration must be between 50 ms and 30,000 ms.');
  if (!Number.isFinite(sampleRate) || ![22050, 44100, 48000].includes(sampleRate)) throw new ToolError('Choose a supported sample rate.');
  if (!Number.isFinite(amplitude) || amplitude < 0 || amplitude > 1) throw new ToolError('Amplitude must be between 0% and 100%.');
  if (!['white-noise', 'pink-noise'].includes(waveform) && (!Number.isFinite(frequency) || frequency < 20 || frequency > Math.min(20000, sampleRate / 2))) throw new ToolError('Frequency must be between 20 Hz and the Nyquist limit.');
  if (!Number.isFinite(fadeMs) || fadeMs < 0 || fadeMs > 500) throw new ToolError('Fade must be between 0 ms and 500 ms.');

  const length = Math.round(sampleRate * durationMs / 1000);
  const fadeFrames = Math.min(Math.floor(length / 2), Math.round(sampleRate * fadeMs / 1000));
  const mono = waveform === 'white-noise'
    ? Float32Array.from({ length }, () => Math.random() * 2 - 1)
    : waveform === 'pink-noise'
      ? makePinkNoise(length)
      : new Float32Array(length);

  if (!waveform.includes('noise')) {
    for (let i = 0; i < length; i++) {
      const phase = 2 * Math.PI * frequency * i / sampleRate;
      const cycle = (frequency * i / sampleRate) % 1;
      switch (waveform) {
        case 'square': mono[i] = Math.sin(phase) >= 0 ? 1 : -1; break;
        case 'sawtooth': mono[i] = 2 * cycle - 1; break;
        case 'triangle': mono[i] = 1 - 4 * Math.abs(cycle - 0.5); break;
        default: mono[i] = Math.sin(phase);
      }
    }
  }

  for (let i = 0; i < length; i++) {
    let edge = 1;
    if (fadeFrames > 0 && i < fadeFrames) edge = Math.min(edge, i / fadeFrames);
    if (fadeFrames > 0 && i >= length - fadeFrames) edge = Math.min(edge, (length - 1 - i) / fadeFrames);
    mono[i] = mono[i]! * amplitude * Math.max(0, edge);
  }
  const channels = channelCount === 2 ? [mono, mono.slice(0)] : [mono];
  return { channels, sampleRate };
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const { channels, sampleRate } = generateTone(o);
  const output = wavDataUri(encodeWavPCM16(channels, sampleRate));
  const waveform = String(o.waveform ?? 'sine');
  const durationMs = Number(o.durationMs ?? 2000);
  return {
    output,
    render: 'audio',
    filename: 'tone.wav',
    stats: { waveform, frequency: waveform.includes('noise') ? '—' : `${o.frequency} Hz`, duration: `${(durationMs / 1000).toFixed(2)} s`, sampleRate, channels: channels.length },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
