import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'audio-reverse',
  name: 'Reverse Audio',
  category: 'audio',
  summary: 'Reverse an audio clip sample-for-sample and save the result as WAV.',
  description: 'Reverse every channel of a decoded audio file. The output is a PCM WAV file with the same sample rate and duration.',
  keywords: ['audio', 'reverse', 'backwards', 'wav', 'reversed'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'audio/*',
  worker: false,
  related: ['audio-trim', 'audio-speed'],
  status: 'stable',
};
