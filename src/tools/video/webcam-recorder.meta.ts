import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'webcam-recorder',
  name: 'Webcam Recorder',
  category: 'video',
  summary:
    'Record your webcam in the browser and download the clip — the video never leaves your device.',
  description:
    'Record straight from your camera: press Record, do your thing, press Stop, then play the clip back and save it. The recording happens in this tab, so the video never leaves your device and the page keeps working offline.',
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
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'video/*',
  // Recording from the camera is a flow the generic file workbench cannot
  // express (permission, a live preview, a record/stop control), so the tool
  // opts into the dedicated recorder panel. The options below are the ones
  // that panel drives; they are read by `run()` through `resolveOptions` and
  // keep the tool usable without the UI.
  panel: 'recorder',
  options: [
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
      a: 'No — the microphone is not requested at all, so the clip is silent. That keeps the recording private and avoids asking for a second permission.',
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
