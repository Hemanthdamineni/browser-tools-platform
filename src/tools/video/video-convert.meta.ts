import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'video-convert',
  name: 'Convert Video',
  category: 'video',
  summary:
    'Convert a video between MP4, WebM, MOV and MKV — remuxing the encoded packets when possible, re-encoding when not.',
  description:
    'Convert a video between containers. When the chosen container can hold the codecs of the source, the encoded packets are remuxed untouched — fast and lossless; otherwise the video is re-encoded. Everything happens in your browser — nothing is uploaded.',
  keywords: [
    'video',
    'convert',
    'remux',
    'transcode',
    're-encode',
    'container',
    'mp4',
    'webm',
    'mov',
    'mkv',
    'quicktime',
    'matroska',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'video/*,.mp4,.m4v,.mov,.webm,.mkv,.ogv,.ts',
  options: [
    {
      key: 'format',
      label: 'Output container',
      type: 'select',
      default: 'source',
      choices: [
        { value: 'source', label: 'Same as the source (fastest)' },
        { value: 'mp4', label: 'MP4' },
        { value: 'webm', label: 'WebM' },
        { value: 'mov', label: 'QuickTime (MOV)' },
        { value: 'mkv', label: 'Matroska (MKV)' },
      ],
      help: 'Keeping the source container remuxes the encoded packets, so the conversion is lossless.',
    },
    {
      key: 'copyMode',
      label: 'How to convert',
      type: 'select',
      default: 'preferred',
      choices: [
        { value: 'preferred', label: 'Remux when possible (recommended)' },
        { value: 'forced', label: 'Remux only — drop what cannot be remuxed' },
        { value: 'never', label: 'Always re-encode' },
      ],
      help: 'A remux never decodes the video, so it takes seconds and loses no quality.',
    },
    {
      key: 'keepAudio',
      label: 'Keep the audio track',
      type: 'boolean',
      default: true,
      help: 'Turn this off to convert the picture only.',
    },
  ],
  faq: [
    {
      q: 'What is a remux?',
      a: 'The video is stored as a stream of already-encoded packets wrapped in a container. Remuxing means rewriting those packets into a different container without decoding them — the picture is never touched, so the result is lossless and the conversion takes seconds.',
    },
    {
      q: 'When does the tool re-encode instead?',
      a: 'When the chosen container cannot hold the codec of the source — an H.264 clip does not fit into a WebM file without being re-encoded to VP9 or similar. In that case the video is decoded and encoded again, which is slower and not bit-identical.',
    },
    {
      q: 'Which containers can I convert to?',
      a: 'MP4, QuickTime (MOV), WebM and Matroska (MKV). “Same as the source” keeps the container of the input file, which almost always means a pure remux.',
    },
    {
      q: 'Which videos are supported?',
      a: 'Anything the bundled engine can read: MP4, QuickTime (MOV), WebM, Matroska (MKV), MPEG-TS, Ogg and WAV. Files are recognised by their contents, not their extension.',
    },
    {
      q: 'Is my video uploaded anywhere?',
      a: 'No. The file is demuxed, remuxed or re-encoded inside your browser tab. The page works offline once it has loaded.',
    },
  ],
  credits: [{ name: 'mediabunny', url: 'https://mediabunny.dev', license: 'MPL-2.0' }],
  related: [  "video-info",
  "video-trim",
  "video-compress"],
  status: 'beta',
};
