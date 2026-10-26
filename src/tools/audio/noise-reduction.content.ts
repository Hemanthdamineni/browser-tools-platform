/**
 * Editorial content for the noise-reduction tool page.
 *
 * Kept out of ``noise-reduction.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'How it works',
      body: 'The track is decoded with the browser’s own audio decoder, mixed to mono and resampled to 16 kHz, the only sample rate the RNNoise neural model understands. It is then split into 30 ms frames of 480 samples and each frame is passed through the model, which separates the speech from steady background noise and returns a cleaned frame.',
    },
    {
      heading: 'Strength and passes',
      body: 'Denoise strength blends the denoised track with the original: 100% is the fully denoised result, 0% leaves the original untouched, and a value between them is a linear crossfade. Suppression passes runs RNNoise more than once over every frame; two or three passes remove more noise but can dull fast speech, so the gentler single pass is a good starting point.',
    },
    {
      heading: 'The before/after waveform',
      body: 'After processing, the panel draws the original and the denoised signal as overlaid peak waveforms, grey for before and red for after, so you can see at a glance where the model trimmed the background. The download is always a 16 kHz mono 16-bit PCM WAV, which is what RNNoise produces regardless of the source file’s own sample rate.',
    },
    {
      heading: 'Privacy and limits',
      body: 'Everything runs on this device, in this tab, so the audio never leaves your browser. The model is compiled to WebAssembly and is served from this origin, fetched only when you first run the tool. The output is mono at 16 kHz, which suits speech, podcasts, dictation, interviews, and other dialogue, not music.',
    },
  ],
  faq: [
    {
      q: 'Does it work on music?',
      a: 'It is built for speech. RNNoise is a voice-activity model, so on music it tends to dull or gate the signal. Use it on dialogue, podcasts, meetings, dictation, and similar voice recordings.',
    },
    {
      q: 'Why is the output 16 kHz mono?',
      a: 'RNNoise only processes 16 kHz mono frames, so the tool down-mixes, resamples, denoises, and outputs a 16 kHz mono WAV regardless of the source. A stereo or 44.1 kHz file is converted on its way through.',
    },
    {
      q: 'Does the audio leave my device?',
      a: 'No. Decoding, denoising, and encoding all happen in this tab, and the model wasm is served from this same origin. Nothing is uploaded or stored.',
    },
    {
      q: 'What is “denoise strength”?',
      a: 'It is how much of the denoised signal is kept. 100% is the fully denoised track, 0% is the original, and values between are a linear mix, so you can keep a little of the original air while removing the worst of the noise.',
    },
  ],
} as const;
