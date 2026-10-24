import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'image-filters',
  name: 'Image Filters',
  category: 'image',
  summary: 'Brightness, contrast, saturation, grayscale, sepia and sharpen with a live preview.',
  description:
    'Adjust brightness, contrast, saturation, sharpen and apply grayscale or sepia to a photo with a live preview on the real pixels. Compare before and after, then export a full-resolution PNG, JPEG or WebP. Everything runs on your device — the image is never uploaded.',
  keywords: [
    'image filters',
    'photo editor',
    'brightness',
    'contrast',
    'saturation',
    'grayscale',
    'sepia',
    'sharpen photo',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'image/png,image/jpeg,image/webp',
  panel: 'image-filters',
  options: [
    {
      key: 'brightness',
      label: 'Brightness',
      type: 'range',
      default: 0,
      min: -100,
      max: 100,
      step: 1,
    },
    {
      key: 'contrast',
      label: 'Contrast',
      type: 'range',
      default: 0,
      min: -100,
      max: 100,
      step: 1,
    },
    {
      key: 'saturation',
      label: 'Saturation',
      type: 'range',
      default: 0,
      min: -100,
      max: 100,
      step: 1,
    },
    { key: 'grayscale', label: 'Grayscale', type: 'boolean', default: false },
    { key: 'sepia', label: 'Sepia', type: 'boolean', default: false },
    {
      key: 'sharpen',
      label: 'Sharpen',
      type: 'range',
      default: 0,
      min: 0,
      max: 100,
      step: 1,
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
      default: 92,
      min: 10,
      max: 100,
      step: 1,
      showWhen: { key: 'format', value: 'jpeg' },
    },
  ],
  examples: [
    { title: 'Brighten a dark photo', options: { brightness: 30 } },
    { title: 'Make it black and white', options: { grayscale: true } },
    {
      title: 'Vintage sepia, sharpened',
      options: { sepia: true, sharpen: 40, saturation: -20 },
    },
  ],
  article: [
    {
      heading: 'A live preview on the real pixels',
      body: 'Unlike a CSS filter that only tweaks how the image is drawn on screen, this tool runs the actual pixel pipeline and shows you the result. Brightness, contrast, saturation, grayscale and sepia are applied as colour-matrix math, and sharpen uses an unsharp-mask kernel. What you see in the preview is exactly the pixel data the export writes.',
    },
    {
      heading: 'Compare before and after',
      body: 'Hold or toggle the compare button to flip the preview back to the original image. The unfiltered source is kept in memory, so the comparison is exact — you are not approximating what the filter did.',
    },
    {
      heading: 'Preview scale, full-resolution export',
      body: 'Large photos are previewed on a downscaled canvas so adjusting sliders stays fast, even on a 50-megapixel camera. When you export, the same pipeline is applied to the full-resolution pixels, so the downloaded file keeps every detail of the original.',
    },
    {
      heading: 'On-device and offline',
      body: 'All processing runs locally in your browser tab. The image is decoded, filtered and re-encoded without a single network request, so it works fully offline and nothing you edit leaves your device.',
    },
  ],
  faq: [
    {
      q: 'Is this the same as a CSS filter?',
      a: 'No. A CSS filter changes how the browser draws the image on screen but never touches the pixels. Here the filter is applied to the actual image data, and the export is a real, re-encoded image file.',
    },
    {
      q: 'Does the preview match the export?',
      a: 'Yes. The preview and the export run the exact same pixel pipeline, so the only difference is resolution — large images are previewed scaled down to stay fast, but the export runs at full resolution.',
    },
    {
      q: 'Are my images uploaded anywhere?',
      a: 'No. Every step — decode, filter and encode — happens in your browser. The site works fully offline and nothing leaves your device.',
    },
  ],
  related: ['image-convert', 'image-resize', 'image-palette', 'image-compress'],
  status: 'stable',
  updated: '2026-10-24',
};