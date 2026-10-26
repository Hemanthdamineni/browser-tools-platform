/**
 * Editorial content for the audio-reverse tool page.
 *
 * Kept out of ``audio-reverse.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Sample-for-sample reversal',
      body: 'Choose any audio file your browser can decode and this tool plays it backwards. The file is decoded to floating-point channels with the Web Audio API, each channel is flipped, and the result is written back as an uncompressed 16-bit PCM WAV with a -reversed suffix.',
    },
    {
      heading: 'When reversed audio is the point',
      body: 'It is the quick way to craft the backwards-vocal or riser effect producers layer under a drop, to listen again to a clip you suspect was recorded in reverse, or to make a sound effect for a video edit without opening a DAW.',
    },
    {
      heading: 'There are deliberately no settings',
      body: 'The source sample rate and channel count are preserved exactly as decoded, so a 48 kHz stereo file comes back as 48 kHz stereo and only the sample order changes. The output is always WAV: reversing an encoded stream without decoding it is not possible.',
    },
    {
      heading: 'Limits and edge cases',
      body: 'The whole clip is decoded into memory, so hour-long recordings need a lot of RAM, and the WAV is larger than a compressed original. Files the browser cannot decode — some proprietary or DRM-protected formats — are reported as unsupported.',
    },
    {
      heading: 'Decoded on your device only',
      body: 'The decode and flip run inside your browser via Web Audio; the audio bytes are never uploaded and no request is made. Reversing a private voice memo or an unreleased track is safe, and it works offline.',
    },
  ],
  faq: [
    {
      q: 'Why is the output always a WAV file?',
      a: 'Reversing audio means decoding it to samples, flipping their order and encoding the result. Those samples are written back as 16-bit PCM WAV at the original sample rate, because re-encoding to a lossy format would add another generation of quality loss for no benefit.',
    },
    {
      q: 'Will the reversed file be larger than the original?',
      a: 'Usually, yes. A WAV stores uncompressed samples, so a reversed MP3, AAC or Ogg file comes back much bigger even though it is the same length and sounds the same. Convert the result afterwards if file size matters.',
    },
    {
      q: 'Which formats can I use as input?',
      a: 'Anything the browser itself can decode — typically MP3, WAV, Ogg Vorbis, FLAC and AAC/M4A. A format the browser cannot decode, such as some proprietary or DRM-protected files, is reported as undecodable rather than producing a silent or corrupt file.',
    },
    {
      q: 'Does reversal change the pitch or the speed?',
      a: 'No. It is purely a reordering of samples, so the duration, sample rate, channel count and pitch are unchanged — the clip simply plays from its last sample back to its first.',
    },
  ],
} as const;
