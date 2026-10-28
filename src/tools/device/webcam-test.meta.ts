import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'webcam-test',
  name: 'Webcam Tester',
  category: 'device',
  summary:
    'Pick a camera, test resolution/frame rate, take a snapshot — nothing leaves your device.',
  description:
    'Pick a camera from your device, choose a resolution and frame rate, and the page will request the stream, read back the exact width/height/framerate the browser is receiving, and let you capture a single frame as a PNG. Everything happens in this tab; no data ever leaves your computer.',
  keywords: [
    'webcam',
    'camera',
    'device',
    'picker',
    'resolution',
    'fps',
    'framerate',
    'snapshot',
    'capture',
    'test',
    'getUserMedia',
    'mediaDevices',
    'deviceId',
    'picture',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  panel: 'webcam-test',
  options: [
    {
      key: 'deviceId',
      label: 'Camera',
      type: 'select',
      default: '',
      choices: [],
      help: 'Choose which camera to test. If none are listed, your device does not support camera access.',
    },
    {
      key: 'resolution',
      label: 'Resolution',
      type: 'select',
      default: '',
      choices: [],
      help: 'The resolution to request. The page will read back the actual values the browser accepted.',
    },
    {
      key: 'fps',
      label: 'Frame rate',
      type: 'select',
      default: '',
      choices: [],
      help: 'The frame rate to request. The page will read back the actual values the browser accepted.',
    },
  ],
  faq: [
    {
      q: 'Why does the resolution and FPS show as 0?',
      a: 'The browser may not report the exact values you asked for. It reports the closest mode it has. Check the actual values in the readout.',
    },
    {
      q: 'Does this page record anything?',
      a: 'No. The test only requests the stream, reads the track settings, and then stops the stream. Nothing is stored or sent.',
    },
    {
      q: 'Can I take a snapshot?',
      a: 'Yes. The snapshot button captures the current frame as a PNG. It is saved in your browser and can be downloaded.',
    },
    {
      q: 'What if my camera is already in use?',
      a: 'The browser will ask for permission. If another tab or app is using the camera, the request will fail.',
    },
  ],
  related: [  "webcam-recorder",
  "keyboard-tester"],
  status: 'beta',
};
