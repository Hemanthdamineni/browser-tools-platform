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
  faq: [
    {
      q: 'Is my recording uploaded anywhere?',
      a: 'No. The camera feed is read by this tab, encoded by the browser and saved as a file on your device. There is no server involved and no request leaves the page.',
    },
    {
      q: 'Does it record sound as well?',
      a: 'Only if you turn on “Record microphone audio” (it is off by default). When it is on, the browser asks for microphone permission and the clip carries sound. The audio is recorded by this tab, like the video — it never leaves your device.',
    },
    {
      q: 'Which resolution do I get?',
      a: 'The resolution option is a request, not a command: the browser picks the closest mode your camera actually has. A 720p webcam stays 720p even with 1080p selected; “Auto” uses whatever mode the camera opens with.',
    },
    {
      q: 'Can I choose which camera to use?',
      a: 'Yes, if your device has more than one. Once the camera starts, a picker lists the cameras the browser knows about (after permission, it can show their names). Switching cameras restarts the preview — stop the recording first.',
    },
    {
      q: 'Which format will I get?',
      a: 'Whatever your browser records best: Chrome and Firefox record WebM (VP9 or VP8), Safari records MP4 (H.264). The download uses the matching extension, so the file plays where it came from.',
    },
    {
      q: 'The camera does not start — what now?',
      a: 'Cameras only work on secure pages: open the tool over https:// (or http://localhost). You also have to allow camera access when the browser asks — the padlock in the address bar shows whether it was blocked.',
    },
    {
      q: 'How long can I record?',
      a: 'As long as you like, up to the automatic stop in the options (five minutes by default). Set that to 0 to remove the limit.',
    },
    {
      q: 'Can I check the clip before saving it?',
      a: 'Yes. The recording appears in a player on the page, so you can watch it back and only then download it.',
    },
  ],
  related: ['video-info', 'video-to-gif', 'qr-scanner'],
  status: 'beta',
};
