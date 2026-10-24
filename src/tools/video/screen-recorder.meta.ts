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
  article: [
    {
      heading: 'Recording the screen from the tab',
      body: "The panel drives the capture: you choose a screen, window or tab through the browser's own picker, optionally switch the microphone on, and start. When you stop, the recorded file is validated and handed back for download, and the report lists its name, size, container, duration, bitrate and whether a microphone track was included.",
    },
    {
      heading: 'Demos, repro steps and walkthroughs',
      body: 'Use it to record a bug reproduction for a ticket, a short walkthrough for a colleague, or a demo of a UI you cannot install software on. Because capture happens in the browser, it also works on a locked-down machine.',
    },
    {
      heading: 'Options the panel sets',
      body: 'Recording format offers WebM and, only where the browser can record it, MP4. Video quality chooses 2.5, 5 or 8 Mbps. Microphone was included in the recording records whether the audio track is a microphone. Recording length and Recorded MIME type are filled in as the recording stops; when missing, the tool falls back to the file type and name.',
    },
    {
      heading: 'Caveats',
      body: "WebM is the format browsers reliably write; if MP4 was requested but not supported, the file is a WebM and a warning says so. An unidentifiable or empty file is flagged, and recordings past the size cap are rejected. Screen sharing needs a secure https page and the browser's permission, and ending the share stops the recording.",
    },
    {
      heading: 'Captured and kept on your device',
      body: "Your browser records the screen inside this tab and hands the file straight back to you; nothing is uploaded and no server sees the video. What gets captured is mediated by the browser's own share picker.",
    },
  ],
  examples: [
    { title: 'Record my screen' },
    { title: 'Sharp 8 Mbps recording', options: { videoBitsPerSecond: '8000000' } },
    { title: 'Record with the microphone', options: { microphone: true } },
  ],
  faq: [
    {
      q: 'Does the recording leave my device?',
      a: 'No. Your browser records the screen inside this tab and the file is handed straight back to you for download. Nothing is uploaded.',
    },
    {
      q: 'Which format do I get?',
      a: 'WebM by default. MP4 is only offered when the browser reports that it can record MP4 — the panel hides the option otherwise, so you are never handed a file in a format your browser could not write.',
    },
    {
      q: 'Can I record my microphone too?',
      a: 'Yes. Switch the microphone on before you start recording and your voice is recorded with the screen. When the microphone is on it replaces the system audio, so the file never carries two competing audio tracks.',
    },
    {
      q: 'Why does the browser ask which screen to share?',
      a: 'That picker is the browser’s own privacy control: you choose exactly what is captured, and you can end the share at any time from the browser’s bar. Recording stops with it.',
    },
    {
      q: 'Which browsers work?',
      a: 'Any recent Chrome, Edge, Firefox or Safari on a secure (https) page. Screen sharing needs `getDisplayMedia`; without it the panel says so instead of failing.',
    },
  ],
  related: ['video-info', 'video-to-gif'],
  status: 'beta',
};
