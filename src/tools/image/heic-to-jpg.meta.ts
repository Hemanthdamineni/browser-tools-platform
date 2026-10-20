import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'heic-to-jpg',
  name: 'HEIC to JPG',
  category: 'image',
  summary: 'Convert iPhone HEIC/HEIF photos to JPEG, PNG or WebP on your device.',
  description:
    'Decode HEIC and HEIF images — including the photos iPhones and iPads save by default — and re-encode them as JPEG, PNG or WebP. The decoder runs entirely in your browser, so your photos are never uploaded.',
  keywords: [
    'heic to jpg',
    'heic to jpeg',
    'heif converter',
    'convert heic',
    'iphone photo converter',
    'heic to png',
    'heic to webp',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '.heic,.heif,image/heic,image/heif',
  multiple: true,
  options: [
    {
      key: 'format',
      label: 'Output format',
      type: 'select',
      default: 'jpeg',
      choices: [
        { value: 'jpeg', label: 'JPEG (.jpg)' },
        { value: 'png', label: 'PNG (.png)' },
        { value: 'webp', label: 'WebP (.webp)' },
      ],
    },
    {
      key: 'quality',
      label: 'Quality (%)',
      type: 'range',
      default: 90,
      min: 10,
      max: 100,
      help: 'Applies to JPEG and WebP. PNG is always lossless.',
    },
    {
      key: 'maxDimension',
      label: 'Maximum dimension (px)',
      type: 'number',
      default: 0,
      min: 0,
      max: 20000,
      help: 'Longest edge of the output. 0 keeps the original size; images are never upscaled.',
    },
    {
      key: 'background',
      label: 'Background for JPEG',
      type: 'text',
      default: '#ffffff',
      placeholder: '#ffffff',
      help: 'Transparent areas are flattened onto this colour.',
      showWhen: { key: 'format', value: 'jpeg' },
    },
  ],
  examples: [{ title: 'Convert HEIC photos to JPEG' }],
  faq: [
    {
      q: 'Are my photos uploaded anywhere?',
      a: 'No. Both the HEIC decoder and the encoder run inside your browser tab. The page makes no network requests at all once it has loaded.',
    },
    {
      q: 'Why does the first photo take a moment?',
      a: 'The HEIC decoder is a WebAssembly module of roughly 700 KB that is fetched once, only when you run the tool, and then cached. Later photos convert immediately.',
    },
    {
      q: 'What happens to EXIF, GPS and other metadata?',
      a: 'Only the pixels are re-encoded, so metadata is not carried over to the output. That also means any location data stored in the HEIC is dropped.',
    },
    {
      q: 'Are Live Photos, bursts and animations handled?',
      a: 'Only the primary still image of each file is converted. Extra frames and the motion part of a Live Photo are ignored, and a warning is shown when a file contains more than one image.',
    },
    {
      q: 'Will the converted photo be rotated correctly?',
      a: 'Yes. HEIF rotation and mirroring instructions are applied while decoding, so the output is already upright.',
    },
  ],
  related: ['image-convert', 'image-compress', 'image-resize'],
  credits: [{ name: 'libheif-js', url: 'https://github.com/catdad-experiments/libheif-js', license: 'LGPL-3.0' }],
  status: 'beta',
};
