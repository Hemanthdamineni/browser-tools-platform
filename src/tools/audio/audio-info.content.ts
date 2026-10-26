/**
 * Editorial content for the audio-info tool page.
 *
 * Kept out of ``audio-info.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the report contains',
      body: 'The selected file is decoded with the Web Audio API and measured, not just read for tags. The table lists the file name, MIME type and byte size, then the duration in seconds, the sample rate in hertz, the channel count, the total number of sample frames and an estimated bitrate derived from size and duration. It finishes with peak and RMS levels in dBFS and whether the audio clips.',
    },
    {
      heading: 'When peak and RMS levels are useful',
      body: 'Peak is the loudest single sample; RMS is the average energy over the whole file and tracks perceived loudness far better. A track that peaks at 0 dBFS is clipping and will distort, while a healthy master often peaks near −1 dB and sits somewhere between −14 and −18 dB RMS. Read both before you normalise or master a recording.',
    },
    {
      heading: 'How clipping is decided',
      body: 'A file is flagged as clipping when any sample in any channel reaches full scale — 1.0, or 0 dBFS. Because decoding happens in floating point, a lossy MP3 that was loud in the studio can decode past full scale and be reported even when the original was clean. "No" means every decoded sample stayed inside range.',
    },
    {
      heading: 'Decoding happens in your browser',
      body: 'Nothing is uploaded. The file is decoded into raw Float32 channels using an OfflineAudioContext inside this tab, analysed and then discarded, so the tool makes no network request and works offline. Only formats the browser can already decode can be analysed, which in practice means MP3, WAV, OGG, M4A and FLAC.',
    },
  ],
  faq: [
    {
      q: 'Which formats are supported?',
      a: 'Whatever your browser can decode — commonly MP3, WAV, OGG, M4A and FLAC.',
    },
    {
      q: 'Why does the bitrate differ from the file name?',
      a: 'The estimated bitrate is computed from the file size divided by the decoded duration, so it includes container overhead, metadata and ID3 tags. A 320 kbps MP3 will therefore read slightly above 320 kbps, and a variable-bitrate file shows only its average.',
    },
    {
      q: 'What does a peak of 0.0 dB mean?',
      a: 'At least one sample reached full scale, which is reported as clipping. Lossy decoders can push samples slightly past full scale even when the master did not, so treat the flag as a warning to inspect the file rather than proof that it was exported badly.',
    },
  ],
} as const;
