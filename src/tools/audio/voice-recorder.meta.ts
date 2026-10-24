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
  worker: false,
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
  examples: [{ title: 'Record a voice memo' }],
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