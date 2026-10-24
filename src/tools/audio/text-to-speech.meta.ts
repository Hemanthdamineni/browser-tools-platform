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
      max: 10,
      step: 0.1,
      help: 'How fast the text is spoken. 1 is normal, 2 is twice as fast.',
    },
    {
      key: 'pitch',
      label: 'Pitch',
      type: 'range',
      default: 1,
      min: 0,
      max: 2,
      step: 0.1,
      help: 'How high or low the voice sounds. 1 is the natural pitch.',
    },
    {
      key: 'volume',
      label: 'Volume',
      type: 'range',
      default: 1,
      min: 0,
      max: 1,
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
  ],
  faq: [
    {
      q: 'Can I download the spoken audio as a file?',
      a: 'No, and the button is deliberately missing rather than broken. The Web Speech API plays its output through your speakers and offers no way to capture the audio as a file. Recording the tab’s audio with MediaRecorder cannot reliably capture the synthesized voice, so shipping a download would quietly produce nothing on most browsers. If you need an audio file, generate one on a machine that has command-line speech tools and upload the result here instead.',
    },
    {
      q: 'Why is my preferred voice missing?',
      a: 'The voice list comes from `speechSynthesis.getVoices()`, which is asynchronous — it can return an empty list until the browser’s engine is ready, so the panel also listens for the “voiceschanged” event and refills the list when the voices arrive. If a voice still does not appear, your browser may not have one installed for that language; Chromium and Firefox generally expose the voices your operating system ships.',
    },
    {
      q: 'Is there a length limit?',
      a: 'The text is trimmed to 5,000 characters before it is spoken, and a notice appears if that happens. That keeps very long documents from stalling the engine; split longer text into a few paragraphs and read them one at a time.',
    },
    {
      q: 'Does the text leave my device?',
      a: 'No. The speech is produced by the browser’s local voice engine in this tab. Nothing is recorded, stored or sent anywhere, and the page works fully offline once loaded.',
    },
  ],
  related: ['audio-info', 'audio-speed', 'audio-merge'],
  status: 'stable',
};
