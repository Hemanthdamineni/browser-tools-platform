import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'metronome-click',
  name: 'Metronome Click Track',
  category: 'generators',
  summary: 'Generate a metronome click track as a WAV file at any tempo, bars and time signature.',
  description:
    'Produce a click track for practice or recording. Set the tempo, number of bars, beats per bar and click pitches; the first beat of each bar can be accented. Everything is synthesised locally.',
  keywords: ['metronome', 'click track', 'bpm', 'tempo', 'audio', 'practice', 'wav', 'generator'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'bpm', label: 'Tempo (BPM)', type: 'number', default: 120, min: 20 },
    { key: 'bars', label: 'Bars', type: 'number', default: 4, min: 1 },
    { key: 'beatsPerBar', label: 'Beats per bar', type: 'number', default: 4, min: 1 },
    { key: 'accentFirst', label: 'Accent the first beat', type: 'boolean', default: true },
    {
      key: 'clickHz',
      label: 'Click pitch (Hz)',
      type: 'number',
      default: 1000,
      min: 100,
    },
    {
      key: 'accentHz',
      label: 'Accent pitch (Hz)',
      type: 'number',
      default: 1500,
      min: 100,
    },
    {
      key: 'clickHz',
      label: 'Click pitch (Hz)',
      type: 'number',
      default: 1000,
      min: 100,
      max: 8000,
    },
    {
      key: 'accentHz',
      label: 'Accent pitch (Hz)',
      type: 'number',
      default: 1500,
      min: 100,
      max: 12000,
    },
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
  ],
  examples: [
    { title: '120 BPM, 4/4, 4 bars', options: { bpm: 120, bars: 4, beatsPerBar: 4 } },
    { title: 'Waltz, 3/4', options: { bpm: 100, beatsPerBar: 3 } },
  ],
  related: [  "tone-generator"],
  status: 'stable',
};
