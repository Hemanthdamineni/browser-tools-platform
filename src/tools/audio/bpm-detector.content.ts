/**
 * Editorial content for the bpm-detector tool page.
 *
 * Kept out of ``bpm-detector.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'How the detector works',
      body: 'Your audio is mixed to mono and cut into overlapping frames. Each frame is Fourier-transformed over a Hann window, and the detector keeps only the magnitude increases between consecutive frames — the “spectral flux”. Transients like drum hits and bass plucks push the flux up sharply, so the flux envelope is a rough impulse train at the beat rate.',
    },
    {
      heading: 'Finding the tempo',
      body: 'The detector autocorrelates that flux envelope — it slides the signal against itself and asks how well each shift lines up. The shift (lag) that lines up best, inside the BPM window you set, is the beat period. The detector then snaps that lag to the strongest whole octave inside the window, so a track in half-time does not read as double speed.',
    },
    {
      heading: 'Confidence and ambiguity',
      body: 'The confidence score says how much the winning lag stood out from the rest of the window — a clean, steady beat scores near 100%, while a rubato or noisy recording scores low. Tempo detection has a built-in octave ambiguity: a beat can always be doubled or halved and still feel musical, so when one is in range the report lists it as an alternative.',
    },
    {
      heading: 'Tap tempo fallback',
      body: 'Press the “Tap” button (or the space bar) along with the beat. After a few taps the panel shows a running median of your intervals as a BPM, which is robust to one mis-timed tap. Nothing is uploaded — the file and the microphone are read entirely in this tab.',
    },
  ],
  faq: [
    {
      q: 'Why does the detector sometimes report double or half the real tempo?',
      a: 'Music written in 2/2, 6/8 or half-time has a strong pulse at half the obvious speed, and very fast music can be counted in twice. Autocorrelation finds the most salient periodic pulse; when the “real” tempo and its octave neighbour are both plausible the report lists the alternative so you can pick the one that feels right.',
    },
    {
      q: 'Does anything leave my device?',
      a: 'No. The audio file and the microphone are decoded and analysed entirely by your browser in this tab. Nothing is uploaded and nothing is stored.',
    },
    {
      q: 'Why is the confidence low?',
      a: 'Low confidence usually means the beat is weak or irregular — ambient noise, a solo voice, or rubato passages. Try a cleaner excerpt with a clear drum or bass groove, or use the tap tempo for a manual reading.',
    },
  ],
} as const;
