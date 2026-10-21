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
  examples: [{ title: 'Convert a HEIC photo to JPG' }],
  faq: [
    {
      q: 'Is anything uploaded?',
      a: 'No. The HEIC decoder is a WebAssembly build of libheif that runs inside a Web Worker in your browser. Your photos are never sent anywhere.',
    },
    {
      q: 'Why does the first conversion take a moment?',
      a: 'The decoder is about 1.5 MB and is only downloaded the first time you convert something. After that it is cached by the browser.',
    },
    {
      q: 'Does it keep transparency?',
      a: 'PNG and WebP keep the alpha channel exactly as it is. JPEG has no transparency, so transparent pixels are flattened onto the background colour you choose.',
    },
    {
      q: 'Which HEIC files are supported?',
      a: 'HEIC and HEIF files that use HEVC — the format iPhones, iPads and most Android phones use. The rotation and crop stored in the file are applied. AVIF files are a different format; use the Image Converter for those.',
    },
    {
      q: 'Are the colours and the metadata preserved?',
      a: 'The pixels are decoded to 8-bit sRGB, so HDR gain maps and the original colour profile are not carried over. The output is a fresh file: no EXIF, GPS or other metadata is copied into it.',
    },
    {
      q: 'Are the original photos modified?',
      a: 'No. The originals are only read. Every conversion produces a new file next to the original, with the same name and a new extension.',
    },
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
