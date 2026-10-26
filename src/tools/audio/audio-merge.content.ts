/**
 * Editorial content for the audio-merge tool page.
 *
 * Kept out of ``audio-merge.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Concatenate versus mix',
      body: 'Concatenate plays one file after another, end-to-end, with an optional silent gap in milliseconds between tracks. Mix lays every input on top of the others, starting them together and keeping the longest duration; overlapping samples are summed and the whole result is scaled down only if the peak would clip. Both modes emit a single WAV file.',
    },
    {
      heading: 'How different formats are reconciled',
      body: 'Each input is decoded to its samples, then remixed to a common channel count (stereo if any input is stereo, else mono) and resampled to the highest sample rate present. That shared layout is what lets files of different formats, sample rates and channel counts be joined or mixed at all.',
    },
    {
      heading: 'Matching loudness across clips',
      body: 'Turn on Match RMS loudness and the tool computes the median root-mean-square level of the non-silent tracks as a target, then scales every other track so its RMS matches. This evens out a loud track next to a quiet one before combining — useful for joining podcast segments or practice takes of differing volume.',
    },
    {
      heading: 'When to use it and privacy',
      body: 'Use it to assemble a podcast or an audiobook, or to layer a backing track with a guide vocal. All decoding, resampling, mixing and WAV encoding happen in this tab — at least two files are required — and nothing is uploaded or leaves your device.',
    },
  ],
  faq: [
    {
      q: 'Do I need the same format for every file?',
      a: 'No. Each file is decoded and resampled to the highest sample rate, and remixed to a common channel count, so WAV, MP3, OGG and similar can be combined in one run.',
    },
    {
      q: 'How is clipping prevented in mix mode?',
      a: 'Overlapping samples are summed, then if the peak exceeds 1.0 the whole mix is scaled down by that peak so the loudest moment fits without distortion.',
    },
    {
      q: 'Is my audio uploaded?',
      a: 'No. Decode, resample, mix and WAV encoding all run locally in your browser tab, so nothing leaves your device and the page works offline.',
    },
  ],
} as const;
