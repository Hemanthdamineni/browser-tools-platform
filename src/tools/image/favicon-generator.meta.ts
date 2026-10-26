import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'favicon-generator',
  name: 'Favicon Generator',
  category: 'image',
  summary: 'Generate favicon, Apple touch, and Android icon assets from one image.',
  description:
    'Create common browser and platform icon sizes from an image, package them in a ZIP, and copy the generated HTML and manifest snippet. Every icon is rendered on your device.',
  keywords: ['favicon generator', 'app icons', 'apple touch icon', 'manifest icons'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'image/*',
  options: [
    { key: 'include512', label: 'Include 512px favicon', type: 'boolean', default: true },
    {
      key: 'background',
      label: 'Background',
      type: 'text',
      default: 'transparent',
      help: '“transparent”, or a hex colour such as #ffffff, fills the letterbox space around non-square art.',
    },
    {
      key: 'padding',
      label: 'Maskable icon padding (%)',
      type: 'number',
      default: 0,
      min: 0,
      max: 30,
      help: 'Safe-zone border applied only to the 512px Android maskable icon.',
    },
  ],
  examples: [
    { title: 'Generate favicon assets' },
    { title: 'Icons on a solid background', options: { background: '#0f172a' } },
    { title: 'Android-safe maskable icon', options: { padding: 10, include512: true } },
  ],
  related: ['image-resize', 'image-spritesheet'],
  credits: [{ name: 'fflate', url: 'https://github.com/101arrowz/fflate', license: 'MIT' }],
  status: 'stable',
  updated: '2026-10-17',
};
