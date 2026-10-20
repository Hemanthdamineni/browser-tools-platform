import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'image-ocr',
  name: 'Image to Text (OCR)',
  category: 'image',
  summary: 'Read the text in a photo or screenshot, entirely on your device.',
  description:
    'Recognise the words in an image with an OCR engine that runs in your browser. The language model is downloaded from this site the first time you use it; the image itself never leaves your device.',
  keywords: ['ocr', 'image to text', 'extract text from image', 'screenshot text', 'read text'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'image/*',
  // tesseract.js drives its own worker internally, so running the tool inline
  // keeps the abort signal (and avoids nesting workers) while the page stays
  // responsive.
  worker: false,
  options: [
    {
      key: 'language',
      label: 'Language',
      type: 'select',
      default: 'eng',
      choices: [
        { value: 'eng', label: 'English' },
        { value: 'deu', label: 'German (Deutsch)' },
        { value: 'fra', label: 'French (Français)' },
        { value: 'spa', label: 'Spanish (Español)' },
      ],
      help: 'The model for the chosen language is fetched from this site on first use, then saved for later runs.',
    },
  ],
  examples: [{ title: 'Read text from a screenshot' }],
  faq: [
    {
      q: 'Does my image get uploaded?',
      a: 'No. The image is read by an OCR engine running in your browser. Only the language model file is downloaded, from this same site.',
    },
    {
      q: 'Which languages are supported?',
      a: 'English, German, French and Spanish. Each language is a separate model file, downloaded only when you pick it.',
    },
    {
      q: 'What kind of images work best?',
      a: 'Clear, straight-on photos and screenshots with dark text on a light background. Small, blurry or handwritten text is often misread.',
    },
    {
      q: 'Why is there a size limit?',
      a: 'Images above 25 megapixels can run out of memory in the browser, so the tool asks you to crop or resize them first.',
    },
  ],
  related: ['pdf-extract-text', 'image-metadata'],
  credits: [
    { name: 'tesseract.js', url: 'https://github.com/naptha/tesseract.js', license: 'Apache-2.0' },
    {
      name: 'tesseract.js-core',
      url: 'https://github.com/naptha/tesseract.js-core',
      license: 'Apache-2.0',
    },
    {
      name: '@tesseract.js-data (eng, deu, fra, spa)',
      url: 'https://github.com/naptha/tessdata',
      license: 'MIT',
    },
  ],
  status: 'beta',
  updated: '2026-10-17',
};
