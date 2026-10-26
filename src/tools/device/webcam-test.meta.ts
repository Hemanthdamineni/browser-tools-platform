import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'webcam-test',
  name: 'Webcam Test',
  category: 'device',
  summary:
    'Pick a camera, watch a live preview, read the real resolution and frame rate, and take a snapshot.',
  description:
    'Open your camera in the browser and check it properly: choose between the cameras your device exposes, watch a live preview, and read the resolution and frame rate the browser actually delivers — not the ones that were requested. Snapshots are drawn in this tab and downloaded as PNGs. No frame is ever recorded, uploaded or stored.',
  keywords: [
    'webcam',
    'webcam test',
    'camera test',
    'camera',
    'webcam preview',
    'live preview',
    'resolution',
    'frame rate',
    'fps',
    'snapshot',
    'getUserMedia',
    'video call',
    'mirror check',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  panel: 'webcam-test',
  options: [
    {
      key: 'resolution',
      label: 'Requested resolution',
      type: 'select',
      default: 'auto',
      choices: [
        { value: 'auto', label: 'Browser default' },
        { value: '640', label: '640 × 360' },
        { value: '1280', label: '1280 × 720' },
        { value: '1920', label: '1920 × 1080' },
      ],
      help: 'A request, not a promise — the report always shows what the camera really delivered.',
    },
    {
      key: 'includeSettings',
      label: 'Include the raw track settings in the report',
      type: 'boolean',
      default: true,
      help: 'Adds the values the browser reports for the video track, as-is.',
    },
  ],
  examples: [
    { title: 'Test the default camera' },
    {
      title: 'Force 1080p and keep the raw settings',
      options: { resolution: '1920', includeSettings: true },
    },
    { title: 'Quick 360p preview', options: { resolution: '640', includeSettings: false } },
  ],
  related: ['qr-scanner', 'video-info', 'image-metadata', 'audio-info'],
  status: 'beta',
  updated: '2026-10-22',
};
