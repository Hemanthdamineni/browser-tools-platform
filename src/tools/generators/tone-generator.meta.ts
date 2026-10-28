import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'tone-generator',
  name: 'Tone / Signal Generator',
  category: 'generators',
  summary: 'Generate a tone, waveform or noise signal as a downloadable WAV file.',
  description:
    'Synthesize sine, square, sawtooth, triangle, white-noise or pink-noise audio with a chosen duration, sample rate, amplitude, fade edges and mono/stereo output — entirely on your device.',
  keywords: [
    'tone',
    'audio',
    'signal',
    'generator',
    'sine',
    'square',
    'sawtooth',
    'triangle',
    'noise',
    'wav',
    'frequency',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'waveform',
      label: 'Waveform',
      type: 'select',
      default: 'sine',
      choices: [
        { value: 'sine', label: 'Sine' },
        { value: 'square', label: 'Square' },
        { value: 'sawtooth', label: 'Sawtooth' },
        { value: 'triangle', label: 'Triangle' },
        { value: 'white-noise', label: 'White noise' },
        { value: 'pink-noise', label: 'Pink noise' },
      ],
    },
    {
      key: 'frequency',
      label: 'Frequency (Hz)',
      type: 'number',
      default: 440,
      min: 20,
    },
    {
      key: 'durationMs',
      label: 'Duration (ms)',
      type: 'number',
      default: 2000,
      min: 50,
    },
    { key: 'amplitude', label: 'Amplitude (%)', type: 'range', default: 50, min: 0 },
    {
      key: 'sampleRate',
      label: 'Sample rate',
      type: 'select',
      default: '44100',
      choices: [
        { value: '22050', label: '22,050 Hz' },
        { value: '44100', label: '44,100 Hz' },
        { value: '48000', label: '48,000 Hz' },
      ],
    },
    { key: 'fadeMs', label: 'Edge fade (ms)', type: 'number', default: 10, min: 0 },
    {
      key: 'channels',
      label: 'Channels',
      type: 'select',
      default: 'mono',
      choices: [
        { value: 'mono', label: 'Mono' },
        { value: 'stereo', label: 'Stereo' },
      ],
    },
  ],
  examples: [
    {
      title: '440 Hz tuning tone',
      options: { waveform: 'sine', frequency: 440, durationMs: 3000 },
    },
    { title: 'Pink noise', options: { waveform: 'pink-noise', durationMs: 5000 } },
    {
      title: 'Click-free stereo square sweep reference',
      options: {
        waveform: 'square',
        frequency: 1000,
        durationMs: 4000,
        fadeMs: 50,
        channels: 'stereo',
      },
    },
  ],
  related: ['metronome-click', 'audio-info'],
  status: 'stable',
};
