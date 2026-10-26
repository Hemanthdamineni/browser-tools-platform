import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'audio-fade',
  name: 'Fade Audio In / Out',
  category: 'audio',
  summary: 'Apply a linear, exponential or logarithmic fade in and fade out to audio.',
  description:
    'Soften the start and end of an audio file with a gain envelope. Choose linear, exponential or logarithmic shaping — both edges reach full silence at t=0 and full level at the end of the fade.',
  keywords: ['audio', 'fade', 'fade in', 'fade out', 'envelope', 'wav', 'click'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'audio/*',
  worker: false,
  options: [
    { key: 'fadeInMs', label: 'Fade in (ms)', type: 'number', default: 1000, min: 0, max: 60000 },
    { key: 'fadeOutMs', label: 'Fade out (ms)', type: 'number', default: 1000, min: 0, max: 60000 },
    {
      key: 'curve',
      label: 'Curve',
      type: 'select',
      default: 'linear',
      choices: [
        { value: 'linear', label: 'Linear' },
        { value: 'exponential', label: 'Exponential' },
        { value: 'logarithmic', label: 'Logarithmic' },
      ],
    },
  ],
  examples: [
    {
      title: 'One-second fades on both edges',
      options: { fadeInMs: 1000, fadeOutMs: 1000, curve: 'linear' },
    },
    {
      title: 'Long soft fade in for a music bed',
      options: { fadeInMs: 3000, fadeOutMs: 0, curve: 'exponential' },
    },
    {
      title: 'Quick fade out on a voice note',
      options: { fadeInMs: 0, fadeOutMs: 400, curve: 'logarithmic' },
    },
  ],
  related: ['audio-trim', 'audio-gain'],
  status: 'stable',
};
