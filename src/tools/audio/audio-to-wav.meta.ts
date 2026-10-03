import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'audio-to-wav',
  name: 'Convert Audio to WAV',
  category: 'audio',
  summary: 'Convert browser-supported audio files to uncompressed 16-bit PCM WAV.',
  description:
    'Convert audio to a broadly compatible PCM WAV file. Optionally choose a sample rate or mono/stereo layout; audio is decoded and processed locally in your browser.',
  keywords: ['audio', 'wav', 'convert', 'pcm', 'mp3', 'flac', 'ogg', 'sample rate', 'channels'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'audio/*',
  multiple: true,
  worker: false,
  options: [
    {
      key: 'sampleRate',
      label: 'Sample rate',
      type: 'select',
      default: 'original',
      choices: [
        { value: 'original', label: 'Original' },
        { value: '8000', label: '8,000 Hz' },
        { value: '16000', label: '16,000 Hz' },
        { value: '22050', label: '22,050 Hz' },
        { value: '44100', label: '44,100 Hz' },
        { value: '48000', label: '48,000 Hz' },
      ],
    },
    {
      key: 'channels',
      label: 'Channels',
      type: 'select',
      default: 'original',
      choices: [
        { value: 'original', label: 'Original' },
        { value: 'mono', label: 'Mono' },
        { value: 'stereo', label: 'Stereo' },
      ],
    },
    {
      key: 'bitDepth',
      label: 'Bit depth',
      type: 'select',
      default: '16',
      choices: [{ value: '16', label: '16-bit PCM' }],
    },
  ],
  related: ['audio-info', 'audio-trim'],
  status: 'stable',
};
