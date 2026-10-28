import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'speech-to-text',
  name: 'Speech-to-Text',
  category: 'audio',
  summary:
    'Transcribe speech from file or mic using Whisper — with timestamps, TXT/SRT/VTT exports, all on-device.',
  description:
    'Record from your microphone or upload an audio file and transcribe it locally with OpenAI Whisper tiny or base models. Get word-level timestamps, export as plain TXT, SRT (for video players) or VTT. No data ever leaves your device.',
  keywords: [
    'speech-to-text',
    'transcribe',
    'whisper',
    'stt',
    'microphone',
    'audio',
    'tiny',
    'base',
    'timestamps',
    'srt',
    'vtt',
    'txt',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'audio/*,.mp3,.wav,.ogg',
  panel: 'speech-to-text',
  options: [
    {
      key: 'model',
      label: 'Model size',
      type: 'select',
      default: 'tiny',
      choices: [
        { value: 'tiny', label: 'Tiny (smaller, faster)' },
        { value: 'base', label: 'Base (better accuracy)' },
      ],
    },
    {
      key: 'timestamps',
      label: 'Word-level timestamps',
      type: 'boolean',
      default: true,
    },
    {
      key: 'language',
      label: 'Language',
      type: 'text',
      default: '',
      placeholder: 'auto (detect)',
    },
  ],
  examples: [
    {
      title: 'Transcribe a podcast clip',
      description: 'Upload a short audio file and get timed transcription.',
    },
    {
      title: 'Live mic transcription',
      description: 'Record from your microphone in real time.',
    },
  ],
  faq: [
    {
      q: 'Which Whisper models are supported?',
      a: 'Whisper tiny (recommended for speed) and base (more accurate). Both run entirely in the browser via Transformers.js.',
    },
    {
      q: 'How accurate is it?',
      a: 'Whisper tiny is surprisingly good for its size; base is noticeably better. It works best on clear English speech and can detect other languages automatically.',
    },
    {
      q: 'Do I need to grant microphone permission?',
      a: 'Yes for live mic input. For file input, only the file itself is used.',
    },
  ],
  related: [  "audio-info",
  "webcam-recorder",
  "id3-tag-reader"],
  status: 'beta',
};
