import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'mic-test',
  name: 'Microphone Test',
  category: 'device',
  summary:
    'Check a microphone: live level meter and waveform, then record a take and play it back.',
  description:
    'Test your microphone before a call or a recording. Watch the level meter and the live waveform to see whether the input is silent, quiet or clipping, record a take, play it back on the spot and read a summary of the captured audio. Everything happens in this tab — nothing is uploaded.',
  keywords: [
    'microphone',
    'mic',
    'test',
    'level meter',
    'waveform',
    'record',
    'audio input',
    'peak',
    'rms',
    'device',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'audio/*',
  // The live meter / waveform / recorder flow cannot be expressed by the generic
  // option form, so the tool opts into a dedicated panel. The options below are
  // the meter and recorder settings that panel drives — they are read by
  // `run()` through `resolveOptions`, so the tool still works without the UI.
  panel: 'mic-test',
  options: [
    {
      key: 'fftSize',
      label: 'FFT size',
      help: 'Waveform resolution. Higher shows more detail.',
      type: 'select',
      default: '2048',
      choices: [
        { value: '1024', label: '1024' },
        { value: '2048', label: '2048' },
        { value: '4096', label: '4096' },
        { value: '8192', label: '8192' },
      ],
    },
    {
      key: 'smoothing',
      label: 'Meter smoothing',
      help: 'How slowly the meter follows the signal.',
      type: 'range',
      default: 0.6,
      min: 0,
      step: 0.05,
    },
    {
      key: 'floorDb',
      label: 'Meter floor (dBFS)',
      help: 'Bottom of the level bars.',
      type: 'range',
      default: -80,
      min: -120,
      step: 5,
    },
    {
      key: 'maxSeconds',
      label: 'Recording limit (seconds)',
      help: 'Recording stops on its own at this length.',
      type: 'number',
      default: 60,
      min: 5,
      step: 5,
    },
  ],
  examples: [
    { title: 'Test my microphone' },
    { title: 'Fine-grained waveform', options: { fftSize: '4096' } },
    { title: 'Two-minute limit', options: { maxSeconds: 120 } },
  ],
  related: ['audio-info', 'tone-generator', 'webcam-test'],
  status: 'beta',
};
