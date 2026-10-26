import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'heic-to-jpg',
  name: 'HEIC to JPG',
  category: 'image',
  summary:
    'Convert HEIC photos from iPhone and Android to JPG, PNG or WebP — right in your browser.',
  description:
    'Decode HEIC/HEIF photos and save them as JPG, PNG or WebP. The decoder runs locally in a Web Worker, so your photos never leave the device.',
  keywords: [
    'heic to jpg',
    'heic converter',
    'heic to png',
    'heic to webp',
    'heif to jpeg',
    'iphone heic',
    'convert heic',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'image/heic,image/heif,.heic,.heif,.hif',
  multiple: true,
  options: [
    {
      key: 'to',
      label: 'Output format',
      type: 'select',
      default: 'jpeg',
      choices: [
        { value: 'jpeg', label: 'JPEG' },
        { value: 'png', label: 'PNG' },
        { value: 'webp', label: 'WebP' },
      ],
    },
    {
      key: 'quality',
      label: 'Quality (%)',
      type: 'range',
      default: 90,
      min: 10,
      max: 100,
      help: 'Used by JPEG and WebP. PNG is lossless and ignores it.',
    },
    {
      key: 'background',
      label: 'Background for JPEG',
      type: 'text',
      default: '#ffffff',
      placeholder: '#ffffff',
      help: 'JPEG has no transparency, so transparent areas are filled with this colour.',
      showWhen: { key: 'to', value: 'jpeg' },
    },
  ],
  examples: [
    { title: 'Convert a HEIC photo to JPG' },
    { title: 'Keep full quality as PNG for editing', options: { to: 'png' } },
    { title: 'Smaller WebP at 75 percent quality', options: { to: 'webp', quality: 75 } },
  ],
  related: ['image-convert', 'image-compress', 'image-metadata'],
  credits: [
    {
      name: 'libheif-js',
      url: 'https://github.com/catdad-experiments/libheif-js',
      license: 'LGPL-3.0',
    },
  ],
  status: 'beta',
  updated: '2026-10-21',
};
