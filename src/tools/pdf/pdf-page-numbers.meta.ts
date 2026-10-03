import type { ToolMeta } from '@/lib/types';
import { pdfCredit } from './shared';
export const meta: ToolMeta = {
  id: 'pdf-page-numbers', name: 'Add Page Numbers', category: 'pdf',
  summary: 'Stamp page numbers onto a PDF in the position and format you choose.',
  description: 'Add page numbers to a PDF locally in your browser: pick the corner, the label format, the starting number, size and margin, or skip the first page.',
  keywords: ['pdf', 'page', 'numbers', 'footer', 'header', 'label'], privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file', accept: 'application/pdf',
  options: [
    { key: 'position', label: 'Position', type: 'select', default: 'bottom-center', choices: [
      { value: 'bottom-center', label: 'Bottom centre' },
      { value: 'bottom-right', label: 'Bottom right' },
      { value: 'bottom-left', label: 'Bottom left' },
      { value: 'top-center', label: 'Top centre' },
      { value: 'top-right', label: 'Top right' },
      { value: 'top-left', label: 'Top left' },
    ] },
    { key: 'format', label: 'Label format', type: 'select', default: 'n', choices: [
      { value: 'n', label: '1, 2, 3' },
      { value: 'n-of-total', label: '1 of 10' },
      { value: 'page-n', label: 'Page 1' },
      { value: 'page-n-of-total', label: 'Page 1 of 10' },
    ] },
    { key: 'startAt', label: 'Start at', type: 'number', default: 1, min: 1, max: 9999 },
    { key: 'fontSize', label: 'Font size', type: 'number', default: 10, min: 6, max: 72 },
    { key: 'margin', label: 'Margin', type: 'number', default: 24, min: 0, max: 200 },
    { key: 'skipFirst', label: 'Skip the first page', type: 'boolean', default: false },
  ],
  examples: [{ title: 'Number at the bottom' }],
  related: ['pdf-watermark', 'pdf-metadata', 'pdf-rotate'],
  credits: [pdfCredit], status: 'stable',
};
