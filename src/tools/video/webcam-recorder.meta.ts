import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'webcam-recorder',
  name: 'Webcam Recorder',
  category: 'video',
  summary:
    'Record your webcam in the browser and download the clip — the video never leaves your device.',
  description:
    'Record straight from your camera: press Record, do your thing, press Stop, then play the clip back and save it. Pick the resolution, the camera and (optionally) the microphone. The recording happens in this tab, so nothing ever leaves your device and the page keeps working offline.',
  keywords: [
    'webcam',
    'camera',
    'record',
    'recording',
    'video',
    'webcam recorder',
    'selfie',
    'mediarecorder',
    'getusermedia',
    'clip',
    'capture',
    'webm',
    'mp4',
    'microphone',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'video/*',
  // Recording from the camera is a flow the generic file workbench cannot
  // express (permission, a live preview, a record/stop control), so the tool
  // opts into its own panel component (`src/components/panels/`). The options
  // below are the ones that panel drives; they are read by `run()` through
  // `resolveOptions` and keep the tool usable without the UI.
  panel: 'webcam-recorder',
  options: [
    {
      key: 'resolution',
      label: 'Resolution',
      type: 'select',
      default: '720',
      choices: [
        { value: '1080', label: '1080p — Full HD' },
        { value: '720', label: '720p — HD' },
        { value: '480', label: '480p — small file' },
        { value: 'auto', label: 'Auto — camera default' },
      ],
      help: 'A wish, not a demand: the camera records at the closest mode it actually has.',
    },
    {
      key: 'mic',
      label: 'Record microphone audio',
      type: 'boolean',
      default: false,
      help: 'Off by default. When on, the browser asks for microphone permission and the clip carries sound.',
    },
    {
      key: 'quality',
      label: 'Recording quality',
      type: 'select',
      default: 'balanced',
      choices: [
        { value: 'small', label: 'Small file — 1 Mbit/s' },
        { value: 'balanced', label: 'Balanced — 2.5 Mbit/s' },
        { value: 'high', label: 'Best quality — 6 Mbit/s' },
      ],
      help: 'The target bitrate of the recording. A higher quality means a bigger file.',
    },
    {
      key: 'maxSeconds',
      label: 'Stop automatically after (seconds)',
      type: 'number',
      default: 300,
      min: 0,
      max: 3600,
      step: 5,
      help: 'Safety stop for long recordings. 0 means no limit.',
    },
    {
      key: 'filename',
      label: 'File name',
      type: 'text',
      default: 'webcam-recording',
      help: 'The download gets this name plus the date and time of the recording.',
    },
  ],
  examples: [
    {
      title: 'Full HD with microphone',
      options: { resolution: '1080', mic: true, quality: 'high' },
    },
    {
      title: 'Short silent clip',
      options: { resolution: '480', quality: 'small', mic: false, maxSeconds: 30 },
    },
    {
      title: 'Camera default for two minutes',
      options: { resolution: 'auto', quality: 'balanced', maxSeconds: 120 },
    },
  ],
  related: ['video-info', 'video-to-gif', 'qr-scanner'],
  status: 'beta',
};
