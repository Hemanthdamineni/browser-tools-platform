import type { ToolMeta } from '@/lib/types';
import { pdfCredit } from './shared';
export const meta: ToolMeta = {
  id: 'pdf-rotate',
  name: 'Rotate Pages',
  category: 'pdf',
  summary: 'Rotate every page — or a selection — of a PDF by 90, 180, or 270 degrees.',
  description:
    'Turn PDF pages sideways or upside down locally in your browser. Rotation is added to any rotation the pages already have.',
  keywords: ['pdf', 'rotate', 'turn', 'landscape', 'orientation'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'application/pdf',
  options: [
    {
      key: 'angle',
      label: 'Rotation angle',
      type: 'select',
      default: '90',
      choices: [
        { value: '90', label: '90° clockwise' },
        { value: '180', label: '180°' },
        { value: '270', label: '270° clockwise' },
      ],
    },
    {
      key: 'pages',
      label: 'Pages',
      type: 'text',
      default: 'all',
      placeholder: 'all or e.g. 1,3-5',
    },
  ],
  examples: [{ title: 'Rotate all pages 90°' }],
  related: [  "pdf-delete-pages",
  "pdf-page-numbers"],
  credits: [pdfCredit],
  status: 'stable',
};
