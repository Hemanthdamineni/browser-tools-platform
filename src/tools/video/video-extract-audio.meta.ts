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
  article: [
    {
      heading: 'What comes out',
      body: 'Pick a video file and the tool decodes its audio and writes it back as a new audio download. Only the sound track is touched \u2014 the picture is never decoded, which keeps the job fast and light compared with a full conversion. The output is a lossless WAV, or an MP3 or AAC when your browser ships an encoder for that format; the channel layout and, for the compressed formats, the bitrate follow the options you set.',
    },
    {
      heading: 'The primary track and its format',
      body: 'The first, primary audio track is the one extracted; additional tracks such as a director\u2019s commentary are ignored. The sample rate is carried over untouched \u2014 the WAV header writes the source rate verbatim and the compressed encoders are told the same rate \u2014 so nothing is resampled and the pitch and duration stay true to the source.',
    },
    {
      heading: 'Choosing WAV, MP3 or AAC',
      body: 'WAV is lossless PCM and works in every editor, but a minute of stereo audio takes roughly 10 MB, which is why the compressed choices exist. MP3 at 128 kbps is about a tenth of that size and plays on the widest range of devices, while AAC is the default on Apple platforms. The quality option for each compressed format picks the bitrate \u2014 high at 192, medium at 128, low at 96 \u2014 trading size against fidelity.',
    },
    {
      heading: 'Why an encoder can be missing',
      body: 'MP3 and AAC come from your browser\u2019s built-in audio encoder, and not every browser ships one for every format: Chrome and Edge can encode both, while Firefox currently cannot encode either. The tool checks before it starts and tells you plainly that the format is unavailable rather than producing a broken or silent file, so on such a browser you still get WAV and can convert it elsewhere.',
    },
    {
      heading: 'The audio stays on your device',
      body: 'The sound track is decoded and re-encoded in this browser tab through the bundled mediabunny decoder. No part of the video or the extracted audio is uploaded, and the page makes no network request, so you can rip a clip without it leaving your machine.',
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
  credits: [{ name: 'mediabunny', url: 'https://mediabunny.dev', license: 'MPL-2.0' }],
  related: ['video-compress', 'video-info', 'audio-convert', 'audio-trim'],
  status: 'beta',
};
