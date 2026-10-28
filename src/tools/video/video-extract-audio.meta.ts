import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'video-extract-audio',
  name: 'Extract Audio',
  category: 'video',
  summary: 'Pull audio from a video file: MP3, AAC or WAV.',
  description:
    'Extract the audio track from a video (or audio-only file) and save it as MP3, AAC or WAV. The video container is stripped away completely. Everything happens in your browser — nothing is uploaded.',
  keywords: [
    'video',
    'extract',
    'audio',
    'mp3',
    'aac',
    'wav',
    'demux',
    'strip',
    'container',
    'mp4',
    'webm',
    'mkv',
    'mov',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'video/*,.mp4,.m4v,.mov,.webm,.mkv,.ogv,.ts,.m4a,.aac',
  options: [
    {
      key: 'outputFormat',
      label: 'Output format',
      type: 'select',
      default: 'mp3',
      choices: [
        { value: 'mp3', label: 'MP3 (32 kbps–320 kbps, VBR)' },
        { value: 'aac', label: 'AAC (high quality, MP4 container)' },
        { value: 'wav', label: 'WAV (uncompressed, 16-bit PCM)' },
      ],
    },
    {
      key: 'bitrate',
      label: 'Bitrate (MP3 only)',
      type: 'select',
      default: '192',
      choices: [
        { value: '128', label: '128 kbps' },
        { value: '192', label: '192 kbps' },
        { value: '320', label: '320 kbps (highest quality)' },
      ],
    },
    {
      key: 'channels',
      label: 'Channels',
      type: 'select',
      default: 'stereo',
      choices: [
        { value: 'stereo', label: 'Stereo' },
        { value: 'mono', label: 'Mono' },
      ],
    },
    {
      key: 'sampleRate',
      label: 'Sample rate',
      type: 'select',
      default: 'original',
      choices: [
        { value: 'original', label: 'Original (from video)' },
        { value: '44100', label: '44.1 kHz' },
        { value: '48000', label: '48 kHz' },
        { value: '96000', label: '96 kHz' },
      ],
    },
  ],
  examples: [{ title: 'Extract audio as MP3', options: { outputFormat: 'mp3' } }],
  faq: [
    {
      q: 'Which video formats are supported?',
      a: 'Anything the bundled Mediabunny engine can demux — MP4, MOV, WebM, MKV, Ogg, TS and audio-only containers. Files are identified by their contents, not their extension.',
    },
    {
      q: 'What happens to the video stream?',
      a: 'The entire video track is discarded. Only the audio track is kept and saved to the chosen format.',
    },
    {
      q: 'Is my video uploaded anywhere?',
      a: 'No. The file is read directly from your device by this page, and the tool works offline once it has loaded.',
    },
  ],
  related: [  "video-trim",
  "video-info",
  "video-to-gif"],
  credits: [{ name: 'mediabunny', url: 'https://mediabunny.dev', license: 'MPL-2.0' }],
  status: 'beta',
};
