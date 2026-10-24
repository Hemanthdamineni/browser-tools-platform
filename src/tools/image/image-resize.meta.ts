import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'image-resize',
  name: 'Resize Image',
  category: 'image',
  summary: 'Resize images by percentage or to exact dimensions, entirely in your browser.',
  description:
    'Scale PNG, JPEG or WebP images while preserving aspect ratio or forcing exact dimensions. Processing stays on your device.',
  keywords: ['resize image', 'image scale', 'shrink photo', 'dimensions', 'pixels'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'image/*',
  multiple: true,
  options: [
    {
      key: 'mode',
      label: 'Sizing mode',
      type: 'select',
      default: 'fit',
      choices: ['fit', 'fill', 'exact', 'percent', 'max-width', 'max-height'].map((value) => ({
        value,
        label: value,
      })),
    },
    { key: 'width', label: 'Width (px)', type: 'number', default: 800, min: 1, max: 8192 },
    { key: 'height', label: 'Height (px)', type: 'number', default: 600, min: 1, max: 8192 },
    {
      key: 'percent',
      label: 'Scale (%)',
      type: 'number',
      default: 50,
      min: 1,
      max: 400,
      showWhen: { key: 'mode', value: 'percent' },
    },
    {
      key: 'format',
      label: 'Output format',
      type: 'select',
      default: 'original',
      choices: ['original', 'png', 'jpeg', 'webp'].map((value) => ({ value, label: value })),
    },
    {
      key: 'quality',
      label: 'Quality (%)',
      type: 'range',
      default: 90,
      min: 10,
      max: 100,
      showWhen: { key: 'format', value: 'jpeg' },
    },
    { key: 'upscale', label: 'Allow upscaling', type: 'boolean', default: false },
  ],
  examples: [
    { title: 'Fit within 800 × 600', options: { mode: 'fit', width: 800, height: 600 } },
    { title: 'Shrink to 50%', options: { mode: 'percent', percent: 50 } },
    {
      title: 'Export as JPEG at 80% quality',
      options: { mode: 'fit', width: 1280, height: 720, format: 'jpeg', quality: 80 },
    },
  ],
  article: [
    {
      heading: 'Formats and output names',
      body: 'Takes one or more PNG, JPEG or WebP images and scales each to a new size, either by a percentage or to explicit width and height, returning resized copies as downloads. Output files are named like photo-640x480.jpg and keep their original format unless you choose PNG, JPEG or WebP explicitly. EXIF orientation is applied while decoding, so a portrait photo is not rotated sideways.',
    },
    {
      heading: 'When to use it',
      body: 'Use it to shrink large photos before emailing or uploading them, or to force an asset to exact pixel dimensions for a web layout. Batch mode accepts many files at once and gives each the same sizing rules, which suits normalizing a folder of product shots before publishing.',
    },
    {
      heading: 'The sizing modes',
      body: 'Fit keeps the aspect ratio inside your width and height. Fill crops to cover that box, exact forces the raw dimensions and can distort, percent scales both axes by the same factor, and max-width or max-height cap one axis while scaling the other. Defaults are 800 by 600 pixels and 50 percent. The upscale toggle stops small images from being enlarged unless you turn it on.',
    },
    {
      heading: 'Limitations',
      body: 'Dimensions are clamped to 1 to 8192 pixels and percent to 1 to 400. A per-canvas memory budget rejects images that would blow out available memory. JPEG output flattens transparency onto white and exposes a quality slider from 10 to 100 percent, defaulting to 90.',
    },
    {
      heading: 'Privacy',
      body: 'All decoding, scaling and encoding happen in the browser tab. Images never leave the device and the tool works offline.',
    },
  ],
  faq: [
    { q: 'Are images uploaded?', a: 'No. Images are processed locally in your browser.' },
    {
      q: 'Does it respect photo orientation?',
      a: 'Yes — EXIF orientation is applied while decoding so portrait photos are not rotated.',
    },
    {
      q: 'Does resizing change the file type?',
      a: 'Only if you pick an output format. The default keeps the original format; choosing PNG, JPEG or WebP converts every result, and JPEG exposes a quality setting.',
    },
  ],
  related: ['image-compress', 'image-convert', 'image-crop'],
  status: 'stable',
  updated: '2026-10-16',
};
