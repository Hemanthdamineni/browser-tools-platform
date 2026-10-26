import type { ToolMeta } from '@/lib/types';
import { pdfCredit, pdfjsCredit } from './credits';

export const meta: ToolMeta = {
  id: 'pdf-redact',
  name: 'Redact PDF',
  category: 'pdf',
  summary:
    'Burn opaque black boxes over selected areas and export a PDF where the hidden content is truly gone.',
  description:
    'Draw rectangles over a page preview, then export a PDF where those areas are rasterised and painted over with opaque black. A black box drawn over text is not redaction — a viewer can still copy or select the words underneath — so the covered pages are flattened to images and the boxes burned in, destroying the underlying text layer. Pages you do not touch keep their searchable text.',
  keywords: [
    'redact pdf',
    'redaction',
    'black out pdf',
    'hide text pdf',
    'censor pdf',
    'burn redaction',
    'remove text layer',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'application/pdf',
  multiple: false,
  // The generic option form cannot express "draw rectangles on a page preview",
  // so the tool opts into the dedicated redaction panel
  // (src/components/panels/pdf-redact.astro). The options below are the redaction
  // plan that panel drives — they are read by `run()` through `resolveOptions`
  // and keep the tool usable without the UI.
  panel: 'pdf-redact',
  options: [
    {
      // Filled in by the redaction panel with the JSON array of pages and the
      // percent rectangles to burn on each. An empty value means no redaction.
      key: 'plan',
      label: 'Redaction plan (JSON)',
      type: 'textarea',
      default: '[]',
      help: 'An array of { page, regions } entries; regions are { x, y, w, h } rectangles in percent of the page. Filled in by the page preview.',
    },
    {
      key: 'scale',
      label: 'Rasterisation scale',
      type: 'number',
      default: 2,
      min: 1,
      max: 4,
      step: 1,
      help: 'How many rendered pixels per PDF point on redacted pages. Higher is sharper but makes a larger file.',
    },
    {
      key: 'outputName',
      label: 'Output file name',
      type: 'text',
      default: 'redacted.pdf',
    },
  ],
  examples: [
    { title: 'Redact a document' },
    { title: 'Redact at a higher resolution', options: { scale: 3 } },
    {
      title: 'Give the redacted copy its own file name',
      options: { outputName: 'public-copy.pdf' },
    },
  ],
  related: ['pdf-extract-text', 'pdf-watermark', 'pdf-compress', 'pdf-to-images'],
  credits: [pdfCredit, pdfjsCredit],
  status: 'beta',
  updated: '2026-10-24',
};
