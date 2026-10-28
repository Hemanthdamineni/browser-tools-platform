import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'bpm-detector',
  name: 'BPM Detector',
  category: 'audio',
  summary: 'Detect tempo (BPM) from an audio file using onset detection and autocorrelation.',
  description:
    'Analyze an audio file to estimate its tempo in beats per minute (BPM). Uses onset detection to find rhythmic events, then applies autocorrelation on the onset envelope to find the dominant periodicity. Works best with music that has a clear, steady beat. Results include confidence score and alternative tempo candidates.',
  keywords: [
    'bpm',
    'tempo',
    'beat',
    'detection',
    'music',
    'onset',
    'autocorrelation',
    'rhythm',
    'analyzer',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'audio/*',
  multiple: false,
  options: [
    {
      key: 'minBpm',
      label: 'Min BPM',
      type: 'number',
      default: 60,
      min: 30,
      max: 180,
      step: 1,
      help: 'Lowest tempo to consider.',
    },
    {
      key: 'maxBpm',
      label: 'Max BPM',
      type: 'number',
      default: 180,
      min: 60,
      max: 300,
      step: 1,
      help: 'Highest tempo to consider.',
    },
    {
      key: 'onsetThreshold',
      label: 'Onset Threshold',
      type: 'range',
      default: 0.3,
      min: 0.1,
      max: 0.9,
      step: 0.05,
      help: 'Sensitivity for detecting note onsets. Lower = more sensitive.',
    },
  ],
  faq: [
    {
      q: 'How accurate is the BPM detection?',
      a: 'Accuracy depends on the audio. Music with a clear, steady beat (electronic, pop, rock) typically gives excellent results. Complex jazz, classical, or highly syncopated music may be less accurate.',
    },
    {
      q: 'Why does it show multiple tempo candidates?',
      a: 'Music can have ambiguity (e.g., 120 BPM vs 60 BPM for half-time feel). The tool shows the top candidates with confidence scores so you can choose the musically correct one.',
    },
    {
      q: 'What audio formats are supported?',
      a: 'Any format your browser can decode: MP3, WAV, OGG, FLAC, AAC, M4A, etc.',
    },
    {
      q: 'Does the whole file need to be analyzed?',
      a: 'The tool analyzes the full file for best accuracy. For very long files, this may take a few seconds.',
    },
  ],
  related: ['audio-info', 'spectrogram', 'tuner'],
  status: 'beta',
};