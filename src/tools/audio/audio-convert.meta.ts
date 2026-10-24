import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'audio-convert',
  name: 'Convert Audio',
  category: 'audio',
  summary: 'Convert audio to WAV, MP3 or Opus/OGG — locally in your browser, no uploads.',
  description:
    'Convert a browser-supported audio file into WAV (16-bit PCM), MP3 or Opus/OGG. Pick a sample rate, mono or stereo, and a bitrate; every step runs on your device and nothing is uploaded.',
  keywords: [
    'audio convert',
    'convert audio',
    'wav',
    'mp3 converter',
    'opus',
    'ogg',
    'audio to mp3',
    'pcm',
    'sample rate',
    'channels',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'audio/*',
  multiple: true,
  worker: false,
  options: [
    {
      key: 'format',
      label: 'Output format',
      type: 'select',
      default: 'wav',
      choices: [
        { value: 'wav', label: 'WAV (16-bit PCM, lossless)' },
        { value: 'mp3', label: 'MP3 (lossy)' },
        { value: 'opus', label: 'Opus / OGG (lossy)' },
      ],
    },
    {
      key: 'sampleRate',
      label: 'Sample rate',
      type: 'select',
      default: 'original',
      choices: [
        { value: 'original', label: 'Original' },
        { value: '8000', label: '8,000 Hz' },
        { value: '16000', label: '16,000 Hz' },
        { value: '22050', label: '22,050 Hz' },
        { value: '44100', label: '44,100 Hz' },
        { value: '48000', label: '48,000 Hz' },
      ],
    },
    {
      key: 'channels',
      label: 'Channels',
      type: 'select',
      default: 'original',
      choices: [
        { value: 'original', label: 'Original' },
        { value: 'mono', label: 'Mono' },
        { value: 'stereo', label: 'Stereo' },
      ],
    },
    {
      key: 'bitDepth',
      label: 'Bit depth',
      type: 'select',
      default: '16',
      choices: [{ value: '16', label: '16-bit PCM' }],
      showWhen: { key: 'format', value: 'wav' },
    },
    {
      key: 'mp3Bitrate',
      label: 'MP3 bitrate',
      type: 'select',
      default: '192',
      choices: [
        { value: '128', label: '128 kbps' },
        { value: '192', label: '192 kbps' },
        { value: '256', label: '256 kbps' },
        { value: '320', label: '320 kbps' },
      ],
      help: 'Higher is bigger and closer to the original; 192 kbps is a good default.',
      showWhen: { key: 'format', value: 'mp3' },
    },
    {
      key: 'opusBitrate',
      label: 'Opus bitrate',
      type: 'select',
      default: '96',
      choices: [
        { value: '64', label: '64 kbps' },
        { value: '96', label: '96 kbps' },
        { value: '128', label: '128 kbps' },
        { value: '192', label: '192 kbps' },
      ],
      help: 'Opus sounds good at much lower bitrates than MP3; 96 kbps is usually plenty.',
      showWhen: { key: 'format', value: 'opus' },
    },
  ],
  examples: [
    { title: 'Convert to WAV', options: { format: 'wav' } },
    { title: 'MP3 at 192 kbps', options: { format: 'mp3', mp3Bitrate: '192' } },
    { title: 'Opus in OGG at 96 kbps', options: { format: 'opus', opusBitrate: '96' } },
    {
      title: 'WAV at 16 kHz mono',
      options: { format: 'wav', sampleRate: '16000', channels: 'mono' },
    },
  ],
  faq: [
    {
      q: 'Is anything uploaded?',
      a: 'No. The file is decoded and re-encoded entirely in your browser. There are no uploads, accounts or network requests, and the tool works with no connection once it has been cached.',
    },
    {
      q: 'Why does MP3 export need a separate download?',
      a: 'The MP3 encoder (lamejs, LGPL-3.0) is a separate-file library that is only fetched the first time you convert to MP3 — never on page load. It is served from this origin and not from a third party.',
    },
    {
      q: 'Why does it say Opus is unsupported?',
      a: 'Opus export uses the browser’s built-in WebCodecs AudioEncoder, which needs Chrome 94 or newer (or an equivalent browser). On older browsers the tool says so instead of producing a broken file — choose WAV or MP3 there.',
    },
    {
      q: 'Which bitrate should I pick?',
      a: 'For MP3, 192 kbps is a safe default and 320 kbps is close to the original. Opus sounds good at 96 kbps, so its options start lower; higher rates cost more size for little gain on typical material.',
    },
  ],
  related: ['audio-info', 'audio-trim', 'audio-speed'],
  credits: [
    {
      name: 'lamejs (LAME MP3 encoder port)',
      url: 'https://github.com/zhuker/lamejs',
      license: 'LGPL-3.0',
    },
  ],
  article: [
    {
      heading: 'How the conversion works',
      body: 'Each file is decoded to raw samples with the Web Audio API, optionally resampled to your chosen rate and re-mixed to mono or stereo, then encoded in the format you picked. Because decoding uses an OfflineAudioContext, no speaker or microphone is involved and the whole pipeline stays on your device.',
    },
    {
      heading: 'WAV output is lossless',
      body: 'WAV is written as uncompressed 16-bit PCM with a canonical RIFF/WAVE header, the same bytes a CD-quality editor would produce. It is larger than the other formats but plays everywhere and survives further editing without generation loss, which makes it the right choice when quality matters more than size.',
    },
    {
      heading: 'MP3 and the bundled encoder',
      body: 'MP3 is produced by lamejs, a JavaScript port of the LAME encoder, at 128–320 kbps. lamejs is LGPL-3.0 and is shipped as a separate-file library loaded as its own lazy chunk: only the library itself is covered by the LGPL, never this site’s own code, and the chunk is fetched from this origin the first time you convert to MP3 and never on page load.',
    },
    {
      heading: 'Opus and browser support',
      body: 'Opus export uses the browser’s built-in WebCodecs AudioEncoder, available in Chrome 94 and later. Where that API is missing the tool reports that Opus is unsupported rather than writing a file that will not play, so the option never silently fails; WAV and MP3 keep working in every browser.',
    },
  ],
  status: 'stable',
  updated: '2026-10-24',
};
