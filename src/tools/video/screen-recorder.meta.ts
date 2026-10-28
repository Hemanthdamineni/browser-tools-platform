import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'screen-recorder',
  name: 'Screen Recorder',
  category: 'video',
  summary:
    'Record your screen or a single window in the browser and download the clip — nothing is uploaded.',
  description:
    'Record straight from your screen: pick the display, window or tab to share, press Record, do your thing, then press Stop and save the clip — with optional microphone commentary. The recording happens in this tab, so nothing ever leaves your device and the page keeps working offline.',
  keywords: [
    'screen',
    'screen recorder',
    'record screen',
    'screencast',
    'capture',
    'display',
    'window',
    'tab',
    'record',
    'recording',
    'video',
    'mediarecorder',
    'getdisplaymedia',
    'clip',
    'webm',
    'mp4',
    'microphone',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'video/*',
  // Recording the screen is a flow the generic file workbench cannot express
  // (a share prompt, a live preview, a record/stop control), so the tool opts
  // into its own panel component (`src/components/panels/`). The options below
  // are the ones that panel drives; they are read by `run()` through
  // `resolveOptions` and keep the tool usable without the UI.
  panel: 'screen-recorder',
  options: [
    {
      key: 'mic',
      label: 'Record microphone audio',
      type: 'boolean',
      default: false,
      help: 'Off by default. When on, the browser asks for microphone permission and the clip carries commentary.',
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
      default: 'screen-recording',
      help: 'The download gets this name plus the date and time of the recording.',
    },
  ],
  faq: [
    {
      q: 'Is my recording uploaded anywhere?',
      a: 'No. The screen feed is read by this tab, encoded by the browser and saved as a file on your device. There is no server involved and no request leaves the page.',
    },
    {
      q: 'What can I share?',
      a: 'The browser decides: Chrome, Edge and Firefox let you pick an entire display, a single window or one browser tab. The picker appears when you press Share screen — what it offers is up to your browser and operating system.',
    },
    {
      q: 'Does it record sound as well?',
      a: 'Your microphone if you turn on “Record microphone audio” (it is off by default). Tab audio is only included when you share a tab and your browser offers to share it — the checkbox in the share picker decides.',
    },
    {
      q: 'Which format will I get?',
      a: 'Whatever your browser records best: Chrome and Firefox record WebM (VP9 or VP8), Safari records MP4 (H.264). The download uses the matching extension, so the file plays where it came from.',
    },
    {
      q: 'Can I record my phone’s screen?',
      a: 'No — screen capture is a desktop-browser feature. On a phone the share prompt never appears; use your operating system’s own screen recorder instead.',
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
  related: [  "webcam-recorder",
  "video-info",
  "video-to-gif"],
  status: 'beta',
};
