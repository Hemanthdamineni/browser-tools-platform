import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'video-trim',
  name: 'Trim Video',
  category: 'video',
  summary:
    'Cut a video to a start and end time — stream copy when the container allows it, re-encode when it does not.',
  description:
    'Trim a video clip to the range you pick in the preview. The encoded packets are copied untouched whenever the container and codec allow it, so the cut stays lossless; otherwise the clip is re-encoded. Everything happens in your browser — nothing is uploaded.',
  keywords: [
    'video',
    'trim',
    'cut',
    'clip',
    'split',
    'stream copy',
    'lossless',
    'keyframe',
    'mp4',
    'webm',
    'mkv',
    'mov',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'video/*,.mp4,.m4v,.mov,.webm,.mkv,.ogv,.ts',
  panel: 'video-trim',
  options: [
    {
      key: 'start',
      label: 'Start time',
      type: 'text',
      default: '',
      placeholder: '0:00, 1:30, 00:00:05 …',
      help: 'Where the clip starts. Use SS, M:SS or H:MM:SS. Empty means the beginning of the clip.',
    },
    {
      key: 'end',
      label: 'End time',
      type: 'text',
      default: '',
      placeholder: 'e.g. 0:45',
      help: 'Where the clip ends. Use SS, M:SS or H:MM:SS. Empty means the end of the clip.',
    },
    {
      key: 'format',
      label: 'Output container',
      type: 'select',
      default: 'source',
      choices: [
        { value: 'source', label: 'Same as the source (fastest)' },
        { value: 'mp4', label: 'MP4' },
        { value: 'webm', label: 'WebM' },
        { value: 'mkv', label: 'Matroska (MKV)' },
      ],
      help: 'Keeping the source container copies the encoded packets, so the cut is lossless.',
    },
    {
      key: 'copyMode',
      label: 'How to cut',
      type: 'select',
      default: 'preferred',
      choices: [
        { value: 'preferred', label: 'Copy when possible (recommended)' },
        { value: 'forced', label: 'Copy only — drop what cannot be copied' },
        { value: 'never', label: 'Always re-encode' },
      ],
      help: 'A stream copy can only cut on a key frame, so the result may start a little early.',
    },
    {
      key: 'keepAudio',
      label: 'Keep the audio track',
      type: 'boolean',
      default: true,
      help: 'Turn this off to cut the picture only.',
    },
  ],
  faq: [
    {
      q: 'What is a stream copy?',
      a: 'The video is stored as a stream of already-encoded packets. Cutting it means picking the packets that belong to the range you want and writing them into a new file — the picture is never decoded and encoded again, so nothing is lost.',
    },
    {
      q: 'Why is my cut not exactly where I asked?',
      a: 'A stream copy can only start on a key frame, so the clip usually begins at the key frame just before your in point and ends at the key frame just after your out point. Choose “Always re-encode” if you need the cut to the exact frame.',
    },
    {
      q: 'When does the tool re-encode instead?',
      a: 'When the chosen container cannot hold the codec of the source — an H.264 clip does not fit into a WebM file without being re-encoded — or when the cut does not land on a key frame and the timeline has to be rebuilt.',
    },
    {
      q: 'Which videos are supported?',
      a: 'Anything the bundled engine can read: MP4, QuickTime (MOV), WebM, Matroska (MKV), MPEG-TS, Ogg and WAV. Files are recognised by their contents, not their extension.',
    },
    {
      q: 'Is my video uploaded anywhere?',
      a: 'No. The clip is demuxed, copied or re-encoded inside your browser tab. The page works offline once it has loaded.',
    },
  ],
  credits: [{ name: 'mediabunny', url: 'https://mediabunny.dev', license: 'MPL-2.0' }],
  related: ['video-info', 'video-to-gif', 'audio-trim'],
  status: 'beta',
};
