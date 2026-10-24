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
  article: [
    {
      heading: 'Text out of a picture',
      body: 'Drop one or more PNG, JPEG, WebP, GIF or BMP images and each is decoded, normalised to a PNG — which also fixes the orientation a camera stored — and read by a WebAssembly build of Tesseract running in a worker. Every image gets its own text file, and the recognised text of all of them is shown together, sectioned by file name.',
    },
    {
      heading: 'Scans, screenshots and receipts',
      body: 'It is for the moments when the text you need is trapped inside an image: copying figures out of a screenshot, pulling the lines off a photographed receipt, or turning a scanned page into something you can search and quote. Clean, straight, printed text is where it is strongest.',
    },
    {
      heading: 'The three options',
      body: 'Language tells the engine which model to load — the picker covers English, German, French, Italian, Spanish, Portuguese, Dutch, Russian, Hindi and Chinese (Simplified) — and each model is downloaded the first time you use it. Text layout describes how the text sits in the picture, with Automatic suiting most images and single-line, block and sparse modes for the rest. Tidy up the spacing removes trailing spaces and stray blank lines.',
    },
    {
      heading: 'Accuracy, size and caveats',
      body: 'Accuracy depends entirely on the image: low contrast, skew and small type all hurt, so check numbers rather than trusting them. The first run downloads the engine (about 3.8 MB) and a language model (0.7–2.9 MB), then caches them. An unsupported file is reported on its own instead of failing the batch.',
    },
    {
      heading: 'The engine runs in your browser',
      body: 'Tesseract and its language models are served from this site and the recognition happens in a worker inside your tab — no image is uploaded and no CDN is contacted. Reading a passport scan or a medical letter here stays on your machine.',
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
  faq: [
    {
      q: 'Are my images uploaded?',
      a: 'No. The OCR engine is a WebAssembly build of Tesseract that runs in a Web Worker inside your browser, and the language model is downloaded from this site. Nothing is sent anywhere, and the privacy check in the test suite proves it.',
    },
    {
      q: 'Which languages can it read?',
      a: 'English, German, French, Italian, Spanish, Portuguese, Dutch and Russian. Each language model is a separate file that is only downloaded the first time you use that language.',
    },
    {
      q: 'How accurate is it?',
      a: 'Tesseract is very good at clean, straight, printed text — scans, screenshots and PDFs — and it struggles with handwriting, decorative fonts, low-contrast photos and text that is upside down. Check the numbers before you rely on them.',
    },
    {
      q: 'Why does the first run take a while?',
      a: 'The first run downloads the OCR engine (about 3.8 MB) and the language model (0.7–2.9 MB). Your browser then caches both, so later runs start almost immediately.',
    },
    {
      q: 'Can I read several images at once?',
      a: 'Yes. Drop in as many images as you like and each one is read on its own. Every image gets its own text file, and the recognised text of all of them is shown together above.',
    },
    {
      q: 'What happens to the photos?',
      a: 'Nothing is changed and nothing is stored. The images are read in the tab and thrown away when you close it.',
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
