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
  article: [
    {
      heading: 'What the panel shows you',
      body: 'Granting camera access opens a live preview and a picker of the cameras your device exposes, named "Camera 1", "Camera 2" and so on until permission is given and the real names appear. The report lists the resolution and frame rate the browser is actually delivering, so a requested 1280x720 that the sensor or driver refuses shows as the delivered value.',
    },
    {
      heading: 'How to run a proper check',
      body: 'Pick the camera you care about, set a requested resolution or leave the browser default, and watch the preview for dropped frames, colour casts and focus. The measured frame rate is counted from frames the browser really delivered, so a slow machine, browser or USB link shows a low number instead of the claimed spec. Take a snapshot to confirm exposure on a real subject.',
    },
    {
      heading: 'The requested resolution is a hint',
      body: 'The resolution option sends a getUserMedia constraint, but the browser and driver negotiate the final size. Enable the raw track settings to see the unmodified values the browser reports for the video track, which is how you compare what you asked for against what the camera really runs at.',
    },
    {
      heading: 'Black previews, and what is never recorded',
      body: 'A black preview usually means another app or tab already owns the camera, or the page is not served over https, and the panel says which. The preview is drawn by the browser, snapshots are rasterised on a canvas and handed to you as PNG downloads, and no frame is ever recorded, uploaded or stored.',
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
