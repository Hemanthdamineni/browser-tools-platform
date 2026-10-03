import type { ToolMeta } from '@/lib/types';
import { pdfCredit } from './shared';
export const meta: ToolMeta = {
  id: 'pdf-split',
  name: 'Split PDF',
  category: 'pdf',
  summary: 'Split a PDF into one file per page, per range, or into fixed-size chunks.',
  description:
    'Break a PDF apart in your browser: every page as its own file, custom page ranges, or fixed-size chunks. Multiple results are bundled into a ZIP.',
  keywords: ['pdf', 'split', 'divide', 'ranges', 'chunks', 'extract'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'application/pdf',
  options: [
    {
      key: 'mode',
      label: 'Split mode',
      type: 'select',
      default: 'every-page',
      choices: [
        { value: 'every-page', label: 'Every page' },
        { value: 'ranges', label: 'Custom ranges' },
        { value: 'fixed-size', label: 'Fixed-size chunks' },
      ],
    },
    {
      key: 'ranges',
      label: 'Ranges',
      type: 'text',
      default: '1-3,5,7-',
      help: 'e.g. 1-3,5,7- (7- means to the end)',
      showWhen: { key: 'mode', value: 'ranges' },
    },
    {
      key: 'size',
      label: 'Pages per file',
      type: 'number',
      default: 10,
      min: 1,
      max: 500,
      showWhen: { key: 'mode', value: 'fixed-size' },
    },
  ],
  examples: [
    { title: 'One file per page' },
    { title: 'Split into ranges', options: { mode: 'ranges', ranges: '1-3,4-' } },
  ],
  faq: [
    {
      q: 'Why a ZIP?',
      a: 'When the split produces more than one file they are bundled into a single ZIP download.',
    },
  ],
  related: ['pdf-merge', 'pdf-extract-pages', 'pdf-delete-pages'],
  credits: [pdfCredit],
  status: 'stable',
};
