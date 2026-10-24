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
      max: 160,
      step: 1,
      help: 'The slowest tempo the detector will consider. Raise it for very fast music.',
    },
    {
      key: 'maxBpm',
      label: 'Maximum BPM',
      type: 'number',
      default: 180,
      min: 80,
      max: 300,
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
  related: ['metronome-click', 'audio-info', 'tone-generator', 'mic-test'],
  status: 'stable',
};
