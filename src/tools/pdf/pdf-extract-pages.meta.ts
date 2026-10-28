import type { ToolMeta } from '@/lib/types';
import { pdfCredit } from './shared';
export const meta: ToolMeta = {
  id: 'pdf-extract-pages',
  name: 'Extract Pages',
  category: 'pdf',
  summary: 'Pull selected pages out of a PDF into a new document.',
  description:
    'Copy chosen pages (as a list or ranges, in any order) from a PDF into a single new PDF file, right in your browser.',
  keywords: ['pdf', 'extract', 'pages', 'select', 'subset'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'application/pdf',
  options: [
    {
      key: 'pages',
      label: 'Pages to extract',
      type: 'text',
      default: '1,3,5-7',
      placeholder: 'e.g. 5,1 or 1-3',
    },
  ],
  examples: [{ title: 'Extract pages 5 and 1', options: { pages: '5,1' } }],
  related: [  "pdf-split",
  "pdf-delete-pages",
  "pdf-merge"],
  credits: [pdfCredit],
  status: 'stable',
};
