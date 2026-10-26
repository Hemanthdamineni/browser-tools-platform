import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'mic-test',
  name: 'Microphone Test',
  category: 'device',
  summary:
    'Check your microphone: live input level in dBFS, a scrolling waveform, and a clip to play back.',
  description:
    'Open your microphone and watch the input level in dBFS on a live meter with a peak-hold marker, follow the waveform on a rolling scope, then record a short clip and play it back. Everything happens in this tab — the recording is never uploaded and never stored.',
  keywords: [
    'microphone',
    'mic',
    'microphone test',
    'level meter',
    'dBFS',
    'waveform',
    'record',
    'audio',
    'monitoring',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'audio/*',
  panel: 'mic-test',
  worker: false,
  options: [
    {
      key: 'meterRange',
      label: 'Meter range',
      type: 'select',
      default: '60',
      choices: [
        { value: '40', label: '−40 … 0 dBFS' },
        { value: '60', label: '−60 … 0 dBFS' },
        { value: '90', label: '−90 … 0 dBFS' },
      ],
      help: 'How much of the level range the meter shows. A wider range is more sensitive to quiet signals.',
    },
    {
      key: 'frameSize',
      label: 'Analysis frame',
      type: 'select',
      default: '2048',
      choices: [
        { value: '256', label: '256 samples — fast' },
        { value: '1024', label: '1024 samples' },
        { value: '2048', label: '2048 samples' },
        { value: '4096', label: '4096 samples — smooth' },
      ],
      help: 'How many samples each level reading covers. Bigger frames are steadier but less snappy.',
    },
    {
      key: 'clipName',
      label: 'Recording name',
      type: 'text',
      default: '',
      placeholder: 'my-clip',
      help: 'Leave empty to name the download after the microphone.',
    },
  ],
  examples: [
    { title: 'Default level check' },
    {
      title: 'Wide meter for a quiet microphone',
      options: { meterRange: '90', frameSize: '4096' },
    },
    {
      title: 'Named voice snapshot',
      options: { frameSize: '1024', clipName: 'voice-check' },
    },
  ],
  related: ['audio-info', 'audio-normalize', 'audio-convert'],
  status: 'beta',
};
