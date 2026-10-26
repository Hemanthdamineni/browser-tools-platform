import type { ToolMeta } from '@/lib/types';
import { pdfCredit, pdfjsCredit } from './credits';
import { OCR_LANGUAGES, OCR_MODES, DEFAULT_OCR_LANGUAGE } from '@/tools/image/ocr-languages';

export const tesseractCredit = {
  name: 'tesseract.js',
  url: 'https://github.com/naptha/tesseract.js',
  license: 'Apache-2.0',
};
export const tessdataCredit = {
  name: 'Tesseract tessdata language models',
  url: 'https://github.com/tesseract-ocr/tessdata',
  license: 'Apache-2.0',
};

export const meta: ToolMeta = {
  id: 'pdf-ocr',
  name: 'PDF OCR',
  category: 'pdf',
  summary:
    'Make a scanned PDF searchable — read the text on every page and hide a selectable text layer inside.',
  description:
    'Turn a scanned or image-only PDF into one you can search, select and copy from. Each page is rendered and read with Tesseract OCR on this device, then a matching invisible text layer is written back into a new PDF, so the page still looks exactly the same but the words are now live text.',
  keywords: [
    'pdf ocr',
    'searchable pdf',
    'scanned pdf to text',
    'optical character recognition',
    'text layer',
    'tesseract',
    'image pdf',
    'selectable text',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'application/pdf',
  // tesseract.js does its heavy lifting inside a Web Worker of its own, so the
  // generic tool worker would only add a second, nested worker. Running the
  // thin wrapper on the main thread keeps the browser happy (tesseract.js
  // resolves its asset paths against `window.location`) while the OCR itself
  // still happens off the main thread. The pdf.js renderer and the pdf-lib
  // assembly share that same setup, matching how `image-ocr` loads Tesseract.
  worker: false,
  panel: 'pdf-ocr',
  options: [
    {
      key: 'language',
      label: 'Language',
      type: 'select',
      default: DEFAULT_OCR_LANGUAGE,
      choices: OCR_LANGUAGES.map((language) => ({
        value: language.code,
        label: language.label,
      })),
    },
    {
      key: 'scale',
      label: 'Render scale',
      type: 'range',
      default: 2,
      min: 1,
      max: 4,
      step: 1,
    },
    {
      key: 'mode',
      label: 'Text layout',
      type: 'select',
      default: 'auto',
      choices: OCR_MODES.map((mode) => ({ value: mode.value, label: mode.label })),
    },
    {
      key: 'pages',
      label: 'Pages',
      type: 'text',
      default: 'all',
      placeholder: 'all or e.g. 1,3-5',
    },
  ],
  examples: [
    { title: 'Make a scanned English PDF searchable', options: { language: 'eng', scale: 2 } },
    {
      title: 'Read a German letter at a finer render scale',
      options: { language: 'deu', scale: 3 },
    },
    { title: 'OCR only the first three pages', options: { language: 'eng', pages: '1-3' } },
  ],
  related: ['pdf-extract-text', 'image-ocr', 'pdf-to-images', 'pdf-compress'],
  credits: [pdfCredit, pdfjsCredit, tesseractCredit, tessdataCredit],
  status: 'beta',
  updated: '2026-10-24',
};
