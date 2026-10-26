import type { ToolMeta } from '@/lib/types';
import { fflateCredit, pdfjsCredit } from './credits';
export const meta: ToolMeta = {
  id: 'pdf-to-images',
  name: 'PDF to Images',
  category: 'pdf',
  summary: 'Render selected PDF pages as PNG, JPEG, or WebP images.',
  description:
    'Convert PDF pages into image files locally using your browser worker. Multiple images are bundled into a ZIP download.',
  keywords: ['pdf', 'images', 'png', 'jpeg', 'webp', 'render', 'convert'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'application/pdf',
  options: [
    {
      key: 'format',
      label: 'Image format',
      type: 'select',
      default: 'png',
      choices: [
        { value: 'png', label: 'PNG' },
        { value: 'jpeg', label: 'JPEG' },
        { value: 'webp', label: 'WebP' },
      ],
    },
    { key: 'scale', label: 'Scale', type: 'number', default: 2, min: 1, max: 4 },
    {
      key: 'pages',
      label: 'Pages',
      type: 'text',
      default: 'all',
      placeholder: 'all or e.g. 1,3-5',
    },
    {
      key: 'quality',
      label: 'Image quality (%)',
      type: 'range',
      default: 90,
      min: 1,
      max: 100,
      showWhen: { key: 'format', value: 'jpeg' },
    },
  ],
  examples: [
    { title: 'Convert PDF pages to PNG' },
    {
      title: 'Export pages 1 and 3-5 as JPEG',
      options: { format: 'jpeg', scale: 2, pages: '1,3-5', quality: 85 },
    },
    { title: 'High-resolution WebP of page 2', options: { format: 'webp', scale: 4, pages: '2' } },
  ],
  related: ['images-to-pdf', 'pdf-extract-text'],
  credits: [pdfjsCredit, fflateCredit],
  status: 'stable',
};
