import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'audio-gain',
  name: 'Adjust Audio Volume',
  category: 'audio',
  summary: 'Raise or lower an audio file by a set amount in dB.',
  description:
    'Adjust the volume by a relative amount in decibels. Hard clipping limits samples to full scale; soft clipping applies a smooth tanh curve instead.',
  keywords: ['audio', 'gain', 'volume', 'amplify', 'attenuate', 'db', 'clip'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'audio/*',
  worker: false,
  options: [
    { key: 'gainDb', label: 'Gain (dB)', type: 'number', default: 0, min: -60, max: 24 },
    { key: 'hardClip', label: 'Hard clip at full scale', type: 'boolean', default: true },
  ],
  examples: [
    { title: 'Boost 6 dB', options: { gainDb: 6 } },
    { title: 'Reduce 3 dB', options: { gainDb: -3 } },
    { title: 'Lift 12 dB with soft clipping', options: { gainDb: 12, hardClip: false } },
  ],
  related: ['audio-normalize', 'audio-fade'],
  status: 'stable',
};
