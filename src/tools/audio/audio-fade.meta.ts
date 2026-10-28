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
    { key: 'fadeInMs', label: 'Fade in (ms)', type: 'number', default: 1000, min: 0 },
    { key: 'fadeOutMs', label: 'Fade out (ms)', type: 'number', default: 1000, min: 0 },
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
  related: [  "audio-trim",
  "audio-gain"],
  status: 'stable',
};
