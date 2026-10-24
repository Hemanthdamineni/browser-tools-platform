import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'speech-to-text',
  name: 'Transcribe Speech to Text',
  category: 'audio',
  summary:
    'Transcribe speech from an audio file or the microphone, on-device, and export TXT, SRT or VTT subtitles.',
  description:
    'Drop in a recording or capture one from the microphone, and Whisper transcribes it with a timestamp for every phrase. Export plain text, an SRT subtitle file or a WebVTT file — all on your device.',
  keywords: [
    'speech',
    'transcribe',
    'transcription',
    'whisper',
    'subtitles',
    'captions',
    'srt',
    'vtt',
    'audio',
    'asr',
  ],
  privacy: { processing: 'on-device', network: ['huggingface.co'], offline: false },
  input: 'file',
  accept: 'audio/*',
  panel: 'speech-to-text',
  worker: false,
  options: [
    {
      key: 'model',
      label: 'Model',
      type: 'select',
      default: 'tiny.en',
      choices: [
        { value: 'tiny.en', label: 'Whisper tiny — English only, fast, small' },
        { value: 'base', label: 'Whisper base — multilingual, more accurate, larger' },
      ],
      help: 'Tiny is quick and light but English-only. Base understands many languages and is more accurate, at a larger download.',
    },
    {
      key: 'language',
      label: 'Language',
      type: 'select',
      default: 'auto',
      choices: [
        { value: 'auto', label: 'Auto-detect' },
        { value: 'en', label: 'English' },
        { value: 'es', label: 'Spanish' },
        { value: 'fr', label: 'French' },
        { value: 'de', label: 'German' },
        { value: 'it', label: 'Italian' },
        { value: 'pt', label: 'Portuguese' },
        { value: 'nl', label: 'Dutch' },
        { value: 'ru', label: 'Russian' },
        { value: 'uk', label: 'Ukrainian' },
        { value: 'ja', label: 'Japanese' },
        { value: 'zh', label: 'Chinese' },
        { value: 'ko', label: 'Korean' },
        { value: 'ar', label: 'Arabic' },
        { value: 'hi', label: 'Hindi' },
        { value: 'tr', label: 'Turkish' },
        { value: 'pl', label: 'Polish' },
        { value: 'sv', label: 'Swedish' },
      ],
      showWhen: { key: 'model', value: 'base' },
      help: 'A hint improves accuracy when the language is known. The tiny.en model is English-only and ignores this.',
    },
  ],
  examples: [
    { title: 'English with the fast tiny model', options: { model: 'tiny.en' } },
    { title: 'Multilingual, auto-detect', options: { model: 'base', language: 'auto' } },
    { title: 'English with the accurate base model', options: { model: 'base', language: 'en' } },
    { title: 'French audio', options: { model: 'base', language: 'fr' } },
  ],
  faq: [
    {
      q: 'Does my audio get uploaded?',
      a: 'No. Whisper runs entirely in your browser. The only download is the model weights from the Hugging Face Hub the first time you use the tool; after that they are cached.',
    },
    {
      q: 'Which model should I pick?',
      a: 'Whisper tiny is the smallest option — a fast, light download that handles English well. Whisper base is larger (roughly twice the size) and noticeably more accurate, and it understands many languages. Start with tiny for a quick check, then base when you need better results. The exact download size is shown while the model loads.',
    },
    {
      q: 'How long can a recording be?',
      a: 'Up to 10 minutes, and files up to 64 MB. Long or heavy clips are rejected before any work starts.',
    },
    {
      q: 'What are SRT and VTT?',
      a: 'Both are subtitle formats that pair each line of text with a start and end time. SRT uses HH:MM:SS,mmm and VTT uses HH:MM:SS.mmm; VTT also carries a WEBVTT header. TXT is just the spoken text with no timings.',
    },
  ],
  article: [
    {
      heading: 'How the transcription works',
      body: 'Whisper is a speech-recognition model from OpenAI that runs entirely in your browser through the shared ML loader. The audio is decoded to raw samples, resampled to the 16 kHz mono format Whisper expects, and fed to the model in short chunks. Each chunk returns a recognised phrase with a start and end time, which the panel aligns and merges into a single timeline. The only network traffic is the model weights, fetched once from the Hugging Face Hub and cached for later runs.',
    },
    {
      heading: 'Choosing a model and language',
      body: 'Whisper tiny is the smallest option: a fast, light download that handles English speech well. Whisper base is larger and more accurate, and it understands dozens of languages. When you pick base you can also hint at the source language — auto-detect works, but naming the language improves accuracy. Tiny is English-only, so the language picker hides and the panel says so.',
    },
    {
      heading: 'Exporting subtitles',
      body: 'Every run produces three downloads. TXT is just the spoken words, one line per recognised segment. SRT and VTT are subtitle files that pair each line with a timestamp; SRT uses HH:MM:SS,mmm and VTT uses HH:MM:SS.mmm. They open directly in video editors, media players and most caption tools.',
    },
    {
      heading: 'Privacy and limits',
      body: 'Your recording never leaves the device — Whisper runs locally. The tool enforces a 10-minute or 64 MB cap before any heavy work starts, so you cannot accidentally queue an hour-long podcast. Everything is processed in your own tab.',
    },
  ],
  related: ['audio-info', 'audio-trim', 'audio-to-wav'],
  credits: [
    {
      name: 'Whisper (OpenAI) via Xenova/whisper-tiny.en & Xenova/whisper-base',
      url: 'https://huggingface.co/Xenova/whisper-base',
      license: 'Apache-2.0',
    },
  ],
  status: 'beta',
  updated: '2026-10-24',
};
