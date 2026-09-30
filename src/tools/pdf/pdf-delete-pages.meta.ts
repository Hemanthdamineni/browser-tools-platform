import type { ToolMeta } from '@/lib/types';
import { pdfCredit } from './shared';
export const meta: ToolMeta = {
  id: 'pdf-delete-pages', name: 'Delete Pages', category: 'pdf',
  summary: 'Remove selected pages from a PDF and download the trimmed document.',
  description: 'Delete pages (as a list or ranges) from a PDF right in your browser. The remaining pages keep their original order.',
  keywords: ['pdf', 'delete', 'remove', 'pages', 'trim'], privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file', accept: 'application/pdf',
  options: [
    { key: 'pages', label: 'Pages to delete', type: 'text', default: '2,4', placeholder: 'e.g. 2,4 or 3-6' },
  ],
  examples: [{ title: 'Delete pages 2 and 4', options: { pages: '2,4' } }],
  related: ['pdf-extract-pages', 'pdf-split', 'pdf-rotate'],
  credits: [pdfCredit], status: 'stable',
};
