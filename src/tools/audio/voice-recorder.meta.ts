import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'voice-recorder',
  name: 'Voice Recorder',
  category: 'audio',
  summary:
    'Record your microphone as WAV or WebM with a live level meter, pause/resume and a take you can play back.',
  description:
    'Open your microphone and record your voice in this tab. Watch a live level meter, pause and resume the take, see the elapsed time, then play the clip back, download it as WAV or WebM, or hand it straight to the audio trim tool. The whole take stays on your device — nothing is uploaded.',
  keywords: [
    'voice',
    'record',
    'recorder',
    'microphone',
    'mic',
    'audio',
    'wav',
    'webm',
    'pause',
    'level meter',
    'voicenote',
    'memo',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'audio/*',
  // The capture flow (mic → level meter → record/pause/stop) cannot be expressed
  // by the generic file workbench, so the tool opts into the voice-recorder panel.
  panel: 'voice-recorder',
  options: [
    {
      key: 'format',
      label: 'Recording format',
      type: 'select',
      default: 'wav',
      choices: [
        { value: 'wav', label: 'WAV (PCM)' },
        { value: 'webm', label: 'WebM (Opus)' },
      ],
    },
  ],
  article: [
    {
      heading: 'How it works',
      body: 'Open the microphone, watch the live level meter, then press Record. Recording happens entirely in this tab with your browser’s own audio APIs: WAV is captured as raw 16-bit PCM, while WebM is encoded with the browser’s Opus recorder. Pause and resume at any point, and the elapsed timer keeps the true length of the take.',
    },
    {
      heading: 'WAV or WebM',
      body: 'WAV is uncompressed 16-bit PCM at your device’s sample rate: larger files, but lossless and understood by every audio editor. WebM/Opus is compressed, so a long interview or memo stays small and plays in any modern browser. Pick WAV when you plan to trim or edit the take, and WebM when you only need to listen or share it.',
    },
    {
      heading: 'If the page closes mid-take',
      body: 'Every second the take so far is checkpointed to this browser’s own storage, so a long recording is never lost all at once. If the page reloads, the last checkpointed take is offered back to you to play or download. When you press Stop the very last chunk is always captured first, so the final moment is never cut off.',
    },
    {
      heading: 'Privacy and limits',
      body: 'Nothing is uploaded: the microphone is read, recorded and encoded on this device, and the file is handed straight to you for playback or download. Recording needs a secure (https) page and your permission, and a long take is held in memory while it is written, so extremely long sessions are bounded by the memory the browser will give a page.',
    },
  ],
  examples: [
    { title: 'Record a voice memo as WAV' },
    { title: 'Record a clip to share as WebM (Opus)' },
    { title: 'Record a long take, then trim it' },
  ],
  faq: [
    {
      q: 'Does the recording leave my device?',
      a: 'No. Your microphone is recorded inside this tab, the take is turned into a WAV or WebM file and handed straight back to you for playback and download. Nothing is uploaded.',
    },
    {
      q: 'What is the difference between WAV and WebM?',
      a: 'WAV is uncompressed 16-bit PCM: larger files, but editable and understood by every audio tool. WebM/Opus is compressed, so a longer take stays small and plays in any modern browser.',
    },
    {
      q: 'What happens if the page closes mid-recording?',
      a: 'Every second the take so far is checkpointed, so a long recording is never lost all at once. The last chunk is always kept when you press Stop.',
    },
  ],
  related: ['audio-trim', 'audio-convert', 'mic-test'],
  status: 'stable',
};