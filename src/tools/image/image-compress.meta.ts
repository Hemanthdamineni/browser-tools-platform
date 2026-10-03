import type { ToolMeta } from '@/lib/types';
export const meta: ToolMeta = {
  id: 'image-compress',
  name: 'Compress Image',
  category: 'image',
  summary: 'Reduce image file size by re-encoding locally in your browser.',
  description:
    'Compress JPEG, PNG, WebP and other browser-decodable images by adjusting quality and dimensions without uploading them.',
  keywords: ['compress image', 'image optimizer', 'reduce image size', 'jpeg quality'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'image/*',
  multiple: true,
  options: [
    {
      key: 'format',
      label: 'Format',
      type: 'select',
      default: 'auto',
      choices: [
        { value: 'auto', label: 'Automatic' },
        { value: 'jpeg', label: 'JPEG' },
        { value: 'webp', label: 'WebP' },
      ],
    },
    { key: 'quality', label: 'Quality (%)', type: 'range', default: 75, min: 10, max: 100 },
    {
      key: 'maxWidth',
      label: 'Maximum width (0 = original)',
      type: 'number',
      default: 0,
      min: 0,
      max: 16384,
    },
    { key: 'stripMetadata', label: 'Strip metadata', type: 'boolean', default: true },
  ],
  examples: [{ title: 'Compress at 75% quality' }],
  related: ['image-resize', 'image-convert'],
  status: 'beta',
};
