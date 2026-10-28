import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'image-spritesheet',
  name: 'Sprite Sheet Builder',
  category: 'image',
  summary: 'Combine multiple images into one sprite sheet with a position map.',
  description:
    'Arrange images into a grid, row, column, or packed layout and export a sprite sheet PNG/WebP plus JSON and CSS coordinates. All processing happens in your browser.',
  keywords: ['sprite sheet', 'css sprites', 'image sprite generator'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'image/*',
  multiple: true,
  options: [
    {
      key: 'layout',
      label: 'Layout',
      type: 'select',
      default: 'grid',
      choices: [
        { value: 'grid', label: 'Grid' },
        { value: 'horizontal', label: 'Horizontal row' },
        { value: 'vertical', label: 'Vertical column' },
        { value: 'packed', label: 'Packed' },
      ],
      help: 'Packed tiles sprites tightly by area; grid keeps a uniform cell size.',
    },
    {
      key: 'columns',
      label: 'Grid columns (0 = auto)',
      type: 'number',
      default: 0,
      min: 0,
      showWhen: { key: 'layout', value: 'grid' },
    },
    { key: 'padding', label: 'Padding (px)', type: 'number', default: 2, min: 0 },
    {
      key: 'format',
      label: 'Sheet format',
      type: 'select',
      default: 'png',
      choices: [
        { value: 'png', label: 'PNG' },
        { value: 'webp', label: 'WebP' },
      ],
    },
  ],
  examples: [
    { title: 'Grid sprite sheet' },
    { title: 'A packed sheet with a margin', options: { layout: 'packed', padding: 4 } },
    {
      title: 'A horizontal row for an animation strip',
      options: { layout: 'horizontal', padding: 2 },
    },
  ],
  related: ['favicon-generator', 'image-resize'],
  status: 'stable',
  updated: '2026-10-17',
};
