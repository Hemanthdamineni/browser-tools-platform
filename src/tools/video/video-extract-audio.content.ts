/**
 * Editorial content for the video-extract-audio tool page.
 *
 * Kept out of ``video-extract-audio.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What comes out',
      body: 'Pick a video file and the tool decodes its audio and writes it back as a new audio download. Only the sound track is touched \u2014 the picture is never decoded, which keeps the job fast and light. The output is lossless WAV, or MP3 or AAC when your browser ships an encoder for that format, and the channels and bitrate follow your options.',
    },
    {
      heading: 'The primary track, at its own rate',
      body: 'The first, primary audio track is extracted, so extra tracks such as a director\u2019s commentary are ignored. The sample rate is carried over untouched: the WAV header writes the source rate verbatim and the compressed encoders are told the same rate, so nothing is resampled and the pitch and duration stay true to the source.',
    },
    {
      heading: 'Choosing WAV, MP3 or AAC',
      body: 'WAV is lossless PCM and works in every editor, but a minute of stereo audio takes roughly 10 MB. MP3 at 128 kbps is about a tenth of that and plays on the widest range of devices, while AAC is the default on Apple platforms. The quality option picks the bitrate for each compressed format: high at 192, medium at 128, low at 96.',
    },
    {
      heading: 'Missing encoders, and privacy',
      body: 'MP3 and AAC come from your browser\u2019s built-in audio encoder, and not every browser ships one: Chrome and Edge can encode both, while Firefox currently cannot encode either. The tool checks before it starts and says so plainly rather than producing a broken file. Decoding and re-encoding happen in this tab, so no part of the video or audio is uploaded.',
    },
  ],
  faq: [
    {
      q: 'Which format should I pick?',
      a: 'WAV is lossless and works in every editor, but a minute of stereo audio takes roughly 10 MB. MP3 and AAC are about a tenth of that; MP3 plays on the widest range of devices, AAC is the default on Apple platforms.',
    },
    {
      q: 'Why is MP3 or AAC greyed out or refused?',
      a: 'Those formats are produced by your browser’s built-in audio encoder. Not every browser ships one for every format — Chrome and Edge can encode both, Firefox currently cannot encode either. The tool checks before it starts and tells you plainly rather than producing a broken file.',
    },
    {
      q: 'Does the video get re-encoded?',
      a: 'No — only the sound track is read. The picture is never decoded, which makes the extraction faster and lighter than a full conversion.',
    },
    {
      q: 'Is the sample rate changed?',
      a: 'No. The WAV header carries the sample rate of the source track verbatim, and MP3/AAC are told the same rate whenever the encoder accepts it. Nothing is resampled.',
    },
    {
      q: 'What about multiple audio tracks?',
      a: 'The primary (first) audio track is extracted. Additional tracks, such as a director’s commentary, are ignored.',
    },
  ],
} as const;
