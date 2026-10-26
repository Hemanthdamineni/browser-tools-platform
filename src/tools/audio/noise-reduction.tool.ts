/**
 * Noise reduction with RNNoise.
 *
 * Input   one audio file the browser can decode.
 * Output  a denoised 16 kHz mono 16-bit PCM WAV, plus a before/after waveform
 *         comparison shown as the run's report.
 *
 * The pipeline is: decode → down-mix to mono → resample to 16 kHz (the only
 * rate RNNoise understands) → frame into 480-sample blocks → denoise each frame
 * (once per `passes`, through the seam in `noise-reduction-panel.ts`) → blend
 * the result with the original at `strength` → encode a WAV. The framing, the
 * batching, the blend maths and the WAV writer are the pure functions exported
 * by `@/components/panels/noise-reduction-panel`; this module only wires them to
 * the browser's decoder.
 *
 * The tool is `worker: false` because `decodeFile` needs `OfflineAudioContext`,
 * which does not exist in a worker.
 */
import type { FileRunInput, FileRunResult, FileToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import {
  DENOISE_FRAME_SIZE,
  DENOISE_SAMPLE_RATE,
  loadRNNoiseDenoiser,
  processFrames,
  waveformComparisonSvg,
  writeNoiseReductionWav,
} from '@/components/panels/noise-reduction-panel';
import { decodeFile, formatDuration, remixChannels, resampleChannel } from './lib';
import { meta } from './noise-reduction.meta';

/** Keep the pass count in the range the option offers. */
const MIN_PASSES = 1;
const MAX_PASSES = 3;

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const { files, signal, onProgress } = input;
  if (!files.length) throw new ToolError('Choose an audio file.');

  const rawPasses = Math.round(Number(o.passes ?? 1));
  const passes = Math.max(
    MIN_PASSES,
    Math.min(MAX_PASSES, Number.isFinite(rawPasses) ? rawPasses : 1),
  );
  const rawStrength = Number(o.strength ?? 1);
  const strength = Number.isFinite(rawStrength) ? Math.max(0, Math.min(1, rawStrength)) : 1;

  signal?.throwIfAborted?.();
  onProgress?.(0.05, 'Decoding audio');
  const audio = await decodeFile(files[0]!);
  signal?.throwIfAborted?.();

  onProgress?.(0.15, 'Preparing 16 kHz mono');
  const mono =
    audio.channels.length > 1 ? remixChannels(audio.channels, 1)[0]! : audio.channels[0]!;
  const pcm = resampleChannel(mono, audio.sampleRate, DENOISE_SAMPLE_RATE);
  if (pcm.length === 0) throw new ToolError('This audio file contains no samples.');

  onProgress?.(0.25, 'Loading the noise-suppression model');
  const createState = await loadRNNoiseDenoiser();
  signal?.throwIfAborted?.();

  onProgress?.(0.3, `Denoising (${passes} pass${passes > 1 ? 'es' : ''})`);
  const denoised = processFrames(pcm, createState, passes, strength);
  signal?.throwIfAborted?.();

  onProgress?.(0.9, 'Writing WAV');
  const blob = writeNoiseReductionWav(denoised);
  const base = files[0]!.name.replace(/\.[^.]*$/, '') || 'audio';
  const filename = `${base}-denoised.wav`;
  const durationSec = denoised.length / DENOISE_SAMPLE_RATE;
  const frames = Math.ceil(pcm.length / DENOISE_FRAME_SIZE);
  const waveform = waveformComparisonSvg(pcm, denoised);

  const notes = [
    `${DENOISE_SAMPLE_RATE.toLocaleString()} Hz mono · ${formatDuration(durationSec)} · ` +
      `${frames.toLocaleString()} frames · ${passes} pass${passes > 1 ? 'es' : ''} · ` +
      `strength ${Math.round(strength * 100)} %.`,
    'In the comparison the grey trace is the original and the red trace is the denoised result.',
  ];
  if (files.length > 1) notes.push('Only the first selected file was processed.');

  onProgress?.(1, 'Done');
  return {
    outputs: [{ filename, blob }],
    report: { output: waveform, render: 'image' },
    notes,
    stats: {
      sampleRate: DENOISE_SAMPLE_RATE,
      durationMs: Math.round(durationSec * 1000),
      frames,
      passes,
      strength,
    },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
