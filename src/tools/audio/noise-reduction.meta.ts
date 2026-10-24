import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'noise-reduction',
  name: 'Noise Reduction',
  category: 'audio',
  summary:
    'Remove background noise from speech with RNNoise, then blend the result back into the original.',
  description:
    'Suppress steady background noise (fans, hum, room tone) from a voice recording using the RNNoise neural model, which runs entirely in this tab. Audio is down-mixed to mono and resampled to 16 kHz and denoised, and you choose how many suppression passes to run and how strongly the denoised result is blended with the original. The before/after waveforms are drawn side by side, and the result downloads as a 16 kHz mono WAV.',
  keywords: [
    'noise reduction',
    'denoise',
    'rnnoise',
    'background noise',
    'voice',
    'speech',
    'remove noise',
    'audio denoise',
    'de-noise',
    'noise suppression',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'audio/*',
  panel: 'noise-reduction',
  worker: false,
  options: [
    {
      key: 'strength',
      label: 'Denoise strength',
      type: 'range',
      default: 1,
      min: 0,
      max: 1,
      step: 0.05,
      help: 'How much of the denoised signal to keep. 100% is fully denoised; 0% keeps the original untouched.',
    },
    {
      key: 'passes',
      label: 'Suppression passes',
      type: 'select',
      default: '1',
      choices: [
        { value: '1', label: '1 — gentle' },
        { value: '2', label: '2 — stronger' },
        { value: '3', label: '3 — aggressive' },
      ],
      help: 'How many times RNNoise is run over each frame. More passes remove more noise but can dull the speech.',
    },
  ],
  examples: [
    { title: 'Full denoise', options: { strength: 1, passes: '1' } },
    { title: 'Half-strength blend', options: { strength: 0.5, passes: '1' } },
    { title: 'Aggressive', options: { strength: 1, passes: '3' } },
  ],
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
  related: ['audio-normalize', 'audio-gain', 'audio-to-wav', 'audio-info'],
  credits: [
    {
      name: 'rnnoise-wasm (RNNoise compiled to WebAssembly)',
      url: 'https://github.com/jitsi/rnnoise-wasm',
      license: 'Apache-2.0',
    },
  ],
  status: 'beta',
};
