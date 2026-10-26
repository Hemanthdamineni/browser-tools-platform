/**
 * Editorial content for the audio-gain tool page.
 *
 * Kept out of ``audio-gain.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it does and what comes back',
      body: 'It decodes your file with the browser Web Audio decoder, multiplies every sample by the linear gain your dB figure implies, then hands back a WAV named from the original with a -gain suffix. The result is always 16-bit PCM WAV at the source sample rate and channel count, so a compressed input comes out noticeably larger.',
    },
    {
      heading: 'Picking a level',
      body: 'The Gain box takes -60 to 24 dB and defaults to 0, which passes the waveform through unchanged apart from the WAV re-encode. Use positive values to make a quiet recording audible, or negative ones to pull a loud track back from the ceiling. The change is relative: the tool never analyses the file for its actual loudness.',
    },
    {
      heading: 'Hard clip or the tanh curve',
      body: 'Hard clip at full scale is on by default, so samples pushed past plus or minus one are pinned flat at the edge and the run reports clipping so you can lower the gain. Turn it off and every sample passes through a tanh curve instead, which saturates smoothly and can never exceed full scale, at the cost of rounding loud transients.',
    },
    {
      heading: 'Limits and privacy',
      body: 'Only the first selected file is processed, and it must be a format this browser can decode, otherwise the run fails with an error message. The decode, the per-sample maths and the WAV encoding all happen on the page; no audio is uploaded, and the tool works offline.',
    },
  ],
  faq: [
    {
      q: 'What does 0 dB do?',
      a: 'The gain factor becomes 1, so sample values are unchanged; you still receive a WAV because the tool always re-encodes the decoded audio. It is a quick way to turn a decodable file into 16-bit PCM WAV.',
    },
    {
      q: 'How do I know if I clipped?',
      a: 'With hard clipping on, the stats show clipping as yes and a warning appears whenever any sample was pinned at full scale. Soft clipping never reports clipping because the tanh curve cannot exceed full scale, though loud passages are still shaped by it.',
    },
    {
      q: 'Why is the output always a WAV?',
      a: 'The browser exposes decoded PCM samples, and the page ships only a WAV encoder. There is no MP3 or AAC writer here, so the export is lossless but much larger than a compressed source.',
    },
  ],
} as const;
