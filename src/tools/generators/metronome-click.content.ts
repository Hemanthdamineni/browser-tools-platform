/**
 * Editorial content for the metronome-click tool page.
 *
 * Kept out of ``metronome-click.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it generates',
      body: 'This is not a live metronome you listen to — it renders a click track to a WAV file you can download and drop into a DAW, a looper or a rehearsal. You set the tempo in BPM, the number of bars, the beats per bar and the sample rate (22,050, 44,100 or 48,000 Hz), and the tool synthesises one short click per beat and returns the finished audio with its duration.',
    },
    {
      heading: 'How the click is built',
      body: 'Each click is a sine tone at your chosen pitch with a fast exponential decay — about an 8-millisecond time constant — over 30 milliseconds, which is what gives it a crisp, percussive attack rather than a dull beep. Beat spacing is exactly 60/BPM seconds, so the track stays in time for its whole length, and the first beat of every bar can be accented with a higher pitch.',
    },
    {
      heading: 'Choosing pitches and tempo',
      body: 'The default click is 1,000 Hz and the accent 1,500 Hz — a clear, easy-to-follow pair. Raise them if the click must cut through a dense mix, or space the two further apart if the accent is easy to miss. Set beats per bar to 3 for a waltz, 6 for a compound feel, or any value from 1 to 16; the tempo range is 20 to 300 BPM and the track can run up to 64 bars.',
    },
    {
      heading: 'Limits and privacy',
      body: 'The output is mono PCM audio, so it is small but deliberately plain — no stereo width or reverb. Values outside the supported ranges are refused with a clear message rather than clamped silently. Synthesis happens entirely in your browser and the result is handed to you as a WAV data URI; nothing is uploaded and the tool works offline.',
    },
  ],
  faq: [
    {
      q: 'Is this a metronome I can listen to live, or a file?',
      a: 'It renders a downloadable WAV click track. Set the tempo, bars and time signature, and the tool returns the finished audio file to drop into a DAW, looper or practice session.',
    },
    {
      q: 'How is the accent on beat one made?',
      a: 'The first beat of each bar is synthesised at the accent pitch instead of the click pitch, so it stands out. Turn off "Accent the first beat" for a uniform track.',
    },
    {
      q: 'Does the click stay in time for the whole track?',
      a: 'Yes. Beats are placed at exact 60/BPM intervals across every bar, so there is no cumulative drift over a long track.',
    },
    {
      q: 'Is anything uploaded?',
      a: 'No. The click track is synthesised in your browser and returned as a WAV file; there is no network request and the page works offline.',
    },
  ],
} as const;
