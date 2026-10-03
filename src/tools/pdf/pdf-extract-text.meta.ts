import type { ToolMeta } from '@/lib/types';
import { pdfjsCredit } from './shared';

export const meta: ToolMeta = {
  id: 'pdf-extract-text', name: 'Extract PDF Text', category: 'pdf',
  summary: 'Extract selectable text from every page of a PDF.',
  description: 'Read text content from a PDF locally in your browser and display it page by page. Scanned pages without an OCR text layer produce no extracted text.',
  keywords: ['pdf', 'extract', 'text', 'copy', 'content'], privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file', accept: 'application/pdf',
  examples: [{ title: 'Extract text from a PDF' }],
  related: ['pdf-to-images', 'pdf-metadata', 'pdf-extract-pages'],
  credits: [pdfjsCredit], status: 'stable',
};
