import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'screen-recorder',
  name: 'Screen Recorder',
  category: 'video',
  summary:
    'Record your screen with an optional microphone and save it as WebM — or MP4 where the browser can record it.',
  description:
    'Share a screen or a window, switch the microphone on, and record it right here in the tab. Your browser writes the file, it stays on your device and you download it as WebM — or MP4 when the browser can actually record that format.',
  keywords: [
    'screen',
    'record',
    'recorder',
    'screen capture',
    'webm',
    'mp4',
    'microphone',
    'mic',
    'presentation',
    'demo',
    'tutorial',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'video/webm,video/mp4',
  // The capture flow (share → mic → record → stop) cannot be expressed by the
  // generic file workbench, so the tool opts into the screen-recorder panel.
  // The options below are what that panel drives; `run()` reads them through
  // `resolveOptions` and keeps the tool usable without the panel.
  panel: 'screen-recorder',
  options: [
    {
      key: 'format',
      label: 'Recording format',
      type: 'select',
      default: 'webm',
      choices: [
        { value: 'webm', label: 'WebM' },
        { value: 'mp4', label: 'MP4 (H.264)' },
      ],
    },
    {
      key: 'duration',
      label: 'Recording length (seconds)',
      type: 'number',
      default: 0,
      min: 0,
      max: 86400,
    },
    {
      key: 'microphone',
      label: 'Microphone was included in the recording',
      type: 'boolean',
      default: false,
    },
    {
      // Filled in by the recorder panel with the MIME type MediaRecorder
      // actually wrote. Declared so the contract is explicit — the tool falls
      // back to the file type and the file name when it is empty.
      key: 'mimeType',
      label: 'Recorded MIME type',
      type: 'text',
      default: '',
    },
    {
      key: 'videoBitsPerSecond',
      label: 'Video quality',
      type: 'select',
      default: '5000000',
      choices: [
        { value: '2500000', label: '2.5 Mbps — small file' },
        { value: '5000000', label: '5 Mbps — balanced' },
        { value: '8000000', label: '8 Mbps — sharp' },
      ],
    },
  ],
  examples: [
    { title: 'Record my screen' },
    { title: 'Sharp 8 Mbps recording', options: { videoBitsPerSecond: '8000000' } },
    { title: 'Record with the microphone', options: { microphone: true } },
  ],
  related: ['video-info', 'video-to-gif'],
  status: 'beta',
};
