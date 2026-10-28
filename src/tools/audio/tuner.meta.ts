import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'tuner',
  name: 'Instrument Tuner',
  category: 'audio',
  summary: 'Real-time pitch detection from microphone — shows note, octave, and cents deviation.',
  description:
    'Tune your instrument using the microphone. The tool detects the fundamental frequency using the YIN algorithm, displays the nearest note (A–G with sharps/flats), the octave, and how many cents you are sharp or flat. Works for guitar, violin, voice, and more. All processing happens on-device; no audio is recorded or uploaded.',
  keywords: [
    'tuner',
    'pitch',
    'detection',
    'microphone',
    'YIN',
    'instrument',
    'guitar',
    'violin',
    'voice',
    'cents',
    'frequency',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  panel: 'tuner',
  options: [
    {
      key: 'algorithm',
      label: 'Algorithm',
      type: 'select',
      default: 'yin',
      choices: [
        { value: 'yin', label: 'YIN (robust, default)' },
        { value: 'autocorr', label: 'Autocorrelation (faster)' },
      ],
      help: 'Pitch detection algorithm. YIN is more accurate for complex tones.',
    },
    {
      key: 'a4Frequency',
      label: 'A4 reference (Hz)',
      type: 'number',
      default: 440,
      min: 415,
      max: 466,
      step: 1,
      help: 'Concert pitch reference. 440 Hz is standard; 432 Hz is common in some traditions.',
    },
    {
      key: 'smoothing',
      label: 'Smoothing (ms)',
      type: 'range',
      default: 150,
      min: 0,
      max: 500,
      step: 10,
      help: 'Smoothing window for the displayed pitch. Higher = more stable but slower to respond.',
    },
  ],
  faq: [
    {
      q: 'Why does the detected note jump around?',
      a: 'Background noise or harmonics can confuse the detector. Try moving closer to the microphone, reducing noise, or increasing the smoothing setting.',
    },
    {
      q: 'What instruments does this work for?',
      a: 'Any instrument or voice with a clear fundamental frequency: guitar, bass, violin, cello, flute, trumpet, vocals, etc. Percussion and noisy signals may not work well.',
    },
    {
      q: 'Does this record my audio?',
      a: 'No. The microphone stream is processed in real-time in your browser and never leaves this tab.',
    },
    {
      q: 'Why is the frequency not updating?',
      a: 'Make sure you granted microphone permission. The browser may block access if another tab is using the microphone.',
    },
  ],
  related: ['spectrogram', 'bpm-detector', 'mic-test'],
  status: 'beta',
};