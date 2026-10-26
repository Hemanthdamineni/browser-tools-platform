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
  faq: [
    {
      q: 'Is my camera feed uploaded anywhere?',
      a: 'No. The preview is a live video element fed by your browser, the frame rate is counted from frames drawn in this tab, and the snapshot is encoded with a canvas here. Nothing is recorded, stored or sent over the network. The only thing the page downloads is its own JavaScript, served from this site.',
    },
    {
      q: 'Why does the measured frame rate differ from the camera spec?',
      a: 'A camera often advertises 30 fps but delivers fewer frames in dim light, or more than the display can show. The measured number counts the frames the browser actually presented during the sampling window, which is what you would see in a recording. Some browsers cannot report frames from the video at all; there the rate is sampled from the display refresh loop and is an approximation.',
    },
    {
      q: 'Why are my camera names hidden?',
      a: 'Browsers only reveal device names after you allow camera access at least once. Press Start camera to grant it, and the picker and the report will show the real names.',
    },
    {
      q: 'What happens to the snapshot?',
      a: 'It is drawn from the current frame into a PNG and offered as a download next to the report. The file is created in this tab and only leaves it if you save it.',
    },
    {
      q: 'The camera does not start — what should I check?',
      a: 'Camera access needs an https:// page (or localhost) and your permission. If another tab or app is already using the camera, close it and try again. The panel explains the exact reason for every blocker, including denied permission and a camera that is already in use.',
    },
  ],
  related: ['qr-scanner', 'barcode', 'image-metadata'],
  status: 'beta',
  updated: '2026-10-24',
};
