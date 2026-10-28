import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'pdf-redact',
  name: 'PDF Redact',
  category: 'pdf',
  summary: 'True redaction: draw boxes on pages to permanently remove text and images, then burn in the redaction.',
  description:
    'Permanently redact sensitive content from PDFs by drawing rectangular regions on pages. The tool rasterizes the affected pages and burns in solid black boxes, ensuring the underlying text and images cannot be recovered. WARNING: Redacted pages lose their text layer and become images — they will no longer be searchable or selectable.',
  keywords: [
    'pdf',
    'redact',
    'redaction',
    'privacy',
    'sensitive',
    'remove',
    'blackout',
    'censor',
    'gdpr',
    'confidential',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'application/pdf',
  multiple: false,
  panel: 'pdf-redact',
  options: [
    {
      key: 'redactionColor',
      label: 'Redaction Color',
      type: 'select',
      default: 'black',
      choices: [
        { value: 'black', label: 'Black (standard)' },
        { value: 'white', label: 'White' },
        { value: 'red', label: 'Red (visible marker)' },
      ],
      help: 'Color of the redaction boxes. Black is standard for legal redaction.',
    },
    {
      key: 'dpi',
      label: 'Rasterization DPI',
      type: 'select',
      default: '150',
      choices: [
        { value: '72', label: '72 DPI (fast, lower quality)' },
        { value: '150', label: '150 DPI (balanced)' },
        { value: '300', label: '300 DPI (high quality, slower)' },
      ],
      help: 'Resolution for rasterizing pages with redactions. Higher = better quality but larger file.',
    },
  ],
  faq: [
    {
      q: 'Is this true redaction or just visual overlay?',
      a: 'This is true redaction. The tool rasterizes the entire page at the selected DPI, draws solid filled rectangles over the redacted regions, and saves the result as an image-based PDF. The original text and vector content under the redactions is permanently destroyed.',
    },
    {
      q: 'Why does the PDF lose its text layer?',
      a: 'True redaction requires converting the page to a bitmap (rasterization) so that the redacted content cannot be recovered by any means. This means the output PDF pages with redactions become images — text cannot be selected, searched, or copied from those pages.',
    },
    {
      q: 'Can I redact only some pages?',
      a: 'Yes. In the panel, you can navigate pages and draw redaction boxes only on the pages that need it. Pages without redactions are copied unchanged (preserving their text layer).',
    },
    {
      q: 'What if I make a mistake?',
      a: 'You can delete redaction boxes before applying. Once you click "Apply Redactions", the changes are permanent. Always keep a backup of the original PDF.',
    },
    {
      q: 'Does this work on scanned PDFs?',
      a: 'Yes. Scanned PDFs are already image-based, so redaction works by drawing over the existing image. The output quality depends on the DPI setting.',
    },
  ],
  related: ['pdf-extract-text', 'pdf-to-images', 'image-blur-redact'],
  credits: [
    {
      name: 'pdfjs-dist',
      url: 'https://github.com/mozilla/pdf.js',
      license: 'Apache-2.0',
    },
    {
      name: 'pdf-lib',
      url: 'https://github.com/Hopding/pdf-lib',
      license: 'MIT',
    },
  ],
  status: 'beta',
};