import type { ToolMeta } from '@/lib/types';
import { pdfCredit } from './credits';
export const meta: ToolMeta = {
  id: 'pdf-metadata',
  name: 'View / Edit PDF Metadata',
  category: 'pdf',
  summary: 'Inspect document properties or update PDF title, author, subject, keywords and more.',
  description:
    'View the metadata stored in a PDF, then optionally change its document properties. Processing stays in your browser.',
  keywords: ['pdf', 'metadata', 'title', 'author', 'properties', 'inspect'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'application/pdf',
  options: [
    { key: 'title', label: 'Title', type: 'text', default: '' },
    { key: 'author', label: 'Author', type: 'text', default: '' },
    { key: 'subject', label: 'Subject', type: 'text', default: '' },
    { key: 'keywords', label: 'Keywords', type: 'text', default: '' },
    { key: 'creator', label: 'Creator', type: 'text', default: '' },
    { key: 'producer', label: 'Producer', type: 'text', default: '' },
    { key: 'clearAll', label: 'Clear all metadata', type: 'boolean', default: false },
  ],
  examples: [
    { title: 'View PDF metadata' },
    { title: 'Set a title', options: { title: 'My document' } },
    { title: 'Strip all metadata', options: { clearAll: true } },
  ],
  related: ['pdf-page-numbers', 'pdf-watermark', 'image-metadata'],
  credits: [pdfCredit],
  status: 'stable',
};
