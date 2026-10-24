import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'speaker-test',
  name: 'Speaker Test',
  category: 'device',
  summary:
    'Play a test tone or a log-spaced frequency sweep out of the left, right or both channels.',
  description:
    'Send a steady tone or a smooth frequency sweep to just the left speaker, just the right one, or both, and listen for dead drivers, crackle or a lopsided balance. Every tone is synthesized in this tab and played straight to your speakers — nothing is recorded, stored or uploaded.',
  keywords: [
    'speaker',
    'speakers',
    'speaker test',
    'left right',
    'channel',
    'balance',
    'tone',
    'frequency sweep',
    'stereo',
    'audio test',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  panel: 'speaker-test',
  options: [
    {
      key: 'channel',
      label: 'Channel',
      type: 'select',
      default: 'both',
      choices: [
        { value: 'left', label: 'Left' },
        { value: 'right', label: 'Right' },
        { value: 'both', label: 'Both' },
      ],
      help: 'Which speaker to aim the tone at. “Both” also confirms the two channels are in phase.',
    },
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'tone',
      choices: [
        { value: 'tone', label: 'Steady tone' },
        { value: 'sweep', label: 'Frequency sweep' },
      ],
    },
    {
      key: 'frequency',
      label: 'Frequency (Hz)',
      type: 'number',
      default: 440,
      min: 20,
      max: 20000,
      help: 'The tone you hear. The slider is logarithmic, so every octave gets the same travel.',
    },
    {
      key: 'sweepStart',
      label: 'Sweep start (Hz)',
      type: 'number',
      default: 20,
      min: 20,
      max: 20000,
      showWhen: { key: 'mode', value: 'sweep' },
    },
    {
      key: 'sweepEnd',
      label: 'Sweep end (Hz)',
      type: 'number',
      default: 20000,
      min: 20,
      max: 20000,
      showWhen: { key: 'mode', value: 'sweep' },
    },
    {
      key: 'duration',
      label: 'Duration',
      type: 'text',
      default: '3s',
      placeholder: '3s, 1500ms, 0.5m',
      help: 'How long to play, as seconds, milliseconds or minutes.',
    },
    {
      key: 'includeTimestamps',
      label: 'Show the time of each play in the report',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    { title: 'Check the balance', options: { channel: 'both', frequency: 1000 } },
    { title: 'Left speaker only', options: { channel: 'left', frequency: 440, duration: '2s' } },
    { title: 'Full range sweep', options: { mode: 'sweep', channel: 'both', duration: '6s' } },
  ],
  faq: [
    {
      q: 'Will the tone hurt my speakers?',
      a: 'A moderate steady tone at a normal listening level is safe. The panel plays at a modest gain and fades the edges, and it reminds you to start quiet. If you ever hear distortion or a rattle, stop and turn the volume down before continuing.',
    },
    {
      q: 'What should a good speaker sound like?',
      a: 'Every driver should be even across the sweep — no sudden drop, buzz or rattle. The two channels should sound the same and the “Both” tone should stay central rather than pulling to one side.',
    },
    {
      q: 'Does this page send any audio anywhere?',
      a: 'No. The tone is synthesized by your own browser and played straight to your speakers. Nothing is recorded, stored or uploaded, and the page works with no connection at all.',
    },
  ],
  related: ['mic-test', 'tone-generator', 'audio-channels'],
  article: [
    {
      heading: 'What it does',
      body: 'Speaker Test plays a steady tone or a smooth frequency sweep out of the left speaker, the right speaker, or both. Every tone is synthesized by the Web Audio API in this tab and played straight to your output device, so you hear exactly what your browser is sending.',
    },
    {
      heading: 'When to use it',
      body: 'Use it to check a new pair of headphones, a laptop with one quiet driver, or a desktop setup after moving cables. A left/right tone confirms the channels are not swapped, while a sweep exposes a dead tweeter or a rattle that a single note would miss.',
    },
    {
      heading: 'The controls',
      body: 'Pick a channel and a mode. The steady tone has a frequency field and a logarithmic slider that gives every octave the same travel, from 20 Hz to 20 kHz, with the nearest musical note beside it. Sweep mode takes a start and an end frequency instead, and the duration field accepts seconds, milliseconds or minutes.',
    },
    {
      heading: 'Reading the result',
      body: 'Each play is logged, and the report lists what was played, on which channel, for how long and when. Watch for a channel that is silent, quieter than the other, or that buzzes at one particular frequency — that is the sort of fault a sweep is good at finding.',
    },
    {
      heading: 'Privacy and caveats',
      body: 'The tone is generated on your device; nothing is recorded, stored or sent, and the page works offline. Remember that your ears and your volume shape what you hear: a tone above about 15 kHz is inaudible to many adults, which is not a fault in the speaker.',
    },
  ],
  status: 'stable',
};
