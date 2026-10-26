/**
 * Editorial content for the spectrogram tool page.
 *
 * Kept out of ``spectrogram.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What a spectrogram shows',
      body: 'A waveform tells you when sound happens; a spectrogram tells you what it is made of. The file is split into overlapping frames, each windowed and transformed with a fast Fourier transform, and every frame becomes a thin column of pixels: frequency up the picture, time along it, brightness the energy per band. A vowel appears as parallel harmonic stripes, a snare as a vertical smear.',
    },
    {
      heading: 'Choosing the FFT size',
      body: 'The FFT size trades time against frequency detail. At 44.1 kHz a 256-point frame lasts about 6 ms and separates roughly 172 Hz per bin, ideal for percussive timing; a 4096-point frame lasts 93 ms and resolves about 11 Hz, suiting pitch. The 1024-point default sits between them.',
    },
    {
      heading: 'Why the window matters',
      body: 'Cutting a signal into frames smears energy across the spectrum, so a window function tapers each frame to zero at both edges. Hann is the default, Hamming keeps a flatter main lobe, and Blackman leaks least at some cost to sensitivity. If ghosts appear around a loud tone, try another window.',
    },
    {
      heading: 'Reading the dB scale',
      body: 'Colours map decibels, not raw amplitudes, because hearing is roughly logarithmic. The floor silences anything quieter and the ceiling pins the loudest; lowering it to minus one hundred reveals room tone and hiss, while raising it flattens everything but the loudest content.',
    },
    {
      heading: 'Everything stays on your device',
      body: 'Your browser decodes the file, the FFT runs in plain JavaScript, and the PNG is built byte by byte with no libraries. The same path drives the live microphone view, and no audio leaves your machine, so it works offline once cached.',
    },
  ],
  faq: [
    {
      q: 'Which audio formats can I load?',
      a: 'Whatever your browser can decode — commonly MP3, WAV, OGG, M4A and FLAC. The file is decoded locally with the Web Audio API, so support depends only on your browser, not on any server.',
    },
    {
      q: 'Why is the time axis blurred with a large FFT size?',
      a: 'Each column of the image covers one FFT frame, and a 4096-point frame spans about 93 ms at 44.1 kHz. Events shorter than a frame get averaged into it. Halve the FFT size to sharpen time at the cost of frequency detail.',
    },
    {
      q: 'My quiet recording looks almost blank — what do I change?',
      a: 'Lower the dB floor. The default −80 hides anything quieter; at −100 or −110 room tone, reverb tails and hiss appear. The ceiling does the opposite job: lower it to −20 to make mid-level material stand out.',
    },
    {
      q: 'Why does the frequency axis stop below 20 kHz?',
      a: 'The displayed band is clipped at the file’s Nyquist frequency — half its sample rate. A 32 kHz recording tops out at 16 kHz, which is a property of the file, not a limit of the tool.',
    },
    {
      q: 'Does anything leave my device?',
      a: 'No. Decoding, the FFT, the colour mapping and the PNG encoding all run in this tab. Nothing is uploaded, and the tool keeps working with no connection.',
    },
  ],
} as const;
