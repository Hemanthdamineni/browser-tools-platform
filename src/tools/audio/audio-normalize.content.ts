/**
 * Editorial content for the audio-normalize tool page.
 *
 * Kept out of ``audio-normalize.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it does to your audio',
      body: 'This tool decodes an audio file, measures how loud it is, and applies a single constant gain so that the loudest sample or the average power lands on the level you asked for. It never changes the length, the sample rate or the number of channels: it is a plain volume change written into a new WAV file named after the input with a -normalized suffix.',
    },
    {
      heading: 'Peak versus RMS',
      body: 'Peak mode finds the largest absolute sample and scales the whole file until that sample sits at the target dBFS — the natural choice for a voice recording that is too quiet but otherwise consistent. RMS mode measures the average power across every sample instead, which suits material that should sit at a consistent perceived loudness. RMS is a simple root-mean-square average, not an LUFS loudness measurement, so it does not weight frequencies the way broadcast standards do.',
    },
    {
      heading: 'Choosing a target level',
      body: 'The target runs from -60 to 0 dB. For peak mode a value like -1 dB leaves a little headroom and avoids clipping on lossy re-encoding; 0 dB means the loudest sample touches full scale. For RMS mode a target around -14 dB is a typical working level. The tool reports the gain it applied in dB and the resulting true peak so you can see exactly how much it moved.',
    },
    {
      heading: 'Limits you should know about',
      body: 'A completely silent file has no meaningful level to scale and is refused rather than amplified into noise. Because the gain is constant, a file whose quiet passages should stay quiet will have those passages lifted too. Output is always WAV PCM, so a compressed source is re-encoded at its decoded sample rate and the result is much larger than the original file.',
    },
    {
      heading: 'Where the audio goes',
      body: 'Your file is decoded, measured and rewritten inside this browser tab. Nothing is uploaded, no server sees the audio, and the tool works with the network switched off.',
    },
  ],
  faq: [
    {
      q: 'Does normalising change the length of the audio?',
      a: 'No. Every sample keeps its position and the total sample count is unchanged; only the amplitude of each sample is scaled by the same factor.',
    },
    {
      q: 'Why does my normalised file sound distorted?',
      a: 'If the target is at or near 0 dB peak, an already-loud source can push individual samples past full scale and the result is clamped rather than wrapped. Choose a target of -1 dB or lower to leave headroom.',
    },
    {
      q: 'Is RMS the same as LUFS or ReplayGain?',
      a: 'No. This is a plain RMS average over all samples with no frequency weighting, gating or K-weighting. It is a useful guide, but a mastering tool using LUFS may pick a different gain.',
    },
    {
      q: 'What file formats can I feed it?',
      a: 'Anything the browser can decode — typically WAV, MP3, M4A/AAC, OGG and FLAC in current browsers. The output is always uncompressed WAV.',
    },
  ],
} as const;
