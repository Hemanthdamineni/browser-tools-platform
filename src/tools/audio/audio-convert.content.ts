/**
 * Editorial content for the audio-convert tool page.
 *
 * Kept out of ``audio-convert.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'How the conversion works',
      body: 'Each file is decoded to raw samples with the Web Audio API, optionally resampled to your chosen rate and re-mixed to mono or stereo, then encoded in the format you picked. Because decoding uses an OfflineAudioContext, no speaker or microphone is involved and the whole pipeline stays on your device.',
    },
    {
      heading: 'WAV output is lossless',
      body: 'WAV is written as uncompressed 16-bit PCM with a canonical RIFF/WAVE header, the same bytes a CD-quality editor would produce. It is larger than the other formats but plays everywhere and survives further editing without generation loss, which makes it the right choice when quality matters more than size.',
    },
    {
      heading: 'MP3 and the bundled encoder',
      body: 'MP3 is produced by lamejs, a JavaScript port of the LAME encoder, at 128–320 kbps. lamejs is LGPL-3.0 and is shipped as a separate-file library loaded as its own lazy chunk: only the library itself is covered by the LGPL, never this site’s own code, and the chunk is fetched from this origin the first time you convert to MP3 and never on page load.',
    },
    {
      heading: 'Opus and browser support',
      body: 'Opus export uses the browser’s built-in WebCodecs AudioEncoder, available in Chrome 94 and later. Where that API is missing the tool reports that Opus is unsupported rather than writing a file that will not play, so the option never silently fails; WAV and MP3 keep working in every browser.',
    },
  ],
  faq: [
    {
      q: 'Is anything uploaded?',
      a: 'No. The file is decoded and re-encoded entirely in your browser. There are no uploads, accounts or network requests, and the tool works with no connection once it has been cached.',
    },
    {
      q: 'Why does MP3 export need a separate download?',
      a: 'The MP3 encoder (lamejs, LGPL-3.0) is a separate-file library that is only fetched the first time you convert to MP3 — never on page load. It is served from this origin and not from a third party.',
    },
    {
      q: 'Why does it say Opus is unsupported?',
      a: 'Opus export uses the browser’s built-in WebCodecs AudioEncoder, which needs Chrome 94 or newer (or an equivalent browser). On older browsers the tool says so instead of producing a broken file — choose WAV or MP3 there.',
    },
    {
      q: 'Which bitrate should I pick?',
      a: 'For MP3, 192 kbps is a safe default and 320 kbps is close to the original. Opus sounds good at 96 kbps, so its options start lower; higher rates cost more size for little gain on typical material.',
    },
  ],
} as const;
