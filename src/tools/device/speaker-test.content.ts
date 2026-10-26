/**
 * Editorial content for the speaker-test tool page.
 *
 * Kept out of ``speaker-test.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
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
} as const;
