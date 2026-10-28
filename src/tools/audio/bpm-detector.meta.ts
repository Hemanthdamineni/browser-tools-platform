import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'bpm-detector',
  name: 'BPM Detector',
  category: 'audio',
  summary: 'Find the tempo of a song from a file or the mic, with a tap-tempo fallback.',
  description:
    'Detect the beats-per-minute of an audio file or your microphone using onset detection and autocorrelation, all computed locally in this tab. If the automatic reading is off, tap along with the space bar for a manual tempo. Includes a confidence score and notes the common doubling/halving ambiguity.',
  keywords: [
    'bpm',
    'beats per minute',
    'tempo',
    'beat detector',
    'tap tempo',
    'metronome',
    'tempo detector',
    'find bpm',
    'audio tempo',
    'music speed',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'audio/*',
  panel: 'bpm-detector',
  worker: false,
  options: [
    {
      key: 'minBpm',
      label: 'Minimum BPM',
      type: 'number',
      default: 70,
      min: 30,
      step: 1,
      help: 'The slowest tempo the detector will consider. Raise it for very fast music.',
    },
    {
      key: 'maxBpm',
      label: 'Maximum BPM',
      type: 'number',
      default: 180,
      min: 80,
      step: 1,
      help: 'The fastest tempo the detector will consider. Lower it for very slow music.',
    },
  ],
  examples: [
    {
      title: 'Dance tempo (128 BPM)',
      options: { minBpm: 100, maxBpm: 180 },
    },
    {
      title: 'Ballad (slow, 80 BPM)',
      options: { minBpm: 60, maxBpm: 120 },
    },
    {
      title: 'Hip-hop (90 BPM)',
      options: { minBpm: 75, maxBpm: 110 },
    },
  ],
  related: ['metronome-click', 'audio-info', 'tone-generator', 'mic-test'],
  status: 'stable',
};
