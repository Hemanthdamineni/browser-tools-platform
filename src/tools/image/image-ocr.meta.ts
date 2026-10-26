import type { ToolMeta } from '@/lib/types';
import { OCR_LANGUAGES, OCR_MODES } from './ocr-languages';

export const meta: ToolMeta = {
  id: 'image-ocr',
  name: 'Image OCR',
  category: 'image',
  summary:
    'Read text out of images with on-device OCR — nothing is uploaded, nothing leaves your browser.',
  description:
    'Turn a photo, a screenshot or a scanned page into editable text with Tesseract OCR. The engine and the language models are served from this site, so the whole job happens inside your browser.',
  keywords: [
    'ocr',
    'image to text',
    'text from image',
    'extract text from photo',
    'read text in image',
    'tesseract',
    'screenshot to text',
    'scan to text',
    'receipt ocr',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'image/png,image/jpeg,image/webp,image/gif,image/bmp',
  multiple: true,
  // tesseract.js does its heavy lifting inside a Web Worker of its own, so the
  // generic tool worker would only add a second, nested worker. Running the
  // thin wrapper on the main thread keeps the browser happy (tesseract.js
  // resolves its asset paths against `window.location`) while the OCR itself
  // still happens off the main thread.
  worker: false,
  options: [
    {
      key: 'language',
      label: 'Language',
      type: 'select',
      default: 'eng',
      help: 'The language the text in the image is written in.',
      choices: OCR_LANGUAGES.map((l) => ({ value: l.code, label: l.label })),
    },
    {
      key: 'mode',
      label: 'Text layout',
      type: 'select',
      default: 'auto',
      help: 'How the text is arranged in the image. “Automatic” suits most pictures.',
      choices: OCR_MODES.map((m) => ({ value: m.value, label: m.label })),
    },
    {
      key: 'tidy',
      label: 'Tidy up the spacing',
      type: 'boolean',
      default: true,
      help: 'Remove trailing spaces and the blank lines the engine sometimes adds.',
    },
  ],
  examples: [
    { title: 'Read the text in a screenshot' },
    { title: 'A German scanned page', options: { language: 'deu' } },
    {
      title: 'A single line, without tidying',
      options: { mode: 'line', tidy: false },
    },
  ],
  related: ['image-metadata', 'image-convert', 'image-compress', 'image-resize'],
  credits: [
    {
      name: 'tesseract.js',
      url: 'https://github.com/naptha/tesseract.js',
      license: 'Apache-2.0',
    },
    {
      name: 'Tesseract tessdata language models',
      url: 'https://github.com/tesseract-ocr/tessdata',
      license: 'Apache-2.0',
    },
  ],
  status: 'beta',
  updated: '2026-10-21',
};
