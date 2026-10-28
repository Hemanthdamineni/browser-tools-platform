import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'text-to-speech',
  name: 'Text-to-Speech',
  category: 'audio',
  summary:
    'Convert text to speech using the browser Web Speech API with voice, rate and pitch controls.',
  description:
    'Read your text aloud using the browser’s Web Speech Synthesis API. Pick a voice, adjust speaking rate and pitch, and control playback with play/pause/stop. Live preview works with any text. All on-device.',
  keywords: [
    'text-to-speech',
    'tts',
    'speech',
    'voice',
    'read aloud',
    'speech synthesis',
    'web speech',
    'voice synthesizer',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  panel: 'text-to-speech',
  options: [
    {
      key: 'voice',
      label: 'Voice',
      type: 'select',
      default: '',
      choices: [],
    },
    {
      key: 'rate',
      label: 'Rate',
      type: 'number',
      default: 1,
      min: 0.1,
      max: 10,
      step: 0.1,
    },
    {
      key: 'pitch',
      label: 'Pitch',
      type: 'number',
      default: 1,
      min: 0.1,
      max: 2,
      step: 0.1,
    },
  ],
  examples: [
    {
      title: 'Read a paragraph',
      input: 'The quick brown fox jumps over the lazy dog.',
    },
    {
      title: 'Make a greeting',
      input: 'Hello, this is a test of the text-to-speech feature.',
    },
  ],
  faq: [
    {
      q: 'Which voices are available?',
      a: 'Depends on your browser and system. Chrome on desktop usually offers many voices; mobile supports fewer.',
    },
    {
      q: 'Can I control the speaking rate and pitch?',
      a: 'Yes — the controls let you slow down or speed up, and raise or lower the voice tone.',
    },
    {
      q: 'What happens if the browser doesn’t support it?',
      a: 'The tool gracefully falls back to a helpful message; speechSynthesis is available in all modern browsers.',
    },
  ],
  related: [  "speech-to-text",
  "audio-info"],
  status: 'beta',
};
