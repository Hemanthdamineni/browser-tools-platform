import type { ToolMeta } from '@/lib/types';
import { pdfCredit } from './credits';
export const meta: ToolMeta = {
  id: 'pdf-merge',
  name: 'Merge PDFs',
  category: 'pdf',
  summary: 'Combine several PDF files into one document, page by page.',
  description:
    'Join multiple PDFs into a single file locally in your browser. Pages are appended in the order the files are selected.',
  keywords: ['pdf', 'merge', 'combine', 'join', 'append'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'application/pdf',
  multiple: true,
  options: [
    { key: 'outputName', label: 'Output file name', type: 'text', default: 'merged.pdf' },
    {
      key: 'keepBookmarks',
      label: 'Keep bookmarks (best effort)',
      type: 'boolean',
      default: false,
    },
  ],
  examples: [
    { title: 'Merge two PDFs' },
    { title: 'Combine a cover page and a report' },
    { title: 'Join scanned chapters in reading order' },
  ],
  related: ['pdf-split', 'images-to-pdf', 'pdf-extract-pages'],
  credits: [pdfCredit],
  status: 'stable',
};
