import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'text-to-speech',
  name: 'Text to Speech',
  category: 'audio',
  summary:
    'Read text aloud with your browser’s built-in voices — pick a voice, tune rate, pitch and volume.',
  description:
    'Type or paste text and hear it spoken using the voices already installed in your browser. Choose a voice from the list your browser reports (it is loaded asynchronously, so it can take a moment to appear), then set the speaking rate, pitch and volume. Everything happens on your device — the text never leaves this tab. Browsers cannot save the spoken audio to a file, so there is no download here.',
  keywords: [
    'text to speech',
    'text-to-speech',
    'tts',
    'speech synthesis',
    'read aloud',
    'voice',
    'spoken text',
    'talk',
    'narrate',
    'assistive reading',
    'accessibility',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  panel: 'text-to-speech',
  options: [
    {
      key: 'voice',
      label: 'Voice',
      type: 'text',
      default: '',
      placeholder: 'Browser default',
      help: 'The voice URI — filled in by the panel from the voices your browser offers. Leave blank to use the default voice.',
    },
    {
      key: 'rate',
      label: 'Rate',
      type: 'range',
      default: 1,
      min: 0.1,
      step: 0.1,
      help: 'How fast the text is spoken. 1 is normal, 2 is twice as fast.',
    },
    {
      key: 'pitch',
      label: 'Pitch',
      type: 'range',
      default: 1,
      min: 0,
      step: 0.1,
      help: 'How high or low the voice sounds. 1 is the natural pitch.',
    },
    {
      key: 'volume',
      label: 'Volume',
      type: 'range',
      default: 1,
      min: 0,
      step: 0.1,
      help: 'Loudness, from 0 (silent) to 1 (full).',
    },
  ],
  examples: [
    { title: 'Say hello', input: 'Hello! This text is being read aloud by your browser.' },
    {
      title: 'A short quote',
      input:
        '“The only way to do great work is to love what you do.” If you like what you are doing, you will keep working even when it is difficult.',
    },
    {
      title: 'Slow, deep delivery',
      input: 'This sentence is read slowly and at a lower pitch.',
      options: { rate: 0.6, pitch: 0.8 },
    },
  ],
  related: ['audio-info', 'audio-speed', 'audio-merge'],
  status: 'stable',
};
