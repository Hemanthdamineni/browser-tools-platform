import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'audio-normalize',
  name: 'Normalise Audio',
  category: 'audio',
  summary: 'Scale audio to a target peak or RMS level (in dBFS) without changing the length.',
  description:
    'Bring quiet or inconsistent audio to a target level. "Peak" mode scales so the loudest sample hits the target dB; "RMS" mode scales so the average power hits it (simple RMS, not true LUFS). Results are clamped to avoid clipping.',
  keywords: ['audio', 'normalise', 'normalize', 'peak', 'rms', 'dbfs', 'loudness', 'gain'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'audio/*',
  worker: false,
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'peak',
      choices: [
        { value: 'peak', label: 'Peak (true peak)' },
        { value: 'rms', label: 'RMS (average level)' },
      ],
    },
    {
      key: 'targetDb',
      label: 'Target level (dB, −30…0 peak / e.g. −14 rms)',
      type: 'number',
      default: -1,
      min: -60,
      max: 0,
    },
  ],
  related: ['audio-gain', 'audio-info'],
  status: 'stable',
};
