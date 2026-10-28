import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'audio-channels',
  name: 'Audio Channel Tools',
  category: 'audio',
  summary: 'Convert mono and stereo, swap channels, isolate left/right, or encode mid-side.',
  description:
    'Remix a decoded audio file without changing its sample rate: downmix to mono, duplicate to stereo, swap L/R, hear one side in both channels, or create an M/S stereo signal.',
  keywords: ['audio', 'channels', 'stereo', 'mono', 'left', 'right', 'mid-side', 'swap', 'remix'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'audio/*',
  worker: false,
  options: [
    {
      key: 'operation',
      label: 'Operation',
      type: 'select',
      default: 'to-mono',
      choices: [
        { value: 'to-mono', label: 'Convert to mono' },
        { value: 'to-stereo', label: 'Convert to stereo' },
        { value: 'swap', label: 'Swap left / right' },
        { value: 'left-only', label: 'Left channel to both' },
        { value: 'right-only', label: 'Right channel to both' },
        { value: 'mid-side', label: 'Encode mid-side' },
      ],
    },
  ],
  related: [  "audio-merge",
  "audio-to-wav"],
  status: 'stable',
};
