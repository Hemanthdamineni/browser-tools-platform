import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'webcam-test',
  name: 'Webcam Test',
  category: 'device',
  summary: 'Preview a camera, read its live resolution and frame rate, and save a PNG snapshot.',
  description:
    'Check a webcam before a call or a recording. Pick which camera to use, watch the live preview, see the real resolution, aspect ratio and measured frame rate of the stream, then take a snapshot you can download. Everything happens in this tab.',
  keywords: [
    'webcam test',
    'camera test',
    'test my camera',
    'webcam check',
    'camera resolution',
    'fps test',
    'framerate',
    'webcam snapshot',
    'device picker',
    'camera preview',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'image/*',
  // The flow (choose a camera → live preview → live readout → snapshot) needs a
  // video element the generic option form cannot express, so this tool opts into
  // its own panel. The option below is what that panel hands to `run()`; it is
  // declared so the contract is explicit and `run()` stays usable on its own.
  panel: 'webcam-test',
  options: [
    {
      key: 'capture',
      label: 'Camera readings (JSON)',
      type: 'textarea',
      default: '',
      help: 'Filled in by the camera panel: the active device, its track settings, the measured frame rate and the cameras it found.',
    },
  ],
  related: ['qr-scanner', 'barcode', 'image-metadata'],
  status: 'beta',
  updated: '2026-10-24',
};
