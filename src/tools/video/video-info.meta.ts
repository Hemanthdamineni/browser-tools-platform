import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'video-info',
  name: 'Video File Info',
  category: 'video',
  summary: 'Inspect a video: container, duration, resolution, codecs, frame rate and bitrate.',
  description:
    'Read a video file on your device and show its container, duration, resolution, codecs, frame rate and bitrate — plus whether this browser can decode each track. Nothing is uploaded.',
  keywords: [
    'video',
    'info',
    'metadata',
    'inspect',
    'codec',
    'container',
    'mp4',
    'webm',
    'mkv',
    'mov',
    'resolution',
    'duration',
    'frame rate',
    'bitrate',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'video/*,.mp4,.m4v,.mov,.webm,.mkv,.ogv,.ts',
  options: [
    {
      key: 'scanFrames',
      label: 'Estimate frame rate and true bitrate (reads more of the file)',
      type: 'boolean',
      default: false,
    },
    { key: 'readTags', label: 'Read container title/artist tags', type: 'boolean', default: true },
    {
      key: 'checkDecode',
      label: 'Check whether this browser can decode each track',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    { title: 'Inspect a video file', options: {} },
    { title: 'Deep scan for true frame rate', options: { scanFrames: true } },
    { title: 'Skip the decode check', options: { checkDecode: false } },
  ],
  credits: [{ name: 'mediabunny', url: 'https://mediabunny.dev', license: 'MPL-2.0' }],
  status: 'beta',
};
