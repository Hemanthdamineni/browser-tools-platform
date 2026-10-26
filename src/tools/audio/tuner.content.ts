/**
 * Editorial content for the tuner tool page.
 *
 * Kept out of ``tuner.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
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
} as const;
