import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'voice-recorder',
  name: 'Voice Recorder',
  category: 'audio',
  summary:
    'Record from your microphone and download as WAV or WebM — the audio never leaves your device.',
  description:
    'Record audio from your microphone: press Record, speak, press Stop, then play back the clip and save it. Pick the format (WAV or WebM) and optional filename prefix. The recording happens in this tab, so nothing ever leaves your device and the page keeps working offline.',
  keywords: [
    'voice',
    'record',
    'recording',
    'mic',
    'microphone',
    'audio',
    'wav',
    'webm',
    'mediarecorder',
    'getusermedia',
    'clip',
    'capture',
    'voice recorder',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'audio/*',
  // Recording from the mic is a flow the generic file workbench cannot
  // express (permission, a live preview, a record/stop control), so the tool
  // opts into its own panel component (`src/components/panels/`). The options
  // below are the ones that panel drives; they are read by `run()` through
  // `resolveOptions` and keep the tool usable without the UI.
  panel: 'voice-recorder',
  options: [
    {
      key: 'format',
      label: 'Format',
      type: 'select',
      default: 'wav',
      options: [
        { value: 'wav', label: 'WAV (lossless, 16-bit)' },
        { value: 'webm', label: 'WebM (compressed, Opus/Vorbis)' },
      ],
    },
    {
      key: 'filename',
      label: 'Filename prefix',
      type: 'text',
      default: 'voice-recording',
    },
  ],
  examples: [
    { title: 'Quick voice note', options: { format: 'wav' } },
    { title: 'Short clip', options: { format: 'webm' } },
  ],
  related: [  "audio-trim",
  "audio-to-wav"],
  status: 'beta',
};
