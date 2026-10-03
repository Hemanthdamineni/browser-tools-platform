import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'audio-trim',
  name: 'Trim / Clip Audio',
  category: 'audio',
  summary: 'Cut an audio file to a range and apply click-free fade in/out edges.',
  description:
    'Trim audio to a start and end time (accepting "SS", "M:SS" or "H:MM:SS") and optionally add a short fade in and fade out so the clip starts and ends cleanly.',
  keywords: ['audio', 'trim', 'clip', 'cut', 'fade', 'wav', 'slice'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'audio/*',
  worker: false,
  options: [
    { key: 'start', label: 'Start time', type: 'text', default: '0:00', placeholder: '0:00, 1:30, 00:00:05 …' },
    { key: 'end', label: 'End time (empty = end)', type: 'text', default: '', placeholder: 'e.g. 0:45' },
    { key: 'fadeIn', label: 'Fade in (ms)', type: 'number', default: 0, min: 0, max: 10000 },
    { key: 'fadeOut', label: 'Fade out (ms)', type: 'number', default: 0, min: 0, max: 10000 },
  ],
  examples: [
    { title: 'First 30 seconds', options: { start: '0:00', end: '0:30' } },
    { title: 'Trim with fades', options: { start: '0:10', end: '1:00', fadeIn: 300, fadeOut: 500 } },
  ],
  related: ['audio-fade', 'audio-to-wav'],
  status: 'stable',
};
