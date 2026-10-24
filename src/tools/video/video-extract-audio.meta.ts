import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'video-extract-audio',
  name: 'Extract Audio from Video',
  category: 'video',
  summary: 'Pull the sound track out of a video as WAV, MP3 or AAC — entirely on your device.',
  description:
    'Take the audio out of a clip without touching the picture. The sound is decoded on your device and written back as a lossless WAV, or as MP3 or AAC when your browser ships an encoder for it. Nothing is uploaded.',
  keywords: [
    'video',
    'audio',
    'extract',
    'sound',
    'rip',
    'wav',
    'mp3',
    'aac',
    'pcm',
    'convert',
    'soundtrack',
    'music',
    'offline',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'video/*,.mp4,.m4v,.mov,.webm,.mkv,.ogv,.ts',
  options: [
    {
      key: 'format',
      label: 'Output format',
      type: 'select',
      default: 'wav',
      choices: [
        { value: 'wav', label: 'WAV — lossless PCM, largest' },
        { value: 'mp3', label: 'MP3 — small, plays everywhere' },
        { value: 'aac', label: 'AAC — small, Apple-friendly' },
      ],
      help: 'WAV always works. MP3 and AAC need a browser audio encoder; if yours lacks one, the tool says so instead of failing silently.',
    },
    {
      key: 'quality',
      label: 'Quality',
      type: 'select',
      default: 'medium',
      choices: [
        { value: 'high', label: 'High — 192 kbps' },
        { value: 'medium', label: 'Medium — 128 kbps' },
        { value: 'low', label: 'Low — 96 kbps' },
      ],
      showWhen: { key: 'format', value: 'mp3' },
      help: 'Higher quality sounds better and takes more space. Applies to MP3.',
    },
    {
      key: 'aacQuality',
      label: 'Quality',
      type: 'select',
      default: 'medium',
      choices: [
        { value: 'high', label: 'High — 192 kbps' },
        { value: 'medium', label: 'Medium — 128 kbps' },
        { value: 'low', label: 'Low — 96 kbps' },
      ],
      showWhen: { key: 'format', value: 'aac' },
      help: 'Higher quality sounds better and takes more space. Applies to AAC.',
    },
    {
      key: 'channels',
      label: 'Channels',
      type: 'select',
      default: 'original',
      choices: [
        { value: 'original', label: 'Keep the original layout' },
        { value: 'mono', label: 'Mono — mix everything to one channel' },
        { value: 'stereo', label: 'Stereo' },
      ],
      help: 'The source layout is kept unless you ask for mono or stereo.',
    },
  ],
  examples: [
    { title: 'Rip the sound as WAV', options: { format: 'wav' } },
    { title: 'Make a small MP3 of the audio', options: { format: 'mp3', quality: 'medium' } },
    { title: 'Mono WAV for transcription', options: { format: 'wav', channels: 'mono' } },
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
  credits: [{ name: 'mediabunny', url: 'https://mediabunny.dev', license: 'MPL-2.0' }],
  related: ['video-compress', 'video-info', 'audio-convert', 'audio-trim'],
  status: 'beta',
};
