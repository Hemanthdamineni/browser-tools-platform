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
  article: [
    {
      heading: 'What a searchable PDF is',
      body: 'A scan is a picture of a page: a viewer can show it, but search, selection and copy find nothing. A searchable PDF keeps that picture and adds a layer of real text in the same positions, so Ctrl+F, a screen reader and your operating system can all reach the words. This tool reads each page on this device and writes that layer into a brand-new PDF, leaving the visible scan untouched.',
    },
    {
      heading: 'How each page is read',
      body: 'Every selected page is rendered by a local PDF renderer to a bitmap at the render scale you choose, then handed to the Tesseract OCR engine, which reports each word together with the rectangle it occupies. Those rectangles are converted from bitmap pixels back into PDF coordinates — a division by the render scale and a flip of the vertical axis — and drawn with the PDF “invisible” text rendering mode, so they are found by search but paint nothing.',
    },
    {
      heading: 'Languages and render scale',
      body: 'The language models are bundled with the site, so nothing is downloaded from a third party and the first run works offline. Pick the language the document is actually written in: a mismatched model is the single biggest cause of poor results. A higher render scale gives the engine more detail to work with on small print, at the cost of memory and time; 2× suits most scans.',
    },
    {
      heading: 'Limits worth knowing',
      body: 'OCR is a guess, so check names, figures and totals before relying on them. The hidden layer uses a built-in Latin font: words in Chinese, Hindi, Cyrillic and other non-Latin scripts are recognised on the page but cannot be encoded into the layer, so they are skipped while the scan stays readable. Because each page keeps its bitmap, the finished file is larger than a born-digital PDF.',
    },
  ],
  faq: [
    {
      q: 'Is my PDF uploaded anywhere?',
      a: 'No. The pages are rendered and read with a PDF renderer and Tesseract OCR that are both served from this site, so the whole job happens inside your browser.',
    },
    {
      q: 'What does "searchable" mean?',
      a: 'A hidden text layer is written into the PDF at the exact position of every recognised word on the page. The page still shows the original scan, but you can now search, select and copy the text as if it were a born-digital document.',
    },
    {
      q: 'Will the text layer cover the page?',
      a: 'No — the text is written with the PDF “invisible” rendering mode, so it is picked up by search, selection and copy but draws nothing on top of the scan.',
    },
    {
      q: 'Which languages can it read?',
      a: 'The language models are bundled with this site, so no download is needed on first use. English is the default; German, French, Italian, Spanish, Portuguese, Dutch, Russian, Hindi and Simplified Chinese are also available.',
    },
    {
      q: 'Why does a non-Latin page not search well?',
      a: 'The hidden layer uses a built-in Latin font that has no glyphs for scripts such as Chinese, Hindi or Cyrillic, so words in those scripts are skipped from the layer even though the scan stays readable. A Latin-language page is fully searchable.',
    },
  ],
  related: ['pdf-extract-text', 'image-ocr', 'pdf-to-images', 'pdf-compress'],
  credits: [pdfCredit, pdfjsCredit, tesseractCredit, tessdataCredit],
  status: 'beta',
  updated: '2026-10-24',
};
