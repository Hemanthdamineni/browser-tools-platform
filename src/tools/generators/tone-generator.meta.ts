import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'tone-generator',
  name: 'Tone / Signal Generator',
  category: 'generators',
  summary: 'Generate a tone, waveform or noise signal as a downloadable WAV file.',
  description:
    'Synthesize sine, square, sawtooth, triangle, white-noise or pink-noise audio with a chosen duration, sample rate, amplitude, fade edges and mono/stereo output — entirely on your device.',
  keywords: [
    'tone',
    'audio',
    'signal',
    'generator',
    'sine',
    'square',
    'sawtooth',
    'triangle',
    'noise',
    'wav',
    'frequency',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'waveform',
      label: 'Waveform',
      type: 'select',
      default: 'sine',
      choices: [
        { value: 'sine', label: 'Sine' },
        { value: 'square', label: 'Square' },
        { value: 'sawtooth', label: 'Sawtooth' },
        { value: 'triangle', label: 'Triangle' },
        { value: 'white-noise', label: 'White noise' },
        { value: 'pink-noise', label: 'Pink noise' },
      ],
    },
    {
      key: 'frequency',
      label: 'Frequency (Hz)',
      type: 'number',
      default: 440,
      min: 20,
      max: 20000,
    },
    {
      key: 'durationMs',
      label: 'Duration (ms)',
      type: 'number',
      default: 2000,
      min: 50,
      max: 30000,
    },
    { key: 'amplitude', label: 'Amplitude (%)', type: 'range', default: 50, min: 0, max: 100 },
    {
      key: 'sampleRate',
      label: 'Sample rate',
      type: 'select',
      default: '44100',
      choices: [
        { value: '22050', label: '22,050 Hz' },
        { value: '44100', label: '44,100 Hz' },
        { value: '48000', label: '48,000 Hz' },
      ],
    },
    { key: 'fadeMs', label: 'Edge fade (ms)', type: 'number', default: 10, min: 0, max: 500 },
    {
      key: 'channels',
      label: 'Channels',
      type: 'select',
      default: 'mono',
      choices: [
        { value: 'mono', label: 'Mono' },
        { value: 'stereo', label: 'Stereo' },
      ],
    },
  ],
  examples: [
    {
      title: '440 Hz tuning tone',
      options: { waveform: 'sine', frequency: 440, durationMs: 3000 },
    },
    { title: 'Pink noise', options: { waveform: 'pink-noise', durationMs: 5000 } },
    {
      title: 'Click-free stereo square sweep reference',
      options: {
        waveform: 'square',
        frequency: 1000,
        durationMs: 4000,
        fadeMs: 50,
        channels: 'stereo',
      },
    },
  ],
  faq: [
    {
      q: 'What format is the generated signal?',
      a: 'A 16-bit PCM WAV rendered as an audio data URI, playable immediately and downloadable as tone.wav.',
    },
    {
      q: 'Does the frequency setting affect the noise waveforms?',
      a: 'No. White and pink noise ignore the frequency field, which is why the file stats show an em dash where the pitch would appear.',
    },
    {
      q: 'Why is there an edge fade option?',
      a: 'A tone that starts or ends at full amplitude clicks. The fade ramps the first and last few milliseconds to zero, so it is capped at half the clip length to avoid swallowing short signals.',
    },
    {
      q: 'What happens if I choose a frequency above the Nyquist limit?',
      a: 'Frequency must lie between 20 Hz and half the sample rate; anything higher is rejected with a validation error because the chosen sample rate cannot represent it.',
    },
  ],
  article: [
    {
      heading: 'What the signal generator emits',
      body: 'Synthesize a mono or stereo 16-bit PCM WAV entirely in this tab from one of six sources: sine, square, sawtooth, triangle, white noise or one-pole-filtered pink noise. The result is returned as an audio data URI you can play at once or save as tone.wav, with the waveform, frequency, duration, sample rate and channel count reported alongside it.',
    },
    {
      heading: 'When to reach for a test tone',
      body: 'Use it to check a speaker at a known frequency, tune an instrument against a 440 Hz reference, audition a filter, measure how loud a room sounds, or build a pink-noise loop for loudness matching. Because the output is a plain WAV, the same clip can feed any downstream analyser.',
    },
    {
      heading: 'Options that change the sound',
      body: 'The waveform select picks the source, frequency must stay between 20 Hz and the Nyquist limit, and duration runs from 50 ms to 30 seconds. Amplitude, sample rate, a short edge fade and the mono or stereo switch control loudness, resolution and click-free starts and ends.',
    },
    {
      heading: 'Validation and limits',
      body: 'Out-of-range duration, sample rate, amplitude, frequency or fade each raise a descriptive error, and a tonal frequency above half the sample rate is refused because it cannot be represented. Fade frames are capped at half the clip length.',
    },
    {
      heading: 'Synthesis never leaves this tab',
      body: 'Every sample is generated with plain JavaScript and the WAV header is assembled locally, so no audio is uploaded and the generator keeps working offline once cached.',
    },
  ],
  related: ['metronome-click', 'audio-info'],
  status: 'stable',
};
