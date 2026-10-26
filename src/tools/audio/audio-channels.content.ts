/**
 * Editorial content for the audio-channels tool page.
 *
 * Kept out of ``audio-channels.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Six ways to remix a track',
      body: 'Decoded audio becomes plain Float32 channel buffers that are recombined without resampling. Convert to mono averages every channel into one; convert to stereo keeps stereo, duplicates a mono source, or folds more than two channels into left and right. Swap exchanges the channels, left-only and right-only send one side to both speakers, and mid-side encodes M=(L+R)/2 with S=(L−R)/2.',
    },
    {
      heading: 'Picking the right operation',
      body: 'Reach for to-mono when a phone interview drifts between speakers or you need a single track for a mono feed. Left-only or right-only rescues a channel that carries the dialogue while the other holds only music. Swap fixes a recording whose mic and instrument landed on the wrong side. Mid-side is what you want before narrowing or widening a stereo image.',
    },
    {
      heading: 'Sample rate and file format',
      body: 'Nothing is resampled here, so a 44.1 kHz or 48 kHz source comes back at exactly the same rate as a 16-bit PCM WAV. The download is named after the source file plus the operation, so interview-swap.wav is safe to keep beside the original.',
    },
    {
      heading: 'Caveats when folding channels',
      body: 'To-mono averages all source channels, so phase-inverted sides can partly cancel. When more than two channels fold to stereo the front channels are biased left and the rest right rather than following a surround down-mix, and mid-side applied to material that is already mid-side will not invert back to stereo.',
    },
    {
      heading: 'Private, in-tab decoding',
      body: 'Decoding and re-encoding both happen in this tab through the browser Web Audio API, so no audio leaves the machine and nothing is stored. The channel buffers live in memory only until the WAV is written out.',
    },
  ],
  faq: [
    {
      q: 'Does the output change sample rate?',
      a: 'No. The tool remixes channels without resampling, so the WAV comes out at the same sample rate as the source file, encoded as 16-bit PCM.',
    },
    {
      q: 'What is mid-side encoding for?',
      a: 'It writes M=(L+R)/2 and S=(L−R)/2 as two channels. Once you have the side isolated, narrowing or widening the stereo image is a small mix change on those two signals rather than on the full bandwidth.',
    },
    {
      q: 'What happens to a mono file in stereo operations?',
      a: 'To-stereo duplicates the single mono channel to both sides. To-mono on an already mono file returns it unchanged, and swap, left-only and right-only still work because the two sides are identical copies.',
    },
  ],
} as const;
