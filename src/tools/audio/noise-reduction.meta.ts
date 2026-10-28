import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'noise-reduction',
  name: 'Noise Reduction',
  category: 'audio',
  summary: 'Reduce background noise from audio using RNNoise (Recurrent Neural Network for Noise Suppression).',
  description:
    'Apply AI-powered noise suppression to audio files using RNNoise, a recurrent neural network trained for real-time noise reduction. Works well for speech recordings with background noise (fan, keyboard, traffic, etc.). The model runs entirely in the browser via WebAssembly. Output is a WAV file with reduced noise.',
  keywords: [
    'noise',
    'reduction',
    'suppression',
    'rnnoise',
    'denoise',
    'speech',
    'enhancement',
    'ai',
    'neural',
    'network',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'audio/*',
  multiple: true,
  options: [
    {
      key: 'mix',
      label: 'Dry/Wet Mix',
      type: 'range',
      default: 100,
      min: 0,
      max: 100,
      step: 5,
      help: '0% = original audio, 100% = fully processed. Lower values preserve more natural sound.',
    },
    {
      key: 'vadThreshold',
      label: 'VAD Threshold',
      type: 'range',
      default: 0.5,
      min: 0,
      max: 1,
      step: 0.05,
      help: 'Voice Activity Detection threshold. Higher = more aggressive noise gating during silence.',
    },
  ],
  faq: [
    {
      q: 'What types of noise does this remove?',
      a: 'RNNoise works best on stationary background noise: fan hum, air conditioning, keyboard clicks, computer noise, traffic rumble, etc. It is less effective on non-stationary noise like other people talking or music.',
    },
    {
      q: 'Will it affect speech quality?',
      a: 'At 100% mix, there may be slight artifacts or "underwater" sound on very noisy recordings. Lower the mix to 50-80% for a more natural sound with partial noise reduction.',
    },
    {
      q: 'What is the VAD threshold?',
      a: 'Voice Activity Detection threshold controls how aggressively silence is gated. Higher values cut more silence but may clip quiet speech. 0.5 is a good default.',
    },
    {
      q: 'Is this real-time?',
      a: 'This tool processes files offline. For real-time noise suppression, see the voice-recorder tool which can apply RNNoise during recording.',
    },
    {
      q: 'Why does it take a moment to start?',
      a: 'The RNNoise WebAssembly model (~50 KB) must be downloaded and instantiated on first use. It is then cached for subsequent runs.',
    },
  ],
  related: ['voice-recorder', 'audio-normalize', 'audio-info'],
  credits: [
    {
      name: 'RNNoise',
      url: 'https://github.com/xiph/rnnoise',
      license: 'BSD-3-Clause',
    },
    {
      name: 'rnnoise-wasm',
      url: 'https://github.com/ggerganov/rnnoise-wasm',
      license: 'MIT',
    },
  ],
  status: 'beta',
};