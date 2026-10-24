import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'tuner',
  name: 'Tuner',
  category: 'audio',
  summary:
    'Tune an instrument from your microphone: see the note, the cents deviation and a needle.',
  description:
    'Open your microphone and the tuner detects the pitch of what you play or sing — equal temperament with A4 = 440 Hz. It shows the nearest note, how many cents sharp or flat it is on a live needle, and the reference frequency for every note. You can recalibrate A4 (e.g. 442 or the baroque 415) and capture a session to review several readings as a table. Everything happens in this tab — no audio ever leaves your device.',
  keywords: [
    'tuner',
    'pitch',
    'note',
    'cents',
    'frequency',
    'guitar tuner',
    'bass tuner',
    'violin',
    'ukelele',
    'calibration',
    'A4',
    'microphone',
    'YIN',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  panel: 'tuner',
  worker: false,
  options: [
    {
      key: 'a4',
      label: 'Calibration note (A4 reference, Hz)',
      type: 'range',
      default: 440,
      min: 400,
      max: 480,
      step: 0.5,
      help: 'The frequency of the A above middle C. 440 is standard; orchestras often tune to 442, and baroque ensembles to 415.',
    },
    {
      key: 'sensitivity',
      label: 'Detection sensitivity',
      type: 'range',
      default: 0.12,
      min: 0.05,
      max: 0.3,
      step: 0.01,
      help: 'How strongly a pitch must stand out before it is trusted. Lower values are pickier about noise; higher values lock onto quiet sounds more readily.',
    },
    {
      key: 'notation',
      label: 'Note notation',
      type: 'select',
      default: 'sharps',
      choices: [
        { value: 'sharps', label: 'Sharps (C♯, D♯, …)' },
        { value: 'flats', label: 'Flats (D♭, E♭, …)' },
      ],
    },
    {
      key: 'toleranceCents',
      label: 'In-tune tolerance',
      type: 'number',
      default: 5,
      min: 1,
      max: 25,
      help: 'How many cents a note may deviate and still count as in tune in the report.',
    },
  ],
  examples: [
    {
      title: 'Perfectly tuned A4',
      input: '440',
      options: { toleranceCents: 2 },
    },
    {
      title: 'A full A major arpeggio',
      input: '440 554.37 659.26 880',
      options: { toleranceCents: 5 },
    },
    {
      title: 'Session snapshot (readings + sample rate)',
      input: '{"readings":[440,440.5,441,439],"sampleRate":48000}',
      options: { a4: 442 },
    },
  ],
  article: [
    {
      heading: 'What the tuner shows',
      body: 'When you play or sing a single note into the microphone, the tuner names the nearest note and draws a needle showing how far sharp or flat it is — positive cents are sharp, negative are flat. A needle centred on the reference line means the note is in tune. Each note’s reference frequency assumes equal temperament with a reference A4, which you can recalibrate.',
    },
    {
      heading: 'How the pitch is detected',
      body: 'The detector runs YIN, a time-domain autocorrelation method. It finds the period of the waveform — the shortest lag at which the signal best matches a shifted copy of itself — and converts that period to a frequency. The analysis is smoothed and only reports a note when the pitch is confident, so quiet noise or silence shows a placeholder instead of a random note.',
    },
    {
      heading: 'Calibration',
      body: 'A4 is 440 Hz by default. To tune to a different standard, move the calibration slider: 442 Hz matches many modern orchestras, and 415 Hz (roughly a half-step lower) is common for baroque period instruments. The needle and the reference list both use the value you pick.',
    },
    {
      heading: 'Privacy',
      body: 'The microphone audio is analysed in this tab only — it is never uploaded and never stored. Use Capture to record a note’s measured frequency and Review to tabulate the readings you have taken.',
    },
  ],
  faq: [
    {
      q: 'How do I tune my guitar?',
      a: 'Pluck a string and hold it — the tuner locks onto the note and shows whether it is sharp or flat. Use the calibration slider first if you are tuning to anything other than A4 = 440. Capture a reading while the needle is centred, then move on to the next string.',
    },
    {
      q: 'Why does it show nothing?',
      a: 'The tuner only reports a pitch when the signal is loud enough and the detected period is confident. Talk near the microphone instead of playing, or move closer. Quiet hum, a fan, or room noise is ignored on purpose so it does not light up as a false note.',
    },
    {
      q: 'What do the cents mean?',
      a: 'A cent is one hundredth of a semitone. A needle a quarter of the way right of centre is about +12 cents sharp of the note — close, but audibly out of tune. In-tune tolerance defaults to ±5 cents, which most players find acceptable.',
    },
  ],
  related: ['mic-test', 'tone-generator', 'audio-info', 'bpm-detector'],
  status: 'beta',
};
