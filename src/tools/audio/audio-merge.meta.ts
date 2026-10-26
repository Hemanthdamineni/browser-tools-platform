import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'audio-merge',
  name: 'Merge / Concatenate Audio',
  category: 'audio',
  summary: 'Join audio files end-to-end or mix them together into one WAV.',
  description:
    'Combine two or more audio files as a playlist or a simultaneous mix. Concatenation resamples and maps inputs to a shared format, with an optional silent gap; mix mode combines overlapping clips and prevents output clipping.',
  keywords: ['audio', 'merge', 'join', 'concatenate', 'mix', 'combine', 'wav', 'playlist'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'audio/*',
  multiple: true,
  worker: false,
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'concat',
      choices: [
        { value: 'concat', label: 'Concatenate (end-to-end)' },
        { value: 'mix', label: 'Mix (overlap)' },
      ],
    },
    {
      key: 'gapMs',
      label: 'Gap between tracks (ms)',
      type: 'number',
      default: 0,
      min: 0,
      max: 10000,
      showWhen: { key: 'mode', value: 'concat' },
    },
    {
      key: 'matchLoudness',
      label: 'Match RMS loudness before combining',
      type: 'boolean',
      default: false,
    },
  ],
  examples: [
    { title: 'Concatenate two clips end-to-end' },
    {
      title: 'Mix tracks with a silent gap between them',
      options: { mode: 'concat', gapMs: 500 },
    },
    {
      title: 'Mix three takes over each other',
      options: { mode: 'mix' },
    },
    {
      title: 'Join clips at even loudness',
      options: { mode: 'concat', matchLoudness: true },
    },
  ],
  related: ['audio-channels', 'audio-normalize'],
  status: 'stable',
};
