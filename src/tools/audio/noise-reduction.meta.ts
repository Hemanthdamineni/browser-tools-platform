import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'noise-reduction',
  name: 'Noise Reduction',
  category: 'audio',
  summary:
    'Remove background noise from speech with RNNoise, then blend the result back into the original.',
  description:
    'Suppress steady background noise (fans, hum, room tone) from a voice recording using the RNNoise neural model, which runs entirely in this tab. Audio is down-mixed to mono and resampled to 16 kHz and denoised, and you choose how many suppression passes to run and how strongly the denoised result is blended with the original. The before/after waveforms are drawn side by side, and the result downloads as a 16 kHz mono WAV.',
  keywords: [
    'noise reduction',
    'denoise',
    'rnnoise',
    'background noise',
    'voice',
    'speech',
    'remove noise',
    'audio denoise',
    'de-noise',
    'noise suppression',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'audio/*',
  panel: 'noise-reduction',
  worker: false,
  options: [
    {
      key: 'strength',
      label: 'Denoise strength',
      type: 'range',
      default: 1,
      min: 0,
      max: 1,
      step: 0.05,
      help: 'How much of the denoised signal to keep. 100% is fully denoised; 0% keeps the original untouched.',
    },
    {
      key: 'passes',
      label: 'Suppression passes',
      type: 'select',
      default: '1',
      choices: [
        { value: '1', label: '1 — gentle' },
        { value: '2', label: '2 — stronger' },
        { value: '3', label: '3 — aggressive' },
      ],
      help: 'How many times RNNoise is run over each frame. More passes remove more noise but can dull the speech.',
    },
  ],
  examples: [
    { title: 'Full denoise', options: { strength: 1, passes: '1' } },
    { title: 'Half-strength blend', options: { strength: 0.5, passes: '1' } },
    { title: 'Aggressive', options: { strength: 1, passes: '3' } },
  ],
  related: ['audio-normalize', 'audio-gain', 'audio-convert', 'audio-info'],
  credits: [
    {
      name: 'rnnoise-wasm (RNNoise compiled to WebAssembly)',
      url: 'https://github.com/jitsi/rnnoise-wasm',
      license: 'Apache-2.0',
    },
  ],
  status: 'beta',
};
