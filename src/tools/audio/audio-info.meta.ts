import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'audio-info',
  name: 'Audio File Info',
  category: 'audio',
  summary: 'Inspect an audio file: duration, sample rate, channels, bitrate, peak and clipping.',
  description:
    'Decode an audio file on your device and show its technical details — duration, sample rate, channel count, bitrate, peak and RMS level — along with whether it clips. Nothing is uploaded.',
  keywords: ['audio', 'info', 'metadata', 'inspector', 'wav', 'mp3', 'duration', 'sample rate', 'bitrate'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'audio/*',
  worker: false,
  examples: [{ title: 'Inspect an audio file', options: {} }],
  faq: [
    {
      q: 'Which formats are supported?',
      a: 'Whatever your browser can decode — commonly MP3, WAV, OGG, M4A and FLAC.',
    },
  ],
  related: ['audio-to-wav', 'audio-normalize'],
  status: 'stable',
};
