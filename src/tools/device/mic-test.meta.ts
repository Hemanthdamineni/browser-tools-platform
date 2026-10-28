import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'mic-test',
  name: 'Microphone Tester',
  category: 'device',
  summary: 'Live level meter and waveform from your microphone, record and playback.',
  description:
    'A real-time microphone tester with oscilloscope-style waveform and level meter (dB). Press Record to capture, Stop to end recording, then play back the clip. Everything happens in this tab — nothing ever leaves your device.',
  keywords: [
    'microphone',
    'mic',
    'microphone tester',
    'level meter',
    'waveform',
    'oscilloscope',
    'analyser',
    'record',
    'playback',
    'getUserMedia',
    'MediaRecorder',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  panel: 'mic-test',
  options: [
    {
      key: 'defaultDuration',
      label: 'Default recording duration (seconds)',
      type: 'number',
      default: 5,
      min: 1,
      max: 30,
      help: 'How long to record when you press Record (used when no manual stop).',
    },
  ],
  examples: [
    { title: 'Quick test', options: { defaultDuration: 3 } },
    { title: 'Voice note', options: {} },
  ],
  related: [  "voice-recorder",
  "webcam-recorder",
  "keyboard-tester"],
  status: 'beta',
};
