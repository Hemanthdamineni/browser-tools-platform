import type { ToolMeta } from '@/lib/types';
import { pdfCredit } from './shared';
export const meta: ToolMeta = {
  id: 'pdf-watermark', name: 'Watermark PDF', category: 'pdf',
  summary: 'Overlay translucent text on selected PDF pages as a centered or tiled watermark.',
  description: 'Mark PDF pages with a text watermark. Choose its opacity, angle, font size, colour, pages and centered or tiled placement.',
  keywords: ['pdf', 'watermark', 'stamp', 'overlay', 'confidential'], privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file', accept: 'application/pdf',
  options: [
    { key: 'text', label: 'Watermark text', type: 'text', default: 'CONFIDENTIAL' },
    { key: 'opacity', label: 'Opacity (%)', type: 'range', default: 15, min: 5, max: 100 },
    { key: 'rotation', label: 'Rotation (degrees)', type: 'number', default: 45, min: -90, max: 90 },
    { key: 'fontSize', label: 'Font size', type: 'number', default: 48, min: 8, max: 144 },
    { key: 'color', label: 'Colour (hex)', type: 'text', default: '#ff0000' },
    { key: 'pages', label: 'Pages', type: 'text', default: 'all', placeholder: 'all or e.g. 1,3-5' },
    { key: 'position', label: 'Placement', type: 'select', default: 'center', choices: [
      { value: 'center', label: 'Centered' }, { value: 'tile', label: 'Tile across page' },
    ] },
  ],
  examples: [{ title: 'Add a confidential watermark' }],
  related: ['pdf-page-numbers', 'pdf-metadata'],
  credits: [pdfCredit], status: 'stable',
};
