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
  faq: [
    {
      q: 'Does the camera feed leave my device?',
      a: 'No. The preview is drawn by the browser inside this tab, the snapshot is rasterised on your machine and the report is built here as well. Nothing is uploaded, recorded or stored, and the page makes no network requests once it has loaded.',
    },
    {
      q: 'Why are the camera names missing?',
      a: 'Browsers only reveal device names after the user grants camera permission. Until then the picker shows “Camera 1”, “Camera 2” and so on, and the names appear as soon as you allow access.',
    },
    {
      q: 'Why does the frame rate differ from what the camera claims?',
      a: 'The claimed rate comes from the video track settings, while the measured rate is counted from the frames the browser actually delivered. When they disagree by more than 2 fps, the report says so — the machine, the browser or the USB link is dropping frames.',
    },
    {
      q: 'Is the snapshot stored anywhere?',
      a: 'No. The frame is drawn into a canvas in this tab and handed straight back to you as a PNG download. It is never uploaded and never kept by the site.',
    },
    {
      q: 'Why does the preview stay black?',
      a: 'A black preview usually means the camera is already in use by another app or tab, or that the page is not served over https:// — browsers only hand out cameras on secure pages. The panel tells you which of the two it is when it happens.',
    },
  ],
  related: ['qr-scanner', 'video-info', 'image-metadata', 'audio-info'],
  status: 'beta',
  updated: '2026-10-22',
};
