import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'background-remover',
  name: 'Remove Image Background',
  category: 'image',
  summary:
    'Remove the background from a photo of a person and export a transparent PNG, on-device.',
  description:
    'Drop in a photo of a person and MODNet cuts the subject out on your device. Export a transparent PNG, or flatten the subject onto a solid colour you pick. The photo never leaves your browser — only the model weights are downloaded, once.',
  keywords: [
    'remove background',
    'background remover',
    'transparent png',
    'cut out photo',
    'portrait matting',
    'modnet',
    'cutout',
  ],
  privacy: { processing: 'on-device', network: ['huggingface.co'], offline: false },
  input: 'file',
  accept: 'image/*',
  options: [
    {
      key: 'background',
      label: 'Background colour',
      type: 'text',
      default: 'transparent',
      placeholder: 'transparent or #ffffff',
      help: 'Leave as “transparent” for a see-through PNG, or enter a hex colour such as #ffffff to flatten the subject onto it.',
    },
    {
      key: 'cutoff',
      label: 'Edge cutoff',
      type: 'range',
      min: 0,
      max: 128,
      step: 1,
      default: 0,
      help: 'Removes faint background haze left around the subject. 0 keeps the soft edge exactly as the model produced it.',
    },
  ],
  examples: [
    {
      title: 'Transparent cut-out on the default setting',
      options: { background: 'transparent' },
    },
    { title: 'Flatten onto white', options: { background: '#ffffff', cutoff: 0 } },
    {
      title: 'Remove a halo against a coloured backdrop',
      options: { background: '#eef2ff', cutoff: 24 },
    },
  ],
  related: ['image-compress', 'image-resize', 'image-rotate'],
  credits: [
    {
      name: 'MODNet (Xenova/modnet)',
      url: 'https://huggingface.co/Xenova/modnet',
      license: 'Apache-2.0',
    },
  ],
  status: 'beta',
  updated: '2026-10-21',
};
